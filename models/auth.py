from pydantic import BaseModel
from typing import Optional


class SignupRequest(BaseModel):
    username: Optional[str] = None
    email: str
    password: Optional[str] = None  # optional for Google account
    google_id: Optional[str] = None  # for Google login

class LoginRequest(BaseModel):
    email: str
    password: Optional[str] = None  # optional for Google account


class LoginResponse(BaseModel):
    id: str
    username: Optional[str] = None
    email: str
    token: str