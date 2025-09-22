from models.call import CallRecord
from config import db
from bson import ObjectId
from services.user import get_user_by_id

def get_call_by_id(call_id: str):
    """
    Return the call from MongoDB by ObjectId, or None if not found or invalid ID.
    """
    try:
        obj_id = ObjectId(call_id)
    except Exception:
        return None  # invalid ID format

    data = db.users_collection.find_one({"_id": obj_id})
    if not data:
        return None

    return CallRecord(**data)

def add_to_favorites_service(user_id: str, call_id: str) -> dict:
        # find user
        user = get_user_by_id(user_id)
        if not user:
            return {"success": False, "message": "User not found"}
        
        # check if call already in the list
        if call_id in user.favorites:
            return {"success": False, "message": "Call already in favorites"}

        # add call to user's favorites
        user.favorites.append(call_id)
        db.save_user(user)

        return {
            "success": True,
            "favorites": user.favorites
        }
    
def remove_from_favorites_service(user_id: str, call_id: str) -> dict:
        # find user
        user = get_user_by_id(user_id)
        if not user:
            return {"success": False, "message": "User not found"}
        

        # check if call not in the list
        if call_id not in user.favorites:
            return {"success": False, "message": "Call not in favorites"}

        # remove call from user's favorites
        user.favorites.remove(call_id)
        db.save_user(user)

        return {
            "success": True,
            "favorites": user.favorites
        }

def get_favorites_list_service(user_id):
    # find user
    user = get_user_by_id(user_id)
    if not user:
        return {"success": False, "message": "User not found"}
    
    favorites = user["favorites"]
    return {"success": True, "favorites": favorites}
     

    
