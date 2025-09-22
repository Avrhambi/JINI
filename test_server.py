from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import FastAPI, HTTPException, Header,Depends
from pydantic import BaseModel
import jwt
from datetime import datetime, timedelta
from routes.auth import auth_router
from config import db
from models.auth import LoginRequest
from services.user import get_user_by_email
from utils.auth_utils import verify_password
from middleware.auth import verify_token
import os

app = FastAPI()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_TIME = 10
REFRESH_TOKEN_EXPIRE_TIME = 180

# -------------------
# Token functions
# -------------------

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(seconds=ACCESS_TOKEN_EXPIRE_TIME))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(seconds=REFRESH_TOKEN_EXPIRE_TIME))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_access_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def verify_refresh_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

# -------------------
# Test routes
# -------------------

app.include_router(auth_router, prefix="/auth", tags=["auth"])
auth_scheme = HTTPBearer() 

#check connection to DB
@app.on_event("startup")
def startup_db_client():
    try:
        db.init_db()
        db.client.admin.command("ping")   #ping to Db
        print("✅ Connected to MongoDB!")
    except Exception as e:
        print("❌ Could not connect to MongoDB:", e)
        raise

#login
@app.post('/login')
def login(user_data: LoginRequest):
    """
    Authenticate user and return identification info + JWT token
    """
    print("/login")
    try:
        user = get_user_by_email(user_data.Email) 
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=f"Internal Server error: {str(e)}" ) 

    if not user:
        raise HTTPException(status_code=401, detail="Invalid Email")
    
    # Only verify password if user has one
    if user.Password and not verify_password(user_data.Password, user.Password):
        print("Invalid Password")
        raise HTTPException(status_code=401, detail="Invalid Password")

    access_token = create_access_token({"user_id": user.ID})
    refresh_token = create_refresh_token({"user_id": user.ID})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user.ID,
            "first_name": user.FirstName,
            "last_name": user.LastName
        }
    }

# Verify Access Token
@app.get("/test/access")
def test_access_token(credentials: HTTPAuthorizationCredentials = Depends(auth_scheme)):
    token = credentials.credentials  # the raw access token string
    payload = verify_access_token(token)
    if not payload:
        print("Access token invalid or expired")
        raise HTTPException(status_code=401, detail="Access token invalid or expired")
    return {"message": "Access token valid", "payload": payload}

#create 
class TokenRequest(BaseModel):
    refresh_token: str

# Verify Refresh Token
@app.post("/test/refresh")
def test_refresh_body(token_request: TokenRequest):
    payload = verify_refresh_token(token_request.refresh_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Refresh token invalid or expired")
    return {"message": "Refresh token valid", "payload": payload}

# Generate new Access Token using Refresh Token
@app.post("/test/new_access")
def generate_new_access(token_request: TokenRequest):
    payload = verify_refresh_token(token_request.refresh_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    
    new_access_token = create_access_token({"user_id": payload.get("user_id")})
    return {"access_token": new_access_token, "token_type": "bearer"}


@app.get("/test/protected_request")
def protected_request(user=Depends(verify_token)):
    return {"message": "Protected request successful ✅", "user": {"id": user.id, "email": user.email}}
 