from fastapi import HTTPException
from models.auth import SignupRequest
from services.user import create_user_service, get_user_by_email, verify_google_token
from utils.auth_utils import *
from pymongo.errors import DuplicateKeyError
from models.auth import LoginRequest
from google.oauth2 import id_token
from google.auth.transport import requests
from fastapi import HTTPException
from models.user import User
import config.db as db 

GOOGLE_CLIENT_ID = SECRET_KEY = os.getenv("GOOGLE_CLIENT_ID")


def generate_auth_response(user: User) -> dict:
    """
    Generate standardized auth response with tokens and user info.
    Used by both regular login/signup and Google login.
    """
    access_token = create_access_token({"user_id": user.id})
    refresh_token = create_refresh_token({"user_id": user.id})
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email
        }
    }

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
    
    return  generate_auth_response(new_user)



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
    
    return  generate_auth_response(user)



def auth_google_login(token: str):
    """
    Handles Google OAuth login - creates new user if doesn't exist, 
    or logs in existing user using email as the identifier.
    Returns same structure as regular login/signup.
    """
    try:
        # Verify the Google token and extract user info
        google_user_info = verify_google_token(token)
        
        # Check if user exists by email
        user = get_user_by_email(google_user_info["email"])
        
        if user:
            # Existing user 
            return generate_auth_response(user)
        else:
            # New user 
            user_data = {
                    "first_name": google_user_info["given_name"],
                    "last_name": google_user_info["family_name"],
                    "email": google_user_info["email"],
                    "password": None,  # No password for Google users
                    "username": None   # Optional
                }
            
            new_user = create_user_service(user_data)
            return generate_auth_response(new_user)
            
    except ValueError as e:
        # Invalid token
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {str(e)}")
    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail="Email already registered")
    except Exception as e:
        print(f"Google login error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")





