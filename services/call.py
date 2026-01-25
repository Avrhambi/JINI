import config.db as db
from bson import ObjectId
import requests
import os
from bson import ObjectId


# Base route for the search backend service
SEARCH_SERVICE_URL = "http://localhost:5000" 

def upload_call_to_search_service(user_id: str, file, metadata: dict):
    # 1. שליחת הקובץ והמשתמש ל-Search Backend
    files = {'file': (file.filename, file.file, file.content_type)}
    # שליחת user_id בשדה נפרד כפי שהשרת מצפה
    data = {'user_id': user_id} 
    
    try:
        response = requests.post(f"{SEARCH_SERVICE_URL}/upload", files=files, data=data, timeout=None)
        
        # תמיכה גם ב-200 (הצליח מיד) וגם ב-202 (התקבל לעיבוד)
        if response.status_code == 200:
            transcript = response.json().get("transcript", "")
            
            # 2. שמירת הרשומה המלאה ב-MongoDB המרכזי של הפרויקט
            call_doc = {
                "user_id": user_id,
                "original_name": metadata['original_name'],
                "visibile_name": metadata['display_name'],
                "number": metadata['number'],
                "type": metadata['type'],
                "caller": metadata['caller_name'],
                "date": metadata['date'],
                "file_path": metadata['file_path'],
                "transcript": transcript 
            }
            db.calls_collection.insert_one(call_doc)
            return transcript 
            
    except Exception as e:
        print(f"Upload Failed: Error connecting to search service: {e}")
        
    return None

def search_calls_service(user_id: str, query: str):
    # קריאה לשרת החיפוש עם סינון המשתמש המובנה
    params = {"q": query, "user_id": user_id}
    try:
        response = requests.get(f"{SEARCH_SERVICE_URL}/search", params=params)
        
        if response.status_code != 200:
            return []

        raw_results = response.json().get("results", [])
        
        # ארגון התוצאות: קבוצה לכל קובץ עם רשימת זמנים
        grouped = {}
        for res in raw_results:
            f_name = res['file_name']
            if f_name not in grouped:
                grouped[f_name] = {"file_name": f_name, "time_stamps": []}
            # הוספת זמן ההתחלה לרשימת ה-timestamps של הקובץ
            grouped[f_name]["time_stamps"].append(res['start'])
        
        return list(grouped.values())
    except Exception as e:
        print(f"Error during search: {e}")
        return []
    
# from config.db import db
# from bson import ObjectId
# import requests
# import os


# # Base route for the search backend service
# SEARCH_SERVICE_URL = "http://localhost:5000" 

# def upload_call_to_search_service(user_id: str, file, metadata: dict):
#     # 1. Forward file and user context to search backend
#     files = {'file': (file.filename, file.file, file.content_type)}
#     data = {'user_id': user_id, 'metadata': str(metadata)}
    
#     response = requests.post(f"{SEARCH_SERVICE_URL}/upload", files=files, data=data)
    
#     if response.status_code == 200:
#         # 2. Search backend returns the transcript after processing
#         transcript = response.json().get("transcript", "")
        
#         # 3. Save the full record in your main DB
#         call_doc = {
#             "user_id": user_id,
#             "original_name": metadata['original_name'],
#             "visibile_name": metadata['display_name'],
#             "number": metadata['number'],
#             "tpye": metadata['tpye'],
#             "caller": metadata['caller_name'],
#             "date": metadata['date'],
#             "file_path": metadata['file_path'],
#             "transcript": transcript
#         }
#         db.calls.insert_one(call_doc)
#         return transcript
#     return None

# def search_calls_service(user_id: str, query: str):
#     # Call search backend with user filter
#     params = {"q": query, "user_id": user_id}
#     response = requests.get(f"{SEARCH_SERVICE_URL}/search", params=params)
    
#     if response.status_code != 200:
#         return []

#     raw_results = response.json().get("results", [])
    
#     # Transform results: group by file_name and collect timestamps
#     grouped = {}
#     for res in raw_results:
#         f_name = res['file_name']
#         if f_name not in grouped:
#             grouped[f_name] = {"file_name": f_name, "time_stamps": []}
#         grouped[f_name]["time_stamps"].append(res['start'])
    
