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

# import pymongo
# import faiss
# import numpy as np
# from bson import ObjectId

# class Storage:
#     def __init__(self, mongo_uri, db_name="HebrewAudioSearch"):
#         # 1. התחברות ל-MongoDB
#         self.client = pymongo.MongoClient(mongo_uri)
#         self.db = self.client[db_name]
        
#         # Collection של הבלוקים (לחיפוש וקטורי וטקסטואלי)
#         self.collection = self.db["windows"]
        
#         # Collection חדש למטא-דאטה ותמלול מלא של קבצים
#         self.files_collection = self.db["files"]
        
#         # 2. הגדרת אינדקסים
#         # אינדקס טקסטואלי על window_text (שמכיל עכשיו את כל הבלוק)
#         self.collection.create_index([("window_text", pymongo.TEXT)])
#         # אינדקס מהיר לפי שם קובץ
#         self.files_collection.create_index("file_name", unique=True)
        
#         # 3. הגדרת FAISS (וקטורים בגודל 1024 עבור E5-Large)
#         self.index = faiss.IndexFlatIP(1024) 
        
#         # רשימה שמקשרת בין אינדקס ב-FAISS ל-ID ב-MongoDB
#         self.doc_ids = []
#         self._load_vector_index()

#     def _load_vector_index(self):
#         """טעינת כל הוקטורים מה-DB לתוך הזיכרון של FAISS"""
#         print("📂 Loading vector index from MongoDB...")
#         self.doc_ids = []
#         all_docs = list(self.collection.find({}, {"embedding": 1, "_id": 1}))
#         if all_docs:
#             embeddings = np.array([doc["embedding"] for doc in all_docs]).astype('float32')
#             self.index.add(embeddings)
#             self.doc_ids = [str(doc["_id"]) for doc in all_docs]
#         print(f"✅ Loaded {len(self.doc_ids)} blocks into FAISS.")

# # storage.py - מימוש מעודכן בתוך המחלקה Storage

#     def save_windows(self, file_name, blocks, embeddings, full_transcript, user_id):
#         """
#         שמירה של קובץ חדש: תמלול מלא ב-files ובלוקים ב-windows, מותאם ל-user_id.
#         """
#         # א. שמירת/עדכון פרטי הקובץ והתמלול המלא עם הצמדת user_id
#         file_meta = {
#             "user_id": user_id, 
#             "file_name": file_name,
#             "full_transcript": full_transcript,
#             "processed_at": str(np.datetime64('now')) 
#         }
        
#         # שימוש ב-upsert מבוסס משתמש + קובץ למניעת כפילויות
#         self.files_collection.update_one(
#             {"file_name": file_name, "user_id": user_id},
#             {"$set": file_meta},
#             upsert=True
#         )
        
#         # שליפת ה-ID הייחודי של הקובץ מהמשתמש הספציפי (הכרחי לקישור הבלוקים)
#         file_doc = self.files_collection.find_one({"file_name": file_name, "user_id": user_id})
#         file_id = file_doc["_id"]

#         # מחיקת בלוקים ישנים של הקובץ הזה עבור המשתמש הזה בלבד
#         self.collection.delete_many({"file_id": file_id, "user_id": user_id})

#         # ב. הכנת הבלוקים לשמירה עם תיוג המשתמש וקישור לקובץ
#         payload = []
#         new_embeddings = []
        
#         for i, block in enumerate(blocks):
#             doc = {
#                 "file_id": file_id,           # קישור קשיח לקובץ האב
#                 "user_id": user_id,           # מזהה המשתמש לבידוד בחיפוש
#                 "file_name": file_name,       # למען הנוחות בשליפה מהירה
#                 "window_text": block["window_text"],
#                 "sentences": block["sentences"], # רשימת המשפטים המפורטת לסוכן
#                 "start": block["start"],
#                 "end": block["end"],
#                 "embedding": embeddings[i]
#             }
#             payload.append(doc)
#             new_embeddings.append(embeddings[i])

#         # ג. הכנסה ל-MongoDB ועדכון FAISS בזמן אמת
#         if payload:
#             insert_result = self.collection.insert_many(payload)
            
#             # עדכון אינדקס הוקטורים (FAISS) בזיכרון
#             emb_np = np.array(new_embeddings).astype('float32')
#             self.index.add(emb_np)
            
#             # עדכון רשימת ה-doc_ids בזיכרון לסנכרון עם FAISS
#             self.doc_ids.extend([str(_id) for _id in insert_result.inserted_ids])
            
