from fastapi import APIRouter, Depends
from middleware.auth import verify_token
from models.user import User, UserUpdate
from controllers.user import delete_user_controller, edit_user_profile_controller


user_router = APIRouter()


@user_router.delete("/delete")
def delete_user_account(current_user: User = Depends(verify_token)):  
    """Delete a user account using the controller."""
    return delete_user_controller(current_user.id)






