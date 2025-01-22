from fastapi import APIRouter, Depends, HTTPException, status
from models import User
from db import db  # Import Firestore client
from core.security import get_current_user

router = APIRouter()


@router.post("/create_if_new", response_model=User, status_code=status.HTTP_201_CREATED)
async def create_user_if_new(
    current_user: User = Depends(get_current_user)
):
    """
    Creates a new user in Firestore if one does not already exist.

    The user's UID is taken from the authenticated user's ID token. If a user
    with the given UID already exists, no action is taken, and the existing
    user data is returned.
    """
    user_id = current_user.uid  # Get the UID from the ID token

    # Check if the user already exists
    user_ref = db.collection("users").document(user_id)
    user_doc = user_ref.get()

    

    if user_doc.exists:
        # User already exists, return existing user data
        return User.model_validate(user_doc.to_dict())

    # Create the new user document
    new_user = User(uid=user_id, email=current_user.email, memberships=[])
    user_ref.set(new_user.model_dump())

    return new_user


@router.get("/me", response_model=User)
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """
    Retrieves the profile of the currently authenticated user.

    The user's UID is obtained from the Firebase ID token.
    """
    user_id = current_user.uid
    user_ref = db.collection("users").document(user_id)
    user_doc = user_ref.get()

    if user_doc.exists:
        return User.model_validate(user_doc.to_dict())
    else:
        # This should ideally never happen if create_user_if_new is used correctly
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found (database record missing)",
        )