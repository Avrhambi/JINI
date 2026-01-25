from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import Optional, List


# User model
class User(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    email: str
    password: Optional[str] = None
    # google_id: Optional[str] = None
    favorites: Optional[List[str]] = Field(default_factory=list) # list of callrecors IDs


    model_config = ConfigDict(
            populate_by_name=True,
            arbitrary_types_allowed=True
        )
    

class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
   