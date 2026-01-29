from fastapi import HTTPException
from services.user import delete_user_service, update_user_service
from models.user import UserUpdate
from utils.auth_utils import hash_password


def delete_user_controller(user_id: str):
    success = delete_user_service(user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found or already deleted")
    return {"status": "success", "message": "User account and all records deleted"}


def edit_user_profile_controller(user_id: str, updated_data: UserUpdate):
    # Convert Pydantic model to a dictionary, excluding fields not provided by the user
    update_dict = updated_data.dict(exclude_unset=True)
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="No changes provided")

    # If the user is changing their password, hash it before saving
    if "password" in update_dict:
        update_dict["password"] = hash_password(update_dict["password"])

    updated_user = update_user_service(user_id, update_dict)
    
    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "status": "success",
        "message": "Profile updated successfully",
        "updated_fields": list(update_dict.keys())
    }