#     return list(grouped.values())



def delete_call_service(user_id: str, original_name: str):
    # delete call from userfavorites
    query = {
        "user_id": user_id, 
        "original_name": original_name
    }

    record = db.calls_collection.find_one(query)
    record_id = str(record["_id"])

    result = db.users_collection.update_one(
        {"_id": ObjectId(user_id)}, 
        {"$pull": {"favorites": record_id}}
    )
    
    result = db.calls_collection.delete_one({"user_id": user_id, "original_name": original_name})
    return result.deleted_count > 0

def update_call_name_service(user_id: str, original_name: str, new_name: str):
    return db.calls_collection.find_one_and_update(
        {"user_id": user_id, "original_name": original_name},
        {"$set": {"visibile_name": new_name}},
        return_document=True
    )


def toggle_favorite_service(user_id: str, original_name: str, action: str):
    # 1. Step 1: Find the record
    # We use user_id as a string because your upload service saves it as a string
    query = {
        "user_id": user_id, 
        "original_name": original_name
    }
    
    record = db.calls_collection.find_one(query)
    
    # Debug print to see what's happening in logs
    if not record:
        print(f"FAILED: No record for user {user_id} with name {original_name}")
        return False
    
    # 2. Step 2: Update the User's favorites list
    # Use the _id from the record we just found
    record_id = str(record["_id"])
    operator = "$addToSet" if action == "add" else "$pull"
    
    # Update the users_collection (matching your create_user_service)
    result = db.users_collection.update_one(
        {"_id": ObjectId(user_id)}, 
        {operator: {"favorites": record_id}}
    )
    
    # Return matched_count > 0. 
    # This ensures "Success" even if the item was already in favorites.
    return result.matched_count > 0

# def toggle_favorite_service(user_id: str, original_name: str, action: str):
#     # Step 1: Find the record to get its unique database ID
#     # record = db.calls_collection.find_one({"user_id": user_id, "original_name": original_name})
#     # if not record:
#     #     return False
    
#     # # Step 2: Use that ID to update the User's favorites list
#     # record_id = str(record["_id"])
#     # operator = "$addToSet" if action == "add" else "$pull"
    
#     # result = db.users.update_one(
#     #     {"_id": ObjectId(user_id)},
#     #     {operator: {"favorites": record_id}}
#     # )
#     # Step 1: Cast the string ID to a MongoDB ObjectId
#     try:
#         obj_user_id = ObjectId(user_id)
#     except:
#         # If user_id isn't a valid hex string, it won't be found anyway
#         return False

#     # Try searching with the ObjectId instead of the string
#     record = db.calls_collection.find_one({
#         "user_id": obj_user_id, # Use the converted ID here
#         "original_name": original_name
#     })
    
#     if not record:
#         # Fallback: Check if it was accidentally saved as a string
#         record = db.calls_collection.find_one({
#             "user_id": user_id, 
#             "original_name": original_name
#         })
        
#     if not record:
#         return False
    
#     return result.modified_count > 0

def get_user_favorites_service(user_id: str):
    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user or not user.get("favorites"):
        return []
    
    call_ids = [ObjectId(f_id) for f_id in user["favorites"]]
    calls = list(db.calls_collection.find({"_id": {"$in": call_ids}}))
    
    for call in calls:
        call["_id"] = str(call["_id"])
        call.pop("user_id", None)
        call.pop("call_id", None)
    return calls


# from typing import List, Optional
# from bson import ObjectId
# import numpy as np
# from models.call import CallRecord, CallRecordInput, SearchResultResponse
# from utils.search_index import SearchIndexManager
# from services.user import get_user_by_id
# from config import db

# def get_call_by_id(call_id: str) -> Optional[CallRecord]:
#     """Return the call from MongoDB by ObjectId, or None if not found."""
#     try:
#         obj_id = ObjectId(call_id)
#     except Exception:
#         return None

#     data = db.calls_collection.find_one({"_id": obj_id})
#     if not data:
#         return None

#     return CallRecord(**data)

# def add_to_favorites_service(user_id: str, call_id: str) -> dict:
#     """Add a call to user's favorites"""
#     user = get_user_by_id(user_id)
#     if not user:
#         raise Exception("User not found")
    
