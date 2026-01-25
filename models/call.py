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



# from pydantic import BaseModel, Field, ConfigDict, field_serializer, PlainSerializer
# from typing import Optional, List, Annotated
# from datetime import datetime
# from bson import ObjectId

# # Helper to validate and serialize ObjectId for Pydantic V2
# def validate_object_id(v: any) -> ObjectId:
#     if isinstance(v, ObjectId):
#         return v
#     if isinstance(v, str) and ObjectId.is_valid(v):
#         return ObjectId(v)
#     raise ValueError("Invalid ObjectId")

# # Annotated type to handle MongoDB ObjectId serialization safely
# PyObjectId = Annotated[
#     ObjectId,
#     PlainSerializer(lambda v: str(v), return_type=str),
#     Annotated[str, Field(validate_default=True)]
# ]

# class TranscriptSentence(BaseModel):
#     """Model for individual sentences within a segment."""
#     text: str
#     start: float
#     end: float

# class ParentChunkModel(BaseModel):
#     """Model representing the original Whisper segment containing sentences."""
#     call_id: str
#     text: str
#     start_time: float
#     end_time: float
#     sentences: List[TranscriptSentence]

# class CallRecordInput(BaseModel):
#     """Input validation for creating call records with metadata from the controller."""
#     user_id: str
#     caller: str
#     audio_file_path: str 
#     duration: float

# class CallRecord(BaseModel):
#     """Full database model for a call record."""
#     model_config = ConfigDict(
#         populate_by_name=True,
#         arbitrary_types_allowed=True,
#     )

#     id: Optional[PyObjectId] = Field(default=None, alias="_id")
#     user_id: str
#     caller: str
#     audio_file_path: str
#     duration: float
#     transcript: str = ""
#     segments_record: List[ParentChunkModel] = Field(default_factory=list)
#     created_at: datetime = Field(default_factory=datetime.now)

#     @field_serializer("id")
#     def serialize_id(self, id: ObjectId, _info):
#         """Ensures the MongoDB _id is returned as a string in API responses."""
#         return str(id) if id else None

# class SearchResultResponse(BaseModel):
#     """Model for semantic search results enriched with metadata."""
#     call_id: str
#     text: str          
#     start_time: float
#     end_time: float
#     score: float       
#     caller: Optional[str] = None
#     created_at: Optional[datetime] = None
