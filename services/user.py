import config.db as db 
from models.user import User
from models.auth import SignupRequest
from pymongo.errors import DuplicateKeyError
from bson import ObjectId
from utils.auth_utils import hash_password



def create_user_service(user: dict) -> User:
    """
    Insert a new user into the database.
    Handles password hashing, duplicate email checks, and returns User with id.
    """
    password = user.get("password")
    hashed_password = None
    if password:
        hashed_password = hash_password(password)

    # Convert to User object
    new_user = User(
        first_name=user.get("first_name"),
        last_name=user.get("last_name"),
        username=user.get("username"),
        email=user.get("email"),
        password=hashed_password
    )
    
    # Insert into DB
    try:
        result = db.users_collection.insert_one(new_user.dict(exclude={"id"}))
        new_user.id = str(result.inserted_id)
        return new_user
    except DuplicateKeyError:
        raise 

    
def get_user_by_email(email: str):
    """
    Return user object from MongoDB by email, or None if not found.
    """
    user_dict = db.users_collection.find_one({"email": email}) 
    
    if not user_dict:
        return None

    # convert filed for db compatibility
    user_dict["_id"] = str(user_dict["_id"])
    
    return User(**user_dict) # unpack dict into User model


def get_user_by_id(user_id: str):
    """
    Return the user from MongoDB by ObjectId, or None if not found.
    """
    try:
        obj_id = ObjectId(user_id)
    except Exception:
        return None  # invalid id format

    # fetch user document
    user_dict = db.users_collection.find_one({"_id": obj_id})
    
    if not user_dict:
        return None

    # convert filed for db compatibility
    user_dict["_id"] = str(user_dict["_id"])
    
    
    return User(**user_dict) # unpack dict into User model


def delete_user_service(user_id: str) -> bool:
    db.calls_collection.delete_many({"user_id": user_id}) # Delete User's call records 
    result = db.users_collection.delete_one({"_id": ObjectId(user_id)}) 
    return result.deleted_count > 0 # True if a user was deleted


def update_user_service(user_id: str, update_data: dict):
    """
    Updates specific user fields (username/password) in MongoDB.
    Expects update_data to already contain the hashed password if changed.
    """
    # Filter out None values to prevent overwriting existing data with nulls
    clean_data = {k: v for k, v in update_data.items() if v is not None}
    
    if not clean_data:
        return None

    # Perform the update in the 'users' collection
    result = db.users_collection.find_one_and_update(
        {"_id": ObjectId(user_id)},
        {"$set": clean_data},
        return_document=True  # Returns the updated document instead of the old one
    )
    
    # 3. Handle Pydantic compatibility by converting ObjectId to string
    if result:
        result["_id"] = str(result["_id"]) 
        return result
        
    return None