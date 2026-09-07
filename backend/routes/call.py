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
    return await upload_call_controller(current_user.id, audio_file, metadata)



@call_router.post("/search")
async def search(
    query: str = Form(...),
    current_user: dict = Depends(verify_token)
):
    return await search_call_controller(current_user.id, query)


@call_router.delete("/delete")
async def delete_callrecord(
    original_name: str = Form(...),
    current_user: dict = Depends(verify_token)
):
    
    return await delete_call_controller(current_user.id, original_name)


@call_router.put("/rename")
def rename_callrecord(
    original_name: str = Form(...), 
    new_name: str = Form(...), 
    current_user: dict = Depends(verify_token)
):
    return rename_call_controller(current_user.id, original_name, new_name)


@call_router.put("/favorites/add")
def add_favorite_call(
    original_name: str = Form(...), 
    current_user: dict = Depends(verify_token)
):
    return add_favorite_controller(current_user.id, original_name)


@call_router.put("/favorites/remove")
def remove_favorite_call(
    original_name: str = Form(...), 
    current_user: dict = Depends(verify_token)
):
    return remove_favorite_controller(current_user.id, original_name)


@call_router.get("/favorites")
def get_favorites_calls(current_user: dict = Depends(verify_token)):
    return get_favorites_controller(current_user.id)