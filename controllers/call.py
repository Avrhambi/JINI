from fastapi import HTTPException
from services.call import (
    delete_call_service,
    update_call_name_service,
    toggle_favorite_service,
    get_user_favorites_service, 
    search_calls_service,
    upload_call_to_search_service
)

def upload_call_controller(user_id: str, file, metadata):
    transcript = upload_call_to_search_service(user_id, file, metadata)
    if transcript is None:
        raise HTTPException(status_code=500, detail="Transcription service failed")
    return {"message": "Upload success", "transcript": transcript}

def search_call_controller(user_id: str, query: str):
    return search_calls_service(user_id, query)


def delete_call_controller(user_id: str, original_name: str):
    if not delete_call_service(user_id, original_name):
        raise HTTPException(status_code=404, detail="Record not found")
    return {"message": "Deleted successfully"}

def rename_call_controller(user_id: str, original_name: str, new_name: str):
    updated = update_call_name_service(user_id, original_name, new_name)
    if not updated:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"message": "Renamed successfully"}

def add_favorite_controller(user_id: str, original_name: str):
    if not toggle_favorite_service(user_id, original_name, action="add"):
        raise HTTPException(status_code=404, detail="Record not found")
    return {"message": "Added to favorites"}

def remove_favorite_controller(user_id: str, original_name: str):
    if not toggle_favorite_service(user_id, original_name, action="remove"):
        raise HTTPException(status_code=404, detail="Record not found")
    return {"message": "Removed from favorites"}

def get_favorites_controller(user_id: str):
    return get_user_favorites_service(user_id)


# import shutil
# from pathlib import Path
# from fastapi import HTTPException, status, UploadFile
# from typing import Optional
# from models.call import CallRecordInput
# from services.call import (
#     add_to_favorites_service,
#     remove_from_favorites_service,
#     get_favorites_list_service,
#     get_call_by_id,
#     get_user_calls_service,
#     create_call_record_service,
#     search_calls_service
# )

# UPLOAD_DIR = Path("call_audios")
# UPLOAD_DIR.mkdir(exist_ok=True)

# async def upload_callRecord_and_process(user_id: str, caller: str, duration: float, audio: UploadFile):
#     """Handles file saving and calls the processing service"""
#     from server import search_manager # Singleton import
    
#     file_path = UPLOAD_DIR / Path(audio.filename).name
#     try:
#         with open(file_path, "wb") as f:
#             shutil.copyfileobj(audio.file, f)
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"File save error: {str(e)}")

#     call_input = CallRecordInput(
#         user_id=user_id,
#         caller=caller,
#         audio_file_path=str(file_path),
#         duration=duration
#     )
    
#     try:
#         call = create_call_record_service(call_input, search_manager)
            
#         # Use model_dump() with mode="json" to force string conversion of ObjectIds
#         return {
#             "success": True,
#             "message": "Call record created and indexed successfully",
#             "data": call.model_dump(by_alias=True, mode="json") 
#     }
#     except Exception as e:
#         if file_path.exists(): file_path.unlink() # Cleanup on failure
#         raise HTTPException(status_code=500, detail=str(e))

# def search_calls_controller(query: str, user_id: Optional[str], k: int):
#     """Validates query and orchestrates search"""
#     from server import search_manager
#     if not query.strip():
#         raise HTTPException(status_code=400, detail="Query cannot be empty")
    
#     try:
#         results = search_calls_service(query, search_manager, user_id, k)
#         return {"success": True, "results": [res.model_dump() for res in results]}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

# def get_callRecord_info_controller(call_id: str):
#     """Fetches full call data for the UI"""
#     call = get_call_by_id(call_id)
#     if not call:
#         raise HTTPException(status_code=404, detail="Call not found")
#     return {"success": True, "data": call.model_dump()}

# # Standard CRUD wrappers below
# def add_callRecord_to_favorites(u_id: str, c_id: str):
#     try: return {"success": True, "data": add_to_favorites_service(u_id, c_id)}
#     except Exception as e: raise HTTPException(status_code=400, detail=str(e))

