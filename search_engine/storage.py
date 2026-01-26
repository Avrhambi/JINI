#storage.py
import pymongo
import faiss
import numpy as np
from bson import ObjectId
import time

class Storage:
    def __init__(self, mongo_uri, db_name="HebrewAudioSearch"):
        # 1. התחברות ל-MongoDB
        self.client = pymongo.MongoClient(mongo_uri)
        self.db = self.client[db_name]
        
        # Collection של הבלוקים (לחיפוש וקטורי וטקסטואלי)
        self.collection = self.db["windows"]
        
        # Collection למטא-דאטה ותמלול מלא של קבצים
        self.files_collection = self.db["files"]
        
        # 2. הגדרת אינדקסים מורכבים לביצועים ובידוד משתמשים
        # אינדקס טקסטואלי משולב עם user_id לחיפוש מהיר ומאובטח
        self.collection.create_index([("user_id", 1), ("window_text", pymongo.TEXT)])
        
        # אינדקס ייחודי המונע כפילות שם קובץ לאותו משתמש
        self.files_collection.create_index([("user_id", 1), ("file_name", 1)], unique=True)
        
        # 3. הגדרת FAISS (וקטורים בגודל 1024 עבור E5-Large)
        self.index = faiss.IndexFlatIP(1024) 
        
        # רשימות לניהול המיפוי בזיכרון
        self.doc_ids = []
        self.user_ids = [] 
        self._load_vector_index()

    def _load_vector_index(self):
        """טעינת כל הוקטורים מה-DB לתוך הזיכרון של FAISS עם שיוך למשתמשים"""
        print("📂 Loading vector index from MongoDB...")
        self.doc_ids = []
        self.user_ids = []
        
        # שליפת הוקטורים יחד עם מזהה המסמך ומזהה המשתמש
        all_docs = list(self.collection.find({}, {"embedding": 1, "_id": 1, "user_id": 1}))
        
        if all_docs:
            embeddings = np.array([doc["embedding"] for doc in all_docs]).astype('float32')
            self.index.add(embeddings)
            self.doc_ids = [str(doc["_id"]) for doc in all_docs]
            self.user_ids = [str(doc.get("user_id")) for doc in all_docs]
            
        print(f"✅ Loaded {len(self.doc_ids)} blocks into FAISS.")

    def save_windows(self, file_name, blocks, embeddings, full_transcript, user_id):
        """
        שמירה של קובץ חדש: עדכון תמלול מלא ובלוקים תחת מזהה משתמש ספציפי.
        """
        # א. שמירת/עדכון פרטי הקובץ והתמלול המלא
        file_meta = {
            "user_id": user_id,
            "file_name": file_name,
            "full_transcript": full_transcript,
            "processed_at": str(np.datetime64('now'))
        }
        
        # שימוש ב-upsert מבוסס משתמש + קובץ למניעת דריסת נתונים של משתמשים אחרים
        self.files_collection.update_one(
            {"file_name": file_name, "user_id": user_id},
            {"$set": file_meta},
            upsert=True
        )
        
        # שליפת ה-ID הייחודי של הקובץ (הכרחי לקישור הבלוקים)
        file_doc = self.files_collection.find_one({"file_name": file_name, "user_id": user_id})
        file_id = file_doc["_id"]

        # ניקוי בלוקים ישנים של הקובץ הזה עבור המשתמש הזה בלבד
        self.collection.delete_many({"file_id": file_id, "user_id": user_id})

        # ב. הכנת הבלוקים לשמירה
        payload = []
        new_embeddings = []
        
        for i, block in enumerate(blocks):
            doc = {
                "file_id": file_id,           # קישור קשיח לקובץ האב
                "user_id": user_id,           # מזהה המשתמש לבידוד בחיפוש
                "file_name": file_name,       
                "window_text": block["window_text"],
                "sentences": block["sentences"], 
                "start": block["start"],
                "end": block["end"],
                "embedding": embeddings[i]
            }
            payload.append(doc)
            new_embeddings.append(embeddings[i])

        # ג. הכנסה ל-MongoDB ועדכון FAISS בזמן אמת
        if payload:
            insert_result = self.collection.insert_many(payload)
            
            # הוספה ל-FAISS ועדכון רשימות המיפוי בזיכרון
            emb_np = np.array(new_embeddings).astype('float32')
            self.index.add(emb_np)
            
            new_ids = [str(_id) for _id in insert_result.inserted_ids]
            self.doc_ids.extend(new_ids)
            self.user_ids.extend([str(user_id)] * len(new_ids))
            
            print(f"✅ Saved {len(payload)} blocks for file: {file_name} (User: {user_id})")

    def search_vector(self, query_vector, user_id, k=10):
        """חיפוש סמנטי ב-FAISS עם סינון קשיח לפי מזהה משתמש"""
        if self.index.ntotal == 0:
            return []

        query_vector = np.array([query_vector]).astype('float32')
        # שליפת כמות כפולה של מועמדים כדי לאפשר סינון משתמשים בזיכרון
        distances, indices = self.index.search(query_vector, k * 5)

        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx == -1 or idx >= len(self.doc_ids): continue
            
            # בדיקת בעלות בזיכרון לפני שליפה מה-DB
            if self.user_ids[idx] != str(user_id): continue
            
            doc_id = self.doc_ids[idx]
            res = self.collection.find_one({"_id": ObjectId(doc_id), "user_id": user_id})
            if res:
                res["vector_score"] = float(dist)
                res["_id"] = str(res["_id"])
                res["file_id"] = str(res["file_id"])
                results.append(res)
                
            if len(results) >= k: break 
        return results

    def exact_search(self, query, user_id, limit=20):
        """חיפוש טקסטואלי בתוך תוכן הבלוקים של משתמש ספציפי"""
        query_filter = {
            "window_text": {"$regex": query, "$options": "i"},
            "user_id": user_id 
        }
        results = list(self.collection.find(query_filter).limit(limit))
        for res in results:
            res["origin"] = "exact"
            res["_id"] = str(res["_id"])
            res["file_id"] = str(res["file_id"])
        return results

    def get_full_transcript(self, file_name, user_id):
        """שליפת התמלול המלא עבור משתמש מסוים"""
        doc = self.files_collection.find_one(
            {"file_name": file_name, "user_id": user_id}, 
            {"full_transcript": 1}
        )
        return doc["full_transcript"] if doc else None
