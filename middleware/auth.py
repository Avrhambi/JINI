from services.user import get_user_by_id
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from utils.auth_utils import *


         
auth_scheme = HTTPBearer()  # extract token from Authorization header

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(auth_scheme)):
    """
    Dependency to verify JWT token and return user details.
    Raises HTTPException if invalid.
    """
    print(credentials)
    token = credentials.credentials
    payload = verify_access_token(token) 

    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = get_user_by_id(payload["user_id"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user


def auth_refresh_token(refresh_token: str):
    try:
        payload = verify_refresh_token(refresh_token)
        user_id = payload["user_id"]
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        
        new_access_token = create_access_token({"user_id": user_id})
        return {"access_token": new_access_token, "token_type": "bearer"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    