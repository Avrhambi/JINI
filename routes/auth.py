from fastapi import APIRouter, Depends
from models.auth import SignupRequest, LoginResponse
from controllers.auth import *
from middleware.auth import verify_token

auth_router = APIRouter()

@auth_router.post("/signup")
def signup(user: SignupRequest):
    return auth_signup(user)

@auth_router.post("/login")
def login(user: LoginRequest):
    return auth_login(user)

@auth_router.post("/login/google")
def login(google_token: str):
    return auth_google_login(google_token)

@auth_router.post("/logout")    
def logout(user: LoginResponse = Depends(verify_token)):
    """
    Logs out the user.
    Since JWT is stateless, logout just means the client should delete the token.
    """
    return {"message": f"User {user.username} logged out successfully. Remove token from client."}
    
@auth_router.post("/auth/refresh")
def refresh_token(refresh_token: str):
    return auth_refresh_token(refresh_token)