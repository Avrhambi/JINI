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


def get_user_by_email(email: str):
    """
    Return user object from MongoDB by email, or None if not found.
    """
    user_dict = db.users_collection.find_one({"email": email}) # DB returns user dictionary
    if not user_dict:
        return None
    user_dict["id"] = str(user_dict["_id"])  # convert ObjectId to string
    return User(**user_dict) # converts a dict into named arguments for the constructor


def get_user_by_id(user_id: str):
    """
    Return the user from MongoDB by ObjectId, or None if not found.
    """
    try:
        obj_id = ObjectId(user_id)
    except Exception:
        return None  # invalid id format

    return User(**(db.users_collection.find_one({"_id": obj_id})))


def get_user_by_google_id(google_id:str) -> User:
    """
    Return the user from google id, or None if not found.
    """
    return User(**db.users_collection.find_one({"google_id": google_id}))