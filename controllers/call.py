from fastapi import HTTPException
from services.call import add_to_favorites_service, remove_from_favorites_service, get_favorites_list_service, get_call_by_id
from pathlib import Path
from fastapi import UploadFile, File, HTTPException
from bson import ObjectId
import shutil

# Directory to store audio files
UPLOAD_DIR = Path("audios")
UPLOAD_DIR.mkdir(exist_ok=True)

def add_callRecord_to_favorites(user_id: str, call_id: str):
    try: 
        result = add_to_favorites_service(user_id, call_id)
    except HTTPException as http_err:
         raise http_err
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server error: {str(e)}" )

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])

    return {
        "favorites": result["favorites"]
    }

def remove_callRecord_from_favorites(user_id: str, call_id: str):
    try: 
        result = remove_from_favorites_service(user_id, call_id)
    except HTTPException as http_err:
         raise http_err
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server error: {str(e)}" )

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])

    return {
        "favorites": result["favorites"]
    }
        
def get_user_favorites(user_id):
    try:
        result = get_favorites_list_service() 
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server error: {str(e)}" )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])

    return {
        "favorites": result["favorites"]
    }

def get_callRecord_info(call_id: str):
    try:
        call = get_call_by_id(call_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server error: {str(e)}") # Unexpected error 

    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    return call


def upload_callRecord(call_id: str, file: UploadFile = File(...)):
    #  Validate file type
    if file.content_type not in ["audio/mpeg", "audio/mp4"]:
        raise HTTPException(status_code=400, detail="Invalid file type. Only mp3 or mp4 allowed.")

    # Generate a file path
    file_ext = Path(file.filename).suffix
    file_path = UPLOAD_DIR / f"{call_id}{file_ext}"

    # Save file to backend server
    try:
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    return {
        "message": f"Audio file saved successfully",
        "audio_path": str(file_path),
        "audio_filename": file.filename
    }