#             print(f"✅ Saved {len(payload)} blocks for file: {file_name} (User: {user_id})")
#     # def save_windows(self, file_name, blocks, embeddings, full_transcript):
#     #     """
#     #     שמירה של קובץ חדש: תמלול מלא ב-files ובלוקים ב-windows.
#     #     """
#     #     # א. שמירת/עדכון פרטי הקובץ והתמלול המלא
#     #     file_meta = {
#     #         "file_name": file_name,
#     #         "full_transcript": full_transcript,
#     #         "processed_at": np.datetime64('now').astype(str)
#     #     }
        
#     #     # שימוש ב-upsert כדי למנוע כפילויות של קבצים
#     #     file_result = self.files_collection.update_one(
#     #         {"file_name": file_name},
#     #         {"$set": file_meta},
#     #         upsert=True
#     #     )
        
#     #     # שליפת ה-ID של הקובץ (הכרחי לקישור הבלוקים)
#     #     file_doc = self.files_collection.find_one({"file_name": file_name})
#     #     file_id = file_doc["_id"]


#     #     self.collection.delete_many({"file_id": file_id})  # מחיקת בלוקים ישנים במידה וקיימים

#     #     # ב. הכנת הבלוקים לשמירה
#     #     payload = []
#     #     new_embeddings = []
        
#     #     for i, block in enumerate(blocks):
#     #         doc = {
#     #             "file_id": file_id,           # קישור קשיח לקובץ האב
#     #             "file_name": file_name,       # למען הנוחות בשליפה מהירה
#     #             "window_text": block["window_text"],
#     #             "sentences": block["sentences"], # רשימת המשפטים המפורטת
#     #             "start": block["start"],
#     #             "end": block["end"],
#     #             "embedding": embeddings[i]
#     #         }
#     #         payload.append(doc)
#     #         new_embeddings.append(embeddings[i])

#     #     # ג. הכנסה ל-MongoDB ועדכון FAISS
#     #     if payload:
#     #         insert_result = self.collection.insert_many(payload)
            
#     #         # הוספה ל-FAISS בזמן אמת
#     #         emb_np = np.array(new_embeddings).astype('float32')
#     #         self.index.add(emb_np)
            
#     #         # שמירת ה-IDs החדשים בזיכרון
#     #         self.doc_ids.extend([str(_id) for _id in insert_result.inserted_ids])
#     #         print(f"✅ Saved {len(payload)} blocks for file: {file_name}")

#     def search_vector(self, query_vector, k=10):
#         """חיפוש סמנטי ב-FAISS ושליפת הבלוקים מה-DB"""
#         if self.index.ntotal == 0:
#             return []

#         query_vector = np.array([query_vector]).astype('float32')
#         distances, indices = self.index.search(query_vector, k)

#         results = []
#         for dist, idx in zip(distances[0], indices[0]):
#             if idx == -1 or idx >= len(self.doc_ids): continue
            
#             doc_id = self.doc_ids[idx]
#             # שליפת הבלוק המלא כולל ה-sentences
#             res = self.collection.find_one({"_id": ObjectId(doc_id)})
#             if res:
#                 res["vector_score"] = float(dist)
#                 res["_id"] = str(res["_id"])
#                 res["file_id"] = str(res["file_id"])
#                 results.append(res)
#         return results

#     def exact_search(self, query, limit=20):
#         """חיפוש טקסטואלי בתוך תוכן הבלוקים"""
#         query_filter = {"window_text": {"$regex": query, "$options": "i"}}
#         results = list(self.collection.find(query_filter).limit(limit))
#         for res in results:
#             res["origin"] = "exact"
#             res["_id"] = str(res["_id"])
#             res["file_id"] = str(res["file_id"])
#         return results

#     def get_full_transcript(self, file_name):
#         """שליפת התמלול המלא עבור ה-UI"""
#         doc = self.files_collection.find_one({"file_name": file_name}, {"full_transcript": 1})
#         return doc["full_transcript"] if doc else None
    
# # storage.py
# import pymongo
# import faiss
# import numpy as np
# from bson import ObjectId

# class Storage:
#     def __init__(self, mongo_uri, db_name="HebrewAudioSearch"):
#         self.client = pymongo.MongoClient(mongo_uri)
#         self.db = self.client[db_name]
#         self.collection = self.db["windows"]
        
#         self.collection.create_index([("anchor_text", pymongo.TEXT)])
        
