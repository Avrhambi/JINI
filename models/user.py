from pydantic import BaseModel, Field
from typing import Optional, List


# User model
class User(BaseModel):
    id: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    email: str
    password: Optional[str] = None
    # google_id: Optional[str] = None
    favorites: Optional[List[str]] = Field(default_factory=list)


