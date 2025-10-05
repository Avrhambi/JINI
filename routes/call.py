from fastapi import APIRouter
from controllers.call import *


call_router = APIRouter()


@call_router.post("/{call_id}/user/{user_id}/add_to_favorites")
def add_to_favorites(user_id, call_id):
    return add_callRecord_to_favorites(user_id, call_id)

@call_router.post("/{call_id}/user/{user_id}/remove_from_favorites")
def remove_from_favorites(user_id, call_id):
    return remove_callRecord_from_favorites(user_id, call_id)


@call_router.get("/{user_id}/favorites")
def get_favorites(user_id):
    return get_user_favorites(user_id)


@call_router.get("/{call_id}")
def get_callRecord_info(id: str):
    return get_callRecord_info()


@call_router.post("/upload_audio")
async def upload_audio(audio: UploadFile = File(...)):
    return upload_callRecord(audio)