#         # אינדקס וקטורי
#         self.index = faiss.IndexFlatIP(1024) 
        
#         # רשימה שתחזיק רק את ה-IDs (חוסך המון RAM לעומת טעינת כל המסמכים)
#         self.doc_ids = []
#         self._load_vector_index()

#     def _load_vector_index(self):
#         """טעינת הוקטורים וה-IDs בלבד מה-DB לזיכרון"""
#         # שליפה ממוקדת: רק הוקטור וה-ID
#         all_docs = list(self.collection.find({}, {"embedding": 1, "_id": 1}))
#         if all_docs:
#             embeddings = np.array([doc["embedding"] for doc in all_docs]).astype('float32')
#             self.index.add(embeddings)
#             # שמירת ה-ID כמחרוזת במיקום התואם לאינדקס ב-FAISS
#             self.doc_ids = [str(doc["_id"]) for doc in all_docs]
#             print(f"Loaded {self.index.ntotal} vectors and IDs into memory.")

#     def save_windows(self, file_name, windows, embeddings):
#         """שמירת חלונות חדשים ועדכון המזהים בזיכרון"""
#         if self.collection.find_one({"file_name": file_name}):
#             print(f"⏩ {file_name} already exists. Skipping...")
#             return
        
#         payload = []
#         for i, window in enumerate(windows):
#             doc = {
#                 "file_name": file_name,
#                 "anchor_text": window["anchor_text"],
#                 "window_text": window["window_text"],
#                 "start": window["start"],
#                 "end": window["end"],
#                 "embedding": embeddings[i]
#             }
#             payload.append(doc)
        
#         if payload:
#             insert_result = self.collection.insert_many(payload)
#             # הוספה ל-FAISS
#             self.index.add(np.array(embeddings).astype('float32'))
#             # הוספת ה-IDs החדשים לרשימה בזיכרון
#             self.doc_ids.extend([str(_id) for _id in insert_result.inserted_ids])

#     def vector_search(self, query_vector, k=15):
#         """חיפוש סמנטי ושליפה ממוקדת של 15 תוצאות בלבד"""
#         query_vector = np.array([query_vector]).astype('float32')
#         distances, indices = self.index.search(query_vector, k)
        
#         # חילוץ ה-ObjectIds הרלוונטיים בלבד
#         target_ids = []
#         for idx in indices[0]:
#             if idx != -1 and idx < len(self.doc_ids):
#                 target_ids.append(ObjectId(self.doc_ids[idx]))
        
#         if not target_ids: return []

#         # שליפה מה-MongoDB: מביאים רק את מה שצריך (במקום הכל!)
#         results = list(self.collection.find({"_id": {"$in": target_ids}}))
        
#         # הוספת מקור המידע לכל תוצאה
#         for res in results:
#             res["origin"] = "semantic"
#         return results

#     def exact_search(self, query):
#         """חיפוש טקסטואלי רגיל"""
#         regex_query = {"anchor_text": {"$regex": query, "$options": "i"}}
#         results = list(self.collection.find(regex_query).limit(10))
#         for res in results:
#             res["origin"] = "exact"
#         return results
# # #storage.py
# # import pymongo
# # import faiss
# # import numpy as np

# # class Storage:
# #     def __init__(self, mongo_uri, db_name="HebrewAudioSearch"):
# #         # התחברות ל-MongoDB
# #         self.client = pymongo.MongoClient(mongo_uri)
# #         self.db = self.client[db_name]
# #         self.collection = self.db["windows"]
        
# #         # הגדרת אינדקס טקסטואלי לחיפ    וש המדויק (Exact Search)
# #         self.collection.create_index([("anchor_text", pymongo.TEXT)])
        
# #         # הגדרת FAISS (חיפוש סמנטי) - וקטורים בגודל 1024
# #         self.index = faiss.IndexFlatIP(1024) 
        
# #         # רשימה שתחזיק את ה-IDs של MongoDB לפי סדר ההכנסה ל-FAISS
# #         self.doc_ids = []
# #         self._load_vector_index()

# #     def _load_vector_index(self):
# #         """טעינת כל הוקטורים מה-DB לתוך הזיכרון של FAISS ושמירת ה-ID שלהם"""
# #         all_docs = list(self.collection.find({}, {"embedding": 1, "_id": 1}))
# #         if all_docs:
# #             embeddings = np.array([doc["embedding"] for doc in all_docs]).astype('float32')
# #             self.index.add(embeddings)
# #             # שמירת ה-ID בסדר תואם ל-FAISS
# #             self.doc_ids = [str(doc["_id"]) for doc in all_docs]
# #             print(f"Loaded {self.index.ntotal} vectors into FAISS.")

