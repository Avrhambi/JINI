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


