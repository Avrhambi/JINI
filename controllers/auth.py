from fastapi import HTTPException
from models.auth import SignupRequest
from services.user import create_user_service, get_user_by_email, get_user_by_google_id
from utils.auth_utils import *
from pymongo.errors import DuplicateKeyError
from models.auth import LoginRequest,LoginResponse

def auth_signup(user: SignupRequest):
    """
    creates user, creates JWT token and auto login user.
    """
    try:
        new_user = create_user_service(user.dict())
    except DuplicateKeyError:
        raise HTTPException(status_code=400,detail="Email already registered")


    return {
        "data": {
            "id": new_user.id,
            "username": new_user.username,
            "email": new_user.email,
        },
    }


def auth_login(user_data: LoginRequest):
    """
    Authenticate user and return identification info + JWT token
    """
    user = get_user_by_email(user_data.email)  

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Only verify password if user has one
    if user.password and not verify_password(user_data.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token = create_access_token({"user_id": user.id})
    refresh_token = create_refresh_token({"user_id": user.id})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email
        }
    }


def auth_google_login(google_token: str):
    """
    Authenticate or register a user using Google OAuth token.
    """
    # Verify Google token
    user_info = verify_google_token(google_token)
    if not user_info:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    google_id = user_info['google_id']
    email = user_info['email']
    name = user_info.get('name')

    # Check if user exists by Google ID
    user = get_user_by_google_id(google_id)

    if not user:
        # Check if user exists by email to prevent users duplication
        user = get_user_by_email(email)
        if user:
            raise HTTPException(status_code=400, detail="Email already registered with password")

        # Create new user
        try:
            user_data = {
                "email": email,
                "username": name or email.split("@")[0],
                "google_id": google_id,
                "password": None  # Google users do not have password
            }
            user = create_user_service(user_data)
        except DuplicateKeyError:
            raise HTTPException(status_code=400, detail="User already exists")

    # Generate JWT for the app
    access_token = create_access_token({"user_id": user.id})
    refresh_token = create_refresh_token({"user_id": user.id})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email
        }
    }


def auth_refresh_token(refresh_token: str):
    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        # Create new access token
        new_access_token = create_access_token({"user_id": user_id})
        return {"access_token": new_access_token, "token_type": "bearer"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    
    