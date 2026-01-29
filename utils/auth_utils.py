from passlib.context import CryptContext
from datetime import datetime, timedelta
from google.oauth2 import id_token
from google.auth.transport import requests
import jwt
import os

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto") #sets password hashing algorithem
SECRET_KEY = os.getenv("SECRET_KEY") 
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS"))
ALGORITHM = "HS256"

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")



def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy() # define payload 
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)) # define token expiration time
    to_encode.update({"exp": expire}) # set token expiration time
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM) 


def create_refresh_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_access_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"]) #extract the saved info in the token 
        return payload
    except jwt.ExpiredSignatureError: #expiration time passed
        return None
    except jwt.InvalidTokenError: #invalid token
        return None
    

def verify_refresh_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"]) #extract the saved info in the token 
        return payload
    except jwt.ExpiredSignatureError: #expiration time passed
        return None
    except jwt.InvalidTokenError: #invalid token
        return None


def verify_google_token(token: str) -> dict:
    """
    Verify Google ID token and extract user information.
    Returns dict with user info: email, given_name, family_name
    """
    try:
        idinfo = id_token.verify_oauth2_token(
            token, 
            requests.Request(), 
            GOOGLE_CLIENT_ID
        )
        
        # Token is valid, return user info
        return {
            "email": idinfo["email"],
            "given_name": idinfo.get("given_name", ""),
            "family_name": idinfo.get("family_name", "")
        }
    except ValueError as e:
        # Invalid token
        raise ValueError(f"Token verification failed: {str(e)}")

