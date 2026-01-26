from fastapi import APIRouter, Depends, Body, UploadFile, File, Form
from middleware.auth import verify_token
from controllers.call import (
    delete_call_controller,
    rename_call_controller,
    add_favorite_controller,
    remove_favorite_controller,
    get_favorites_controller,
    upload_call_controller, 
    search_call_controller
)
from models.call import CallRecord
from typing import List
import json



call_router = APIRouter()


@call_router.post("/upload")
async def upload_callrecord(
    audio_file: UploadFile = File(...),
    original_name: str = Form(...),
    display_name: str = Form(...),
    number: str = Form(...),
    type: str = Form(...),
    caller_name: str = Form(...),
    date: str = Form(...),
    current_user: dict = Depends(verify_token)
):
    metadata = {
        "original_name": original_name,
        "display_name": display_name,
        "number": number,
        "type": type,
        "caller_name": caller_name,
        "date": date,
        "file_path": f"/audio/{audio_file.filename}"
    }
    print(metadata)
    return upload_call_controller(current_user.id, audio_file, metadata)


@call_router.post("/search")
def search(
    query: str = Form(...),
    current_user: dict = Depends(verify_token)
):
    return search_call_controller(current_user.id, query)


@call_router.delete("/delete")
def delete_callrecord(
    original_name: str = Form(...),
    current_user: dict = Depends(verify_token)
):
    
    return delete_call_controller(current_user.id, original_name)

@call_router.post("/rename")
def rename_callrecord(
    original_name: str = Form(...), 
    new_name: str = Form(...), 
    current_user: dict = Depends(verify_token)
):
    return rename_call_controller(current_user.id, original_name, new_name)

@call_router.post("/favorites/add")
def add_favorite_call(
    original_name: str = Form(...), 
    current_user: dict = Depends(verify_token)
):
    return add_favorite_controller(current_user.id, original_name)

@call_router.post("/favorites/remove")
def remove_favorite_call(
    original_name: str = Form(...), 
    current_user: dict = Depends(verify_token)
):
    return remove_favorite_controller(current_user.id, original_name)

@call_router.get("/favorites", response_model=List[CallRecord])
def get_favorites_calls(current_user: dict = Depends(verify_token)):
    return get_favorites_controller(current_user.id)