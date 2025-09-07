from services.user import get_user_by_id
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from utils.auth_utils import verify_access_token

         
auth_scheme = HTTPBearer()  # extract token from Authorization header

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(auth_scheme)):
    """
    Dependency to verify JWT token and return user details.
    Raises HTTPException if invalid.
    """
    token = credentials.credentials
    payload = verify_access_token(token)  # call the function

    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = get_user_by_id(payload["user_id"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user