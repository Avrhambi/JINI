from fastapi import APIRouter, Form
from models.auth import SignupRequest, GoogleLoginRequest
from controllers.auth import *
from middleware.auth import auth_refresh_token


auth_router = APIRouter()

@auth_router.post("/signup")
def signup(user: SignupRequest):
    return auth_signup(user)


@auth_router.post("/login")
def login(user: LoginRequest):
    return auth_login(user)


@auth_router.post("/login/google")
def google_login(request: GoogleLoginRequest):
    return auth_google_login(request.id_token)


@auth_router.post("/refresh")
def refresh_token(
    refresh_token: str = Form(...)
):
    return auth_refresh_token(refresh_token)