# def remove_callRecord_from_favorites(u_id: str, c_id: str):
#     try: return {"success": True, "data": remove_from_favorites_service(u_id, c_id)}
#     except Exception as e: raise HTTPException(status_code=400, detail=str(e))

# def get_user_favorites_controller(u_id: str):
#     favs = get_favorites_list_service(u_id)
#     return {"success": True, "data": [f.model_dump() for f in favs]}

# def get_user_calls_controller(u_id: str):
#     calls = get_user_calls_service(u_id)
#     return {"success": True, "data": [c.model_dump() for c in calls]}


#sss # ============================================================================
# # controllers/call.py
# # ============================================================================
# from fastapi import HTTPException, status, UploadFile
# from typing import Optional
# from pathlib import Path
# import shutil

# import config.db as db_config
# from models.call import CallRecordInput
# from services.call import (
#     add_to_favorites_service,
#     remove_from_favorites_service,
#     get_favorites_list_service,
#     get_call_by_id,
#     get_user_calls_service,
#     create_call_record_service,
#     search_calls_service
# )

# # Directory to store audio files
# UPLOAD_DIR = Path("audios")
# UPLOAD_DIR.mkdir(exist_ok=True)



# def add_callRecord_to_favorites(user_id: str, call_id: str):
#     """Add a call to user's favorites"""
#     try:
#         result = add_to_favorites_service(user_id, call_id)
#         return {
#             "success": True,
#             "message": "Call added to favorites",
#             "data": result
#         }
#     except Exception as e:
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=f"Failed to add to favorites: {str(e)}"
#         )

# def remove_callRecord_from_favorites(user_id: str, call_id: str):
#     """Remove a call from user's favorites"""
#     try:
#         result = remove_from_favorites_service(user_id, call_id)
#         return {
#             "success": True,
#             "message": "Call removed from favorites",
#             "data": result
#         }
#     except Exception as e:
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=f"Failed to remove from favorites: {str(e)}"
#         )

# def get_user_favorites_controller(user_id: str):
#     """Get all favorites for a user"""
#     try:
#         favorites = get_favorites_list_service(user_id)
#         return {
#             "success": True,
#             "data": [{
#                 "id": str(fav.id) if fav.id else None,
#                 "user_id": fav.user_id,
#                 "caller": fav.caller,
#                 "audio_file_path": fav.audio_file_path,
#                 "duration": fav.duration,
#                 "transcript": fav.transcript,
#                 "segments_record": fav.segments_record,
#                 "created_at": fav.created_at
#             } for fav in favorites],
#             "count": len(favorites)
#         }
#     except Exception as e:
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=f"Failed to fetch favorites: {str(e)}"
#         )

# # def get_callRecord_info_controller(call_id: str):
# #     """Get information about a specific call"""
# #     try:
# #         call = get_call_by_id(call_id)
# #         if not call:
# #             raise HTTPException(
# #                 status_code=status.HTTP_404_NOT_FOUND,
# #                 detail="Call not found"
# #             )
# #         return {
# #             "success": True,
# #             "data": {
# #                 "id": str(call.id) if call.id else None,
# #                 "user_id": call.user_id,
# #                 "caller": call.caller,
# #                 "audio_file_path": call.audio_file_path,
# #                 "duration": call.duration,
# #                 "transcript": call.transcript,
# #                 "segments_record": call.segments_record,
# #                 "created_at": call.created_at
# #             }
# #         }
# #     except HTTPException:
# #         raise
# #     except Exception as e:
# #         raise HTTPException(
# #             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
# #             detail=f"Failed to fetch call info: {str(e)}"
# #         )

# def get_callRecord_info_controller(call_id: str):
#     """Get information about a specific call with hierarchical segments"""
#     try:
#         call = get_call_by_id(call_id)
#         if not call:
#             raise HTTPException(
#                 status_code=status.HTTP_404_NOT_FOUND,
#                 detail="Call not found"
#             )
        
