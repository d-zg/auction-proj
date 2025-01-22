from fastapi import APIRouter, Depends, HTTPException, status
from models import Group, Membership, User
from db import db
from core.security import get_current_user
from typing import List
from pydantic import BaseModel
from google.cloud import firestore

router = APIRouter()

# Pydantic model for the request body
class AddMemberRequest(BaseModel):
    email_to_add: str

class RemoveMemberRequest(BaseModel):
    email_to_remove: str

@router.post("/groups/{group_id}/members", response_model=Membership, status_code=status.HTTP_201_CREATED)
async def add_member_to_group(
    group_id: str,
    request: AddMemberRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Adds a user to a group based on their email address.

    Only admins of a group can add new members.
    """
    email_to_add = request.email_to_add

    # Check if the current user is an admin of the group
    current_user_membership_ref = db.collection("memberships").document(f"{current_user.uid}_{group_id}")
    current_user_membership_doc = current_user_membership_ref.get()

    if not current_user_membership_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Current user is not a member of this group",
        )

    current_user_membership = Membership.model_validate(current_user_membership_doc.to_dict())

    if current_user_membership.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can add members to a group",
        )

    # Find the user to add by email
    users_ref = db.collection("users")
    query = users_ref.where("email", "==", email_to_add)
    user_to_add_docs = query.stream()

    user_to_add = None
    for doc in user_to_add_docs:
        user_to_add = User.model_validate(doc.to_dict())
        break  # Assuming email is unique, so we only take the first match

    if not user_to_add:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with email {email_to_add} not found",
        )

    # Check if the user is already a member of the group
    membership_id = f"{user_to_add.uid}_{group_id}"
    membership_ref = db.collection("memberships").document(membership_id)
    membership_doc = membership_ref.get()

    if membership_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this group",
        )

    # Create the new membership
    new_membership = Membership(
        membership_id=membership_id,
        user_id=user_to_add.uid,
        group_id=group_id,
        token_balance=0,  # Or some initial value
        role="member",  # Or some default role
    )
    membership_ref.set(new_membership.model_dump())

    # Add the membership to the group's memberships array
    group_ref = db.collection("groups").document(group_id)
    group_ref.update({"memberships": firestore.ArrayUnion([membership_id])})

    return new_membership

@router.delete("/groups/{group_id}/members", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member_from_group(
    group_id: str,
    request: RemoveMemberRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Removes a user from a group based on their email address.

    Only admins of a group or the user themselves can remove a membership.
    """
    email_to_remove = request.email_to_remove
    
    # Find the user to remove by email
    users_ref = db.collection("users")
    query = users_ref.where("email", "==", email_to_remove)
    user_to_remove_docs = query.stream()

    user_to_remove = None
    for doc in user_to_remove_docs:
        user_to_remove = User.model_validate(doc.to_dict())
        break

    if not user_to_remove:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with email {email_to_remove} not found",
        )


    # Check if the current user is an admin or the user to be removed
    if current_user.uid != user_to_remove.uid:
        # If not the same user, check if the current user is an admin
        current_user_membership_ref = db.collection("memberships").document(f"{current_user.uid}_{group_id}")
        current_user_membership_doc = current_user_membership_ref.get()

        if not current_user_membership_doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Current user is not a member of this group",
            )

        current_user_membership = Membership.model_validate(current_user_membership_doc.to_dict())

        if current_user_membership.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can remove other members from a group",
            )

    # Check if the membership exists
    membership_id = f"{user_to_remove.uid}_{group_id}"
    membership_ref = db.collection("memberships").document(membership_id)
    membership_doc = membership_ref.get()

    if not membership_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership not found",
        )

    # Remove the membership
    membership_ref.delete()

    # Remove the membership from the group's memberships array
    group_ref = db.collection("groups").document(group_id)
    group_ref.update({"memberships": firestore.ArrayRemove([membership_id])})

    return None