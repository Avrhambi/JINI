from fastapi import APIRouter, Depends
from middleware.auth import verify_token
from models.user import User, UserUpdate
from controllers.user import delete_user_controller, edit_user_profile_controller


user_router = APIRouter()


@user_router.delete("/delete")
def delete_user_account(current_user: User = Depends(verify_token)):  
    """Role: Delete a user account using the controller."""
    return delete_user_controller(current_user.id)

@user_router.put("/edit")
def edit_user_profile(
    updated_data: UserUpdate, 
    current_user: User = Depends(verify_token)
):
   """Role: Edit user profile using the controller."""
   return edit_user_profile_controller(current_user.id, updated_data)


# # delete account endpoint
# @user_router.delete("/delete")
# def delete_user_account():  
#     """Role: Delete a user account
#        INPUT: user_token
#        OUTPUT: success/failure message
#     """
#     pass

# # edit user profile endpoint
# @user_router.put("/edit")
# def edit_user_profile():
#     """Role: Edit user profile information
#        INPUT: user_token, updated_profile_data
#        OUTPUT: success/failure message
#     """
#     pass



