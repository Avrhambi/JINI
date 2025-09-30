from fastapi import APIRouter
from models.auth import SignupRequest
from controllers.auth import *
from middleware.auth import auth_refresh_token

auth_router = APIRouter()

@auth_router.post("/signup")
def signup(user: SignupRequest):
    return auth_signup(user)

@auth_router.post("/login")
def login(user: LoginRequest):
    return auth_login(user)

#To do
@auth_router.post("/login/google")
def login(google_token: str):
    return auth_google_login(google_token)


@auth_router.post("/auth/refresh")
def refresh_token(refresh_token: str):
    return auth_refresh_token(refresh_token)