#     if call_id in user.favorites:
#         raise Exception("Call already in favorites")

#     user.favorites.append(call_id)
#     db.users_collection.update_one(
#         {"_id": user.id},
#         {"$set": {"favorites": user.favorites}}
#     )

#     return {"success": True, "favorites": user.favorites}

# def remove_from_favorites_service(user_id: str, call_id: str) -> dict:
#     """Remove a call from user's favorites"""
#     user = get_user_by_id(user_id)
#     if not user:
#         raise Exception("User not found")

#     if call_id not in user.favorites:
#         raise Exception("Call not in favorites")

#     user.favorites.remove(call_id)
#     db.users_collection.update_one(
#         {"_id": user.id},
#         {"$set": {"favorites": user.favorites}}
#     )

#     return {"success": True, "favorites": user.favorites}

# def get_favorites_list_service(user_id: str) -> List[CallRecord]:
#     """Get all favorite calls for a user"""
#     user = get_user_by_id(user_id)
#     if not user:
#         raise Exception("User not found")
    
#     favorites_calls = []
#     for call_id in user.favorites:
#         call = get_call_by_id(call_id)
#         if call:
#             favorites_calls.append(call)
    
#     return favorites_calls

# def get_user_calls_service(user_id: str) -> List[CallRecord]:
#     """Get all call records for a user from MongoDB"""
#     call_docs = db.calls_collection.find({"user_id": user_id}).sort("created_at", -1)
#     return [CallRecord(**doc) for doc in call_docs]

# def create_call_record_service(
#     call_data: CallRecordInput,
#     search_manager: SearchIndexManager
# ) -> CallRecord:
#     """
#     יצירת רשומה, תמלול, אינדוקס ושמירה היררכית ב-MongoDB.
#     """
#     call = CallRecord(
#         user_id=call_data.user_id,
#         caller=call_data.caller,
#         audio_file_path=call_data.audio_file_path,
#         duration=call_data.duration,
#         transcript="",
#         segments_record=[]
#     )

#     # Insert to DB
#     result = db.calls_collection.insert_one(call.model_dump(exclude={"id"}, by_alias=True))
#     call.id = result.inserted_id


#     # Transcribe and index
#     transcript, parent_chunks = search_manager.add_call_to_index(call.id, call.audio_file_path)

#     # Crucial: Ensure the update object is JSON serializable (no NumPy types)
#     db.calls_collection.update_one(
#         {"_id": call.id},
#         {"$set": {
#             "transcript": transcript, 
#             "segments_record": parent_chunks
#         }}
#     )

#     call.transcript = transcript
#     call.segments_record = parent_chunks

#     return call

# def search_calls_service(
#     query: str,
#     search_manager: SearchIndexManager,
#     user_id: Optional[str] = None,
#     k: int = 5
# ) -> List[SearchResultResponse]:
#     """
#     Perform semantic search and enrich results with metadata from MongoDB.
#     """
#     # 1. Retrieve the top K hits from the SearchIndexManager (FAISS + Reranker)
#     search_results = search_manager.search_precise(query, k=k)
    
#     responses: List[SearchResultResponse] = []
#     call_cache = {} # Prevents redundant DB lookups for the same call
    
#     for res in search_results:
#         call_id = res.get("call_id")
        
#         # 2. Fetch call metadata from DB or Cache
#         call = call_cache.get(call_id)
#         if not call:
#             call = get_call_by_id(call_id)
#             if not call:
#                 continue
#             call_cache[call_id] = call
        
#         # 3. Security: Filter results by user_id if provided
#         if user_id and call.user_id != user_id:
#             continue
        
#         # 4. Construct the response model
#         # Explicitly cast to native Python floats to prevent NumPy serialization errors
#         responses.append(SearchResultResponse(
#             call_id=str(call_id),
#             text=res.get("text"),
#             start_time=float(res.get("start", 0.0)),
#             end_time=float(res.get("end", 0.0)),
#             score=float(res.get("score", 0.0)),
#             caller=call.caller,
#             created_at=call.created_at
#         ))
    
#     return responses
