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
    

def delete_call_service(user_id: str, original_name: str):
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
    query = {
        "user_id": user_id, 
        "original_name": original_name
    }
    
    record = db.calls_collection.find_one(query)
    
    if not record:
        print(f"FAILED: No record for user {user_id} with name {original_name}")
        return False
    
    record_id = str(record["_id"])
    operator = "$addToSet" if action == "add" else "$pull"
    
    result = db.users_collection.update_one(
        {"_id": ObjectId(user_id)}, 
        {operator: {"favorites": record_id}}
    )
    
    # This ensures "Success" even if the item was already in favorites.
    return result.matched_count > 0

