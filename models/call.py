from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List


class SearchResult(BaseModel):
    file_name: str
    time_stamps: List[float]

class CallRecord(BaseModel):
    call_id: str = Field(alias="_id")
    user_id: str
    original_name: str
    visibile_name: str  # Custom spelling as requested
    number: str
    type: str           # Custom spelling as requested
    caller: str
    date: str
    file_path: str
    transcript: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True
    )