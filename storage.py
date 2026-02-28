import pymongo
import faiss
import numpy as np
from bson import ObjectId

class Storage:
    def __init__(self, mongo_uri, db_name="HebrewAudioSearch"):
        # connecing to MongoDB
        self.client = pymongo.MongoClient(mongo_uri)
        self.db = self.client[db_name]
        
        # creating collections
        self.blocks_collection = self.db["windows"]
        self.files_collection = self.db["files"]
        
        # creating indexes
        self.blocks_collection.create_index([("user_id", 1), ("window_text", 1)])
        self.files_collection.create_index([("user_id", 1), ("file_name", 1)], unique=True)
        
        # setting up FAISS with the size of e5 index
        self.index = faiss.IndexFlatIP(384) 
        
        # lists to keep track of document IDs and their corresponding user IDs for isolation
        self.doc_ids = []
        self.user_ids = [] 
        self._load_vector_index()


    def _load_vector_index(self):
        """Loads all existing embeddings from MongoDB into the FAISS index on startup"""
        print("📂 Loading vector index from MongoDB...")
        self.doc_ids = []
        self.user_ids = []
        
        # get all documents with only the embedding and user_id fields to minimize memory usage
        all_docs = list(self.blocks_collection.find({}, {"embedding": 1, "_id": 1, "user_id": 1}))
        
        if all_docs:
            embeddings = np.array([doc["embedding"] for doc in all_docs]).astype('float32')
            self.index.add(embeddings)
            self.doc_ids = [str(doc["_id"]) for doc in all_docs]
            self.user_ids = [str(doc.get("user_id")) for doc in all_docs]
            
        print(f"✅ Loaded {len(self.doc_ids)} blocks into FAISS.")


    def save_windows(self, file_name, blocks, embeddings, full_transcript, user_id):
        """
        Saves the blocks and their embeddings to MongoDB and updates the FAISS index
        """

        file_meta = {
            "user_id": user_id,
            "file_name": file_name,
            "full_transcript": full_transcript,
            "processed_at": str(np.datetime64('now'))
        }
        
        # save or update the file metadata (upsert) - critical for user isolation
        self.files_collection.update_one(
            {"file_name": file_name, "user_id": user_id},
            {"$set": file_meta},
            upsert=True
        )
        
        # pull the file_id for the current file and user to link the blocks
        file_doc = self.files_collection.find_one({"file_name": file_name, "user_id": user_id})
        file_id = file_doc["_id"]

        # remove old blocks for this file and user to prevent duplicates 
        self.blocks_collection.delete_many({"file_id": file_id, "user_id": user_id})

        # prepare the new blocks with the file_id and user_id for insertion
        payload = []
        new_embeddings = []
        
        for i, block in enumerate(blocks):
            doc = {
                "file_id": file_id,           # link to the file metadata for easy retrieval
                "user_id": user_id,           # user_id for strict isolation
                "file_name": file_name,       
                "window_text": block["window_text"],
                "sentences": block["sentences"], 
                "start": block["start"],
                "end": block["end"],
                "embedding": embeddings[i]
            }
            payload.append(doc)
            new_embeddings.append(embeddings[i])

        # add to MongoDB and then to FAISS 
        if payload:
            # add new blocks to MongoDB
            insert_result = self.blocks_collection.insert_many(payload)
            
            # update the in-memory FAISS index and mappings with the new blocks
            emb_np = np.array(new_embeddings).astype('float32')
            if emb_np.ndim == 1:
                emb_np = emb_np.reshape(1, -1) # ensure it's 2D for FAISS

            self.index.add(emb_np)
            
            new_ids = [str(_id) for _id in insert_result.inserted_ids]
            self.doc_ids.extend(new_ids)
            self.user_ids.extend([str(user_id)] * len(new_ids))
            
            print(f"✅ Saved {len(payload)} blocks for file: {file_name} (User: {user_id})")

    def delete_record(self, user_id, file_name):
            """ 
            Delete a call record file, its blocks from MongoDB, and refresh the FAISS index
            """
            print(f"🗑️ Deleting record: {file_name} for user: {user_id}")
            
            # delete from DB
            file_delete_result = self.files_collection.delete_one({"user_id": user_id, "file_name": file_name})
            blocks_delete_result = self.blocks_collection.delete_many({"user_id": user_id, "file_name": file_name})
            
            if file_delete_result.deleted_count == 0:
                print(f"⚠️ No record found for {file_name} under user {user_id}")
                return False

        
            print(f"🔄 Refreshing FAISS index to maintain consistency...")
            
            # rebuild the new faiss index with the remaining records
            self.index = faiss.IndexFlatIP(384) 
            self._load_vector_index()
            
            print(f"✅ Successfully deleted {file_name} and synchronized FAISS.")
            return True

    def vector_search(self, query_vector, user_id, k=10):
        """
        Vector search with strict user isolation: only search within vectors belonging to the specified user_id
        """
        if self.index.ntotal == 0: return []
        
        query_vector = np.array([query_vector]).astype('float32')
        # pulling more candidates to allow for user-based filtering later   
        distances, indices = self.index.search(query_vector, k * 5)

        candidate_ids = []
        score_map = {}

        # 1. collect candidate IDs from FAISS results but only for the matching user_id
        for dist, idx in zip(distances[0], indices[0]):
            if idx == -1 or idx >= len(self.doc_ids): continue
            if self.user_ids[idx] == str(user_id):
                oid = ObjectId(self.doc_ids[idx])
                candidate_ids.append(oid)
                score_map[oid] = float(dist) # store the distance score

        if not candidate_ids: return []

         # 2. pull the user-specific candidate documents 
        cursor = self.blocks_collection.find(
            {"_id": {"$in": candidate_ids}, "user_id": user_id},
            {"window_text": 1, 
             "user_id": 1, 
             "file_id": 1,
             "start": 1, 
             "file_name": 1,
             "sentences": 1} # Projection for optimized retrieval
        )

        results = []
        for res in cursor:
            res["vector_score"] = score_map[res["_id"]]
            res["_id"] = str(res["_id"])
            res["file_id"] = str(res["file_id"])
            results.append(res)

        return sorted(results, key=lambda x: x["vector_score"], reverse=True)[:k]


    def exact_search(self, query, user_id, limit=20):
        """
        Exact keyword search within the blocks of a specific user
        """
        query_filter = {
            "window_text": {"$regex": query, "$options": "i"},
            "user_id": user_id 
        }
        
        # projection to return only necessary fields for search results 
        projection = {
            "window_text": 1, 
            "file_id": 1, 
            "user_id": 1, 
            "start": 1, 
            "end": 1,
            "file_name": 1,
            "sentences": 1
        }
        
        results = list(self.blocks_collection.find(query_filter, projection).limit(limit))
        
        for res in results:
            res["origin"] = "exact"
            res["_id"] = str(res["_id"])
            res["file_id"] = str(res["file_id"])
        return results


    def get_full_transcript(self, file_name, user_id):
        """ 
        Retrieves the full transcript for a given file and user
        """
        doc = self.files_collection.find_one(
            {"file_name": file_name, "user_id": user_id}, 
            {"full_transcript": 1}
        )
        return doc["full_transcript"] if doc else None