# #     def save_windows(self, file_name, windows, embeddings):
# #         """שמירת החלונות והוקטורים ל-DB ועדכון ה-FAISS"""
# #         # בדיקה אם הקובץ כבר קיים ב-DB כדי למנוע כפילויות
# #         if self.collection.find_one({"file_name": file_name}):
# #             print(f"⏩ File {file_name} already indexed in MongoDB. Skipping...")
# #             return
        
# #         payload = []
# #         # ה-embeddings מגיעים מה-Worker כרשימה של רשימות, אין צורך ב-.tolist() נוסף אם הם כבר כאלו
# #         for i, window in enumerate(windows):
# #             doc = {
# #                 "file_name": file_name,
# #                 "anchor_text": window["anchor_text"],
# #                 "window_text": window["window_text"],
# #                 "start": window["start"],
# #                 "end": window["end"],
# #                 "embedding": embeddings[i] # שמירה ישירה
# #             }
# #             payload.append(doc)
        
# #         if payload:
# #             # הכנסה ל-MongoDB וקבלת ה-IDs שנוצרו
# #             insert_result = self.collection.insert_many(payload)
            
# #             # עדכון ה-FAISS
# #             new_embeddings = np.array(embeddings).astype('float32')
# #             self.index.add(new_embeddings)
            
# #             # עדכון רשימת ה-IDs בזיכרון כדי לשמור על סנכרון
# #             self.doc_ids.extend([str(_id) for _id in insert_result.inserted_ids])
# #             print(f"Added {len(payload)} new segments to storage.")

# #     def exact_search(self, query):
# #         """חיפוש טקסטואלי מדויק על ה-anchor_text"""
# #         regex_query = {"anchor_text": {"$regex": query, "$options": "i"}}
# #         results = self.collection.find(regex_query).limit(10)
        
# #         output = []
# #         for res in results:
# #             res["origin"] = "exact"
# #             output.append(res)
# #         return output

# #     def vector_search(self, query_vector, k=15):
# #         """חיפוש סמנטי בעזרת FAISS ושליפה ממוקדת מ-MongoDB"""
# #         query_vector = np.array([query_vector]).astype('float32')
# #         distances, indices = self.index.search(query_vector, k)
        
# #         output = []
# #         for idx in indices[0]:
# #             if idx != -1 and idx < len(self.doc_ids):
# #                 # שליפת ה-ID הנכון מהרשימה המסונכרנת
# #                 mongo_id = self.doc_ids[idx]
# #                 # שליפת המסמך הספציפי מה-DB (הרבה יותר מהיר משימוש ב-all_docs)
# #                 from bson import ObjectId
# #                 doc = self.collection.find_one({"_id": ObjectId(mongo_id)})
# #                 if doc:
# #                     doc["origin"] = "semantic"
# #                     output.append(doc)
# #         return output
# # import pymongo
# # import faiss
# # import numpy as np

# # class Storage:
# #     def __init__(self, mongo_uri, db_name="HebrewAudioSearch"):
# #         # התחברות ל-MongoDB
# #         self.client = pymongo.MongoClient(mongo_uri)
# #         self.db = self.client[db_name]
# #         self.collection = self.db["windows"]
        
# #         # הגדרת אינדקס טקסטואלי לחיפוש המדויק (Exact Search)
# #         self.collection.create_index([("anchor_text", pymongo.TEXT)])
        
# #         # הגדרת FAISS (חיפוש סמנטי) - וקטורים בגודל 1024 (עבור E5-large)
# #         self.index = faiss.IndexFlatIP(1024) 
# #         self._load_vector_index()

# #     def _load_vector_index(self):
# #         """טעינת כל הוקטורים מה-DB לתוך הזיכרון של FAISS לצורך חיפוש מהיר"""
# #         all_docs = list(self.collection.find({}, {"embedding": 1}))
# #         if all_docs:
# #             embeddings = np.array([doc["embedding"] for doc in all_docs]).astype('float32')
# #             self.index.add(embeddings)
# #             print(f"Loaded {self.index.ntotal} vectors into FAISS.")

