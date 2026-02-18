import config.db as db
from bson import ObjectId
import os
import httpx


# Base route for the search engine service
SEARCH_SERVICE_URL = "http://localhost:5000" 


async def upload_call_to_search_service(user_id: str, file, metadata: dict):
    # Use AsyncClient to prevent blocking the server
    async with httpx.AsyncClient(timeout=None) as client:
        files = {'file': (file.filename, file.file, file.content_type)}
        data = {'user_id': user_id} 
        try:
            response = await client.post(f"{SEARCH_SERVICE_URL}/upload", files=files, data=data)
            
            if response.status_code == 200:
                transcript = response.json().get("transcript", "")
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
            print(f"Upload Failed: {e}")
    return None


async def search_calls_service(user_id: str, query: str):
    params = {"q": query, "user_id": user_id}
    timeout = httpx.Timeout(60.0, connect=10.0)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(f"{SEARCH_SERVICE_URL}/search", params=params)
        
        if response.status_code != 200:
            print(f"Search server returned error: {response.status_code}")
            return []

        raw_results = response.json().get("results", [])
        grouped = {}
        for res in raw_results:
            f_name = res.get('file_name', 'unknown_file')
            start_time = res.get('start', 0)

            if f_name not in grouped:
                grouped[f_name] = {"file_name": f_name, "time_stamps": []}

            grouped[f_name]["time_stamps"].append(start_time)
        
        return list(grouped.values())
    except httpx.ReadTimeout:
        print("Search engine took too long to respond (Timeout)")
        return []
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

    # CEHCK if action is ALREATY in favorites
    user = db.users_collection.find_one({"_id": ObjectId(user_id)})
    favorite_ids = user.get("favorites", [])
    
    if action == "add" and record_id in favorite_ids:
        print(f"FAILED: Record {original_name} is already in favorites for user {user_id}")
        return False
    
    if action == "remove" and record_id not in favorite_ids:
        print(f"FAILED: Record {original_name} is not in favorites for user {user_id}")
        return False
    
    result = db.users_collection.update_one(
        {"_id": ObjectId(user_id)}, 
        {operator: {"favorites": record_id}}
    )
    
    return result.matched_count > 0


def get_user_favorites_service(user_id: str):
    user = db.users_collection.find_one({"_id": ObjectId(user_id)})
    favorite_ids = user.get("favorites", [])

    favorite_files = []
    for id in favorite_ids:
        record = db.calls_collection.find_one({"_id": ObjectId(id), "user_id": user_id})
        if record:
            favorite_files.append(record["original_name"])
    
    return favorite_files