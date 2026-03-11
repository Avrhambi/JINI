from fastapi import HTTPException
from services.user import delete_user_service, update_user_service
from models.user import UserUpdate
from utils.auth_utils import hash_password


def delete_user_controller(user_id: str):
    success = delete_user_service(user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found or already deleted")
    return {"message": "User deleted Successfully"}