#         # המבנה כאן כולל כעת את segments_record ההיררכי
#         return {
#             "success": True,
#             "data": {
#                 "id": str(call.id) if call.id else None,
#                 "user_id": call.user_id,
#                 "caller": call.caller,
#                 "audio_file_path": call.audio_file_path,
#                 "duration": call.duration,
#                 "transcript": call.transcript,
#                 # שליחת הצ'אנקים והמשפטים כפי שנשמרו ב-DB
#                 "segments_record": [seg.model_dump() for seg in call.segments_record],
#                 "created_at": call.created_at
#             }
#         }
#     except Exception as e:
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=f"Failed to fetch call info: {str(e)}"
#         )

# def get_user_calls_controller(user_id: str):
#     """Get all calls for a user"""
#     try:
#         calls = get_user_calls_service(user_id)
#         return {
#             "success": True,
#             "data": [{
#                 "id": str(call.id) if call.id else None,
#                 "user_id": call.user_id,
#                 "caller": call.caller,
#                 "audio_file_path": call.audio_file_path,
#                 "duration": call.duration,
#                 "transcript": call.transcript,
#                 "segments_record": call.segments_record,
#                 "created_at": call.created_at
#             } for call in calls],
#             "count": len(calls)
#         }
#     except Exception as e:
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=f"Failed to fetch calls: {str(e)}"
#         )


# async def upload_callRecord_and_process(
#     user_id: str,
#     caller: str,
#     duration: float,
#     audio: UploadFile,
# ):
#     """Upload audio file, save, and then process and index the call record"""
#     from server import search_manager
    
#     # Save file with the original uploaded filename (as requested)
#     file_path = UPLOAD_DIR / Path(audio.filename).name
#     audio_file_path_str = str(file_path)

#     try:
#         with open(file_path, "wb") as f:
#             shutil.copyfileobj(audio.file, f)
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

#     call_data = CallRecordInput(
#         user_id=user_id,
#         caller=caller,
#         audio_file_path=audio_file_path_str,
#         duration=duration
#     )
    
#     try:
#         call = create_call_record_service(call_data, search_manager)
#         return {
#             "success": True,
#             "message": "Call record created and indexed successfully",
#             "data": {
#                 "id": str(call.id) if call.id else None,
#                 "user_id": call.user_id,
#                 "caller": call.caller,
#                 "audio_file_path": call.audio_file_path,
#                 "duration": call.duration,
#                 "transcript": call.transcript,
#                 "segments_record": call.segments_record,
#                 "created_at": call.created_at
#             }
#         }
#     except Exception as e:
#         # Cleanup failed indexing
#         Path(audio_file_path_str).unlink(missing_ok=True)
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=f"Failed to process and index call record: {str(e)}"
#         )


# # def search_calls_controller(
# #     query: str,
# #     user_id: Optional[str] = None,
# #     k: int = 5,
# # ):
# #     """Search for query in call records"""
# #     from server import search_manager
    
# #     try:
# #         if not query or len(query.strip()) == 0:
# #             raise HTTPException(
# #                 status_code=status.HTTP_400_BAD_REQUEST,
# #                 detail="Query cannot be empty"
# #             )
        
# #         results = search_calls_service(query, search_manager, user_id, k)
        
# #         return {
# #             "success": True,
# #             "query": query,
# #             "results": results,
# #             "count": len(results)
# #         }
# #     except HTTPException:
# #         raise
# #     except Exception as e:
# #         raise HTTPException(
# #             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
# #             detail=f"Search failed: {str(e)}"
# #         )

# def search_calls_controller(
#     query: str,
#     user_id: Optional[str] = None,
#     k: int = 5,
# ):
#     """Search for query in call records with semantic precision"""
#     from server import search_manager
    
#     try:
#         if not query or len(query.strip()) == 0:
#             raise HTTPException(
#                 status_code=status.HTTP_400_BAD_REQUEST,
#                 detail="Query cannot be empty"
#             )
        
#         # קריאה לשירות המעודכן שמחזיר SearchResultResponse
#         results = search_calls_service(query, search_manager, user_id, k)
        
#         return {
#             "success": True,
#             "query": query,
#             # המרה לרשימת dicts לצורך JSON response
#             "results": [res.model_dump() for res in results],
#             "count": len(results)
#         }
#     except Exception as e:
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=f"Search failed: {str(e)}"
#         )