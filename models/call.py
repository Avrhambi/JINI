from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# Call record model
class CallRecord(BaseModel):
    id: Optional[str] = None
    user_id: str
    caller: str
    audio_file_path: str
    duration: float
    transcript: str
    created_at: datetime
    embedding: Optional[List[float]] = None