# #     def save_windows(self, file_name, windows, embeddings):
# #         """שמירת החלונות והוקטורים ל-DB ועדכון ה-FAISS"""
# #         payload = []
# #         for i, window in enumerate(windows):
# #             doc = {
# #                 "file_name": file_name,
# #                 "anchor_text": window["anchor_text"],
# #                 "window_text": window["window_text"],
# #                 "start": window["start"],
# #                 "end": window["end"],
# #                 "embedding": embeddings[i].tolist()
# #             }
# #             payload.append(doc)
        
# #         if payload:
# #             self.collection.insert_many(payload)
# #             # עדכון ה-FAISS בזמן אמת
# #             self.index.add(np.array(embeddings).astype('float32'))

# #     def exact_search(self, query):
# #         """חיפוש טקסטואלי מדויק על ה-anchor_text"""
# #         # שימוש ב-regex כדי למצוא את המילה בתוך ה-anchor
# #         regex_query = {"anchor_text": {"$regex": query, "$options": "i"}}
# #         results = self.collection.find(regex_query).limit(10)
        
# #         output = []
# #         for res in results:
# #             res["origin"] = "exact"
# #             output.append(res)
# #         return output

# #     def vector_search(self, query_vector, k=15):
# #         """חיפוש סמנטי בעזרת FAISS"""
# #         query_vector = np.array([query_vector]).astype('float32')
# #         distances, indices = self.index.search(query_vector, k)
        
# #         output = []
# #         # שליפת המסמכים המלאים מ-MongoDB לפי האינדקסים מ-FAISS
# #         # הערה: בייצור כדאי לשמור מפת אינדקסים, כאן אנחנו שולפים את כולם לצורך הפשטות
# #         all_docs = list(self.collection.find()) 
# #         for idx in indices[0]:
# #             if idx != -1 and idx < len(all_docs):
# #                 doc = all_docs[idx]
# #                 doc["origin"] = "semantic"
# #                 output.append(doc)
# #         return output
# # # storage.py
# # import json
# # import os
# # import faiss
# # import numpy as np
# # from pymongo import MongoClient

# # class Storage:
# #     def __init__(self, index_dir: str):
# #         self.index_dir = index_dir
# #         self.all_windows = []
# #         self.index = None
# #         # חיבור ל-MongoDB לוקאלי
# #         self.mongo_client = MongoClient("mongodb://localhost:27017/")
# #         self.db = self.mongo_client["audio_search"]
# #         self.collection = self.db["windows"]
# #         # יצירת אינדקס טקסטואלי לחיפוש מדויק בעברית
# #         self.collection.create_index([("anchor_text", "text")])

# #     def sync_drive_to_db(self):
# #         """סורק את תיקיית ה-index בדרייב ומעביר נתונים חדשים ל-MongoDB"""
# #         if not os.path.exists(self.index_dir):
# #             return 0
            
# #         json_files = [f for f in os.listdir(self.index_dir) if f.endswith(".json")]
# #         files_added = 0
        
# #         for file_name in json_files:
# #             file_id = file_name.replace(".json", "")
# #             # בדיקה אם הקובץ כבר קיים ב-DB כדי למנוע כפילויות
# #             if self.collection.find_one({"file_id": file_id}):
# #                 continue
                
# #             path = os.path.join(self.index_dir, file_name)
# #             with open(path, 'r', encoding='utf-8') as f:
# #                 data = json.load(f)
# #                 if data:
# #                     # הוספת מזהה קובץ לכל רשומה
# #                     for item in data:
# #                         item["file_id"] = file_id
# #                     self.collection.insert_many(data)
# #                     files_added += 1
# #         return files_added

# #     def load_faiss(self):
# #         """שליפת הנתונים מה-DB ובניית אינדקס FAISS (E5-Large: 1024 dims)"""
# #         all_data = list(self.collection.find())
# #         if not all_data:
# #             return 0
        
# #         self.all_windows = all_data
# #         # המרה למערך numpy בגודל 1024 (תואם ל-E5-Large)
# #         embeddings = np.array([w['embedding'] for w in all_data]).astype("float32")
        
# #         self.index = faiss.IndexFlatIP(embeddings.shape[1])
# #         self.index.add(embeddings)
# #         return len(all_data)

# #     def exact_search(self, query: str, limit=15):
# #         """חיפוש טקסטואלי ב-MongoDB (BM25/Text Index)"""
# #         cursor = self.collection.find(
# #             {"$text": {"$search": query}},
# #             {"score": {"$meta": "textScore"}}
# #         ).sort([("score", {"$meta": "textScore"})]).limit(limit)
# #         return list(cursor)

