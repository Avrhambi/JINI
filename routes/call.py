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

# # to do 
# # upload callrecord endpoint
# @call_router.post("/upload")
# def upload_callrecord():
#     """
#     ROLE: upload call record
#     INPUT: user_token,
#     audio_file,
#     call_metadata:
#     original_name: {name of record},
#     display_name: {display name of record},
#     number: {caller's phonenumber},
#     type: {incoming/outgoing},
#     caller_name: {name of caller},
#     date: {full date and time}
#     file_path: {path of file on server}
#     OUTPUT: success/failure message
#     """
#     pass


# # search endpoint
# @call_router.get("/search")
# def search():
#     """
#     ROLE: search call records
#     INPUT: user_token,query
#     OUTPUT: list of search resultsin the fromat - {{file_name:{file_name},time_stamps:[timestamp1,...]},...} 
#     """
#     pass



# from fastapi import APIRouter, Query, UploadFile, File, Form
# from typing import Optional
# from controllers.call import (
#     add_callRecord_to_favorites, 
#     remove_callRecord_from_favorites, 
#     get_user_favorites_controller,
#     get_callRecord_info_controller,
#     get_user_calls_controller,
#     upload_callRecord_and_process,
#     search_calls_controller
# )

# call_router = APIRouter()


# # to do: 
# # delete call endpoint
# @call_router.delete("/delete")
# def delete_callrecord():
#     """Role: Delete a call record
#        INPUT: user_token, file_id
#        OUTPUT: success/failure message
#     """
#     pass

# # rename call endpoint
# @call_router.post("/rename")
# def rename_callrecord():
#     """Role: Rename a call record
#        INPUT: user_token, file_id, new_name
#        OUTPUT: success/failure message
#     """
#     pass

# # add call record to favorites list endpoint
# @call_router.post("/favorites/add")
# def add_favorite_call():
#     """Role: Add a call to user's favorites
#        INPUT: user_token, file_id
#        OUTPUT: success/failure message
#     """
#     pass

# # remove call record from favorites list endpoint
# @call_router.post("/favorites/remove")
# def remove_favorite_call():
#     """Role: Remove a call from user's favorites
#        INPUT: user_token, file_id
#        OUTPUT: success/failure message
#     """
#     pass

# # show user favorites callrecords endpoint
# @call_router.get("/favorites")
# def get_favorites_calls():
#     """Role: Retrieve all favorite calls for a user
#        INPUT: user_token
#        OUTPUT: list of favorite call records
#     """
#     pass






















### old



# @call_router.post("/{call_id}/user/{user_id}/add_to_favorites")
# def add_to_favorites(user_id: str, call_id: str):
#     """Endpoint to add a call to favorites"""
#     return add_callRecord_to_favorites(user_id, call_id)

# @call_router.post("/{call_id}/user/{user_id}/remove_from_favorites")
# def remove_from_favorites(user_id: str, call_id: str):
#     """Endpoint to remove a call from favorites"""
#     return remove_callRecord_from_favorites(user_id, call_id)

# @call_router.post("/upload_audio")
# async def upload_callRecord(
#     user_id: str = Form(...),
#     caller: str = Form(...),
#     duration: float = Form(...),
#     audio: UploadFile = File(...),
# ):
#     """Upload audio and trigger STT/Indexing pipeline"""
#     return await upload_callRecord_and_process(user_id, caller, duration, audio)

# @call_router.get("/search")
# def search_calls(
#     query: str = Query(..., description="Semantic search query"),
#     user_id: Optional[str] = Query(None),
#     k: int = Query(5, ge=1, le=20),
# ):
#     """Search call records using the RAG-style pipeline"""
#     return search_calls_controller(query, user_id, k)

# @call_router.get("/{user_id}/favorites")
# def get_favorites_calls(user_id: str):
#     """Retrieve all favorite calls for a user"""
#     return get_user_favorites_controller(user_id)

# # don't need
# @call_router.get("/get_transcript/{call_id}")
# def get_callRecord_info(call_id: str):
#     """Get full record details including hierarchical segments"""
#     return get_callRecord_info_controller(call_id)

# # don't need
# @call_router.get("/user/{user_id}")
# def get_user_calls(user_id: str):
#     """Get all calls uploaded by a specific user"""
#     return get_user_calls_controller(user_id)



