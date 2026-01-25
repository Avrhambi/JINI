import config.db as db 
from models.user import User
from models.auth import SignupRequest
from pymongo.errors import DuplicateKeyError
from bson import ObjectId
from utils.auth_utils import hash_password
from pymongo.errors import DuplicateKeyError as MongoDuplicateKeyError



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
        # MongoDB will throw this automatically because of the unique index
        raise

    
def create_google_user(google_info: dict) -> User:
    """
    Create a new user from Google OAuth data.
    No password needed for Google users.
    """
    new_user = User(
        first_name=google_info["given_name"],
        last_name=google_info["family_name"],
        email=google_info["email"],
        password=None  # Google users don't have passwords
    )
    
    try:
        result = db.users_collection.insert_one(new_user.dict(exclude={"id"}))
        new_user.id = str(result.inserted_id)
        return new_user
    except DuplicateKeyError:
        raise

# def get_user_by_email(email: str):
#     """
#     Return user object from MongoDB by email, or None if not found.
#     """
#     user_dict = db.users_collection.find_one({"email": email}) # DB returns user dictionary
#     if not user_dict:
#         return None
#     user_dict["id"] = str(user_dict["_id"])  # convert ObjectId to string
#     return User(**user_dict) # converts a dict into named arguments for the constructor
def get_user_by_email(email: str):
    """
    Return user object from MongoDB by email, or None if not found.
    """
    # 1. שליפת המילון מה-DB
    user_dict = db.users_collection.find_one({"email": email}) 
    
    if not user_dict:
        return None

    # 2. המרה של ה-ObjectId למחרוזת (String) בתוך השדה המקורי
    # זה מונע את השגיאה: Input should be a valid string
    user_dict["_id"] = str(user_dict["_id"])
    
    # 3. יצירת האובייקט - Pydantic ימפה את "_id" ל-"id" אוטומטית
    return User(**user_dict)

def get_user_by_id(user_id: str):
    """
    Return the user from MongoDB by ObjectId, or None if not found.
    """
    try:
        obj_id = ObjectId(user_id)
    except Exception:
        return None  # invalid id format

    # 1. שליפת המילון הגולמי מהמסד
    user_dict = db.users_collection.find_one({"_id": obj_id})
    
    if not user_dict:
        return None

    # 2. המרה של ה-ObjectId למחרוזת (String)
    # זה השלב שפותר את ה-ValidationError שקיבלת
    user_dict["_id"] = str(user_dict["_id"])
    
    # 3. יצירת אובייקט ה-User כעת כשהנתונים בפורמט הנכון
    return User(**user_dict)

# def get_user_by_id(user_id: str):
#     """
#     Return the user from MongoDB by ObjectId, or None if not found.
#     """
#     try:
#         obj_id = ObjectId(user_id)
#     except Exception:
#         return None  # invalid id format

#     return User(**(db.users_collection.find_one({"_id": obj_id})))


def get_user_by_google_id(google_id:str) -> User:
    """
    Return the user from google id, or None if not found.
    """
    return User(**db.users_collection.find_one({"google_id": google_id}))


def delete_user_service(user_id: str) -> bool:
    # Delete associated call records first for data integrity
    db.calls_collection.delete_many({"user_id": user_id})
    result = db.users_collection.delete_one({"_id": ObjectId(user_id)})
    return result.deleted_count > 0


def update_user_service(user_id: str, update_data: dict):
    """
    Updates specific user fields (username/password) in MongoDB.
    Expects update_data to already contain the hashed password if changed.
    """
    # 1. Filter out None values to prevent overwriting existing data with nulls
    clean_data = {k: v for k, v in update_data.items() if v is not None}
    
    if not clean_data:
        return None

    # 2. Perform the update in the 'users' collection
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