# #     def vector_search(self, query_vector, k=20):
# #         """חיפוש סמנטי ב-FAISS"""
# #         if self.index is None:
# #             return []
# #         D, I = self.index.search(np.array([query_vector]).astype("float32"), k)
# #         results = []
# #         for dist, idx in zip(D[0], I[0]):
# #             if idx != -1:
# #                 res = self.all_windows[idx].copy()
# #                 res["vector_score"] = float(dist)
# #                 results.append(res)
# #         return results


# # # # storage.py
# # # import json
# # # import os
# # # import faiss
# # # import numpy as np

# # # class Storage:
# # #     def __init__(self, index_dir: str):
# # #         self.index_dir = index_dir
# # #         self.all_windows = []
# # #         self.index = None

# # #     def load_all(self):
# # #         """
# # #         סורק את כל קבצי ה-JSON בתיקיית האינדקס, מאחד אותם 
# # #         ובונה אינדקס FAISS לחיפוש מהיר.
# # #         """
# # #         self.all_windows = []
# # #         all_embeddings = []
        
# # #         if not os.path.exists(self.index_dir):
# # #             print(f"Warning: Index directory not found at {self.index_dir}")
# # #             return 0
        
# # #         # סריקת כל קבצי ה-JSON בתיקייה
# # #         json_files = [f for f in os.listdir(self.index_dir) if f.endswith(".json")]
        
# # #         for file_name in json_files:
# # #             file_path = os.path.join(self.index_dir, file_name)
# # #             try:
# # #                 with open(file_path, 'r', encoding='utf-8') as f:
# # #                     data = json.load(f)
# # #                     for item in data:
# # #                         # שמירת המידע הגולמי (טקסט, זמנים וכו')
# # #                         self.all_windows.append(item)
# # #                         # איסוף הוקטורים לטובת בניית האינדקס
# # #                         all_embeddings.append(item['embedding'])
# # #             except Exception as e:
# # #                 print(f"Error loading {file_name}: {e}")

# # #         if all_embeddings:
# # #             # המרת רשימת הוקטורים למערך numpy
# # #             vectors = np.array(all_embeddings).astype("float32")
# # #             dim = vectors.shape[1]
            
# # #             # בניית אינדקס FAISS מסוג FlatIP (Inner Product) 
# # #             # מתאים לוקטורים שעברו נורמליזציה (כמו ב-E5) לחיפוש דמיון קוסינוס
# # #             self.index = faiss.IndexFlatIP(dim)
# # #             self.index.add(vectors)
            
# # #             return len(self.all_windows)
        
# # #         return 0

# # #     def search(self, query_vector, k=20):
# # #         """
# # #         מבצע חיפוש וקטורי ומחזיר את המועמדים הרלוונטיים ביותר.
# # #         """
# # #         if self.index is None or not self.all_windows:
# # #             return []

# # #         # FAISS מצפה למערך דו-מימדי
# # #         query_vector = np.array([query_vector]).astype("float32")
        
# # #         # חיפוש k השכנים הקרובים ביותר
# # #         distances, indices = self.index.search(query_vector, k)
        
# # #         results = []
# # #         for dist, idx in zip(distances[0], indices[0]):
# # #             if idx == -1: continue # מקרה של חוסר בתוצאות
            
# # #             # שכפול האובייקט והוספת ציון המרחק הוקטורי
# # #             res = self.all_windows[idx].copy()
# # #             res["vector_score"] = float(dist)
# # #             results.append(res)
            
# # #         return results
# # # # # storage.py
# # # # import json
# # # # import faiss
# # # # import numpy as np

# # # # class Storage:
# # # #     def __init__(self):
# # # #         self.windows = []
# # # #         self.index = None

# # # #     def load(self, json_path: str):
# # # #         with open(json_path, "r", encoding="utf-8") as f:
# # # #             self.windows = json.load(f)

# # # #         vectors = np.array([w["embedding"] for w in self.windows]).astype("float32")
# # # #         dim = vectors.shape[1]
# # # #         self.index = faiss.IndexFlatIP(dim)
# # # #         self.index.add(vectors)

# # # #     def search(self, query_vector, k=30):
# # # #         D, I = self.index.search(
# # # #             np.array([query_vector]).astype("float32"), k
# # # #         )
# # # #         return [self.windows[i] for i in I[0]]
