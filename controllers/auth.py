from fastapi import HTTPException
from models.auth import SignupRequest
from services.user import create_user_service, get_user_by_email, get_user_by_google_id
from utils.auth_utils import *
from pymongo.errors import DuplicateKeyError
from models.auth import LoginRequest



def auth_signup(user: SignupRequest):
    """
    creates user, creates JWT token and auto login user.
    """
    try:
        new_user = create_user_service(user.dict())
    except DuplicateKeyError:
        raise HTTPException(status_code=400,detail="Email already registered")
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=f"Internal Server error: {str(e)}" )
    
    access_token = create_access_token({"user_id": new_user.id})
    refresh_token = create_refresh_token({"user_id": new_user.id})

    

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": new_user.id,
            "first_name": new_user.first_name,
            "last_name": new_user.last_name,
            "email": new_user.email,
        }
    }


def auth_login(user_data: LoginRequest):
    """
    Authenticate user and return identification info + JWT token
    """
    try:
        user = get_user_by_email(user_data.email) 
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=f"Internal Server error: {str(e)}" ) 

    if not user:
        print("Invalid email")
        raise HTTPException(status_code=401, detail="Invalid email")
    
    # Only verify password if user has one
    if user.password and not verify_password(user_data.password, user.password):
        print("Invalid password")
        raise HTTPException(status_code=401, detail="Invalid password")

    access_token = create_access_token({"user_id": user.id})
    refresh_token = create_refresh_token({"user_id": user.id})


    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name
        }
    }



def auth_google_login(google_token: str):
    pass
 

