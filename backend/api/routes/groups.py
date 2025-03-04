# backend/api/routes/groups.py
import asyncio
from fastapi import APIRouter, Depends, HTTPException, status
from models import Group, TokenSettings, Membership, User
from db import db
from core.security import get_current_user
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

router = APIRouter()

class GroupUpdate(BaseModel):
    name: str
    description: str

class TokenSettingsUpdate(BaseModel):
    token_settings: TokenSettings

class MemberWithDetails(BaseModel):
    user: User
    membership: Membership

class UpdateTokenBalanceRequest(BaseModel):
    token_balance: int

class GroupCreate(BaseModel):
    name: str
    description: str = ""


@router.get("/my-groups", response_model=List[Group])
async def get_my_groups(current_user: User = Depends(get_current_user)):
    """
    Retrieves a list of all groups that the currently authenticated user is a member of.
    """
    user_id = current_user.uid

    # 1. Find memberships for the user
    membership_docs = (
        db.collection("memberships")
        .where("user_id", "==", user_id)
        .stream()
    )
    group_ids = [doc.to_dict().get("group_id") for doc in membership_docs]

    # 2. Fetch the groups using the retrieved group IDs
    groups = []
    if group_ids:
        # Use the 'in' operator to fetch groups in batches (Firestore 'in' operator has a limit of 30)
        for i in range(0, len(group_ids), 30):
            group_ids_chunk = group_ids[i:i + 30]
            group_docs_chunk = (
                db.collection("groups")
                .where("group_id", "in", group_ids_chunk)
                .stream()
            )
            groups.extend([Group.model_validate(doc.to_dict()) for doc in group_docs_chunk])

    return groups


@router.post("/", response_model=Group, status_code=status.HTTP_201_CREATED)
async def create_group(
    group_data: GroupCreate,
    current_user: User = Depends(get_current_user)
):
    """
    Creates a new group and a corresponding membership for the creator.
     """

    # Add a new document with a generated ID
    new_group_ref = db.collection("groups").document()
    group_id = new_group_ref.id

    # Create the new group document
    group_dict = {
        "group_id": group_id,
        "name": group_data.name,
        "description": group_data.description,
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
        "memberships": [f"{current_user.uid}_{group_id}"],  # Add the membership ID here
        "token_settings" : {
            "regeneration_rate": 1,
            "regeneration_interval": "election",
            "max_tokens": 10,
            "initial_tokens": 5
        }
    }


    # Create a new Group instance using the data
    group = Group(**group_dict)

    new_group_ref.set(group.model_dump())

    # Create a membership for the user who created the group
    membership_id = f"{current_user.uid}_{group_id}"
    membership = Membership(
        membership_id=membership_id,
        user_id=current_user.uid,
        group_id=group_id,
        token_balance=group.token_settings.initial_tokens if group.token_settings and group.token_settings.initial_tokens is not None else 0, # Use initial tokens from group settings
        role="admin",
    )
    db.collection("memberships").document(membership_id).set(membership.model_dump())

    return group

@router.get("/{group_id}/members", response_model=List[MemberWithDetails])
async def get_group_members_with_details(
    group_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves a list of all members of a specific group with their membership details.
    """
    # Ensure that the user is a member of the group before fetching members
    membership_ref = db.collection("memberships").document(f"{current_user.uid}_{group_id}")
    membership_doc = membership_ref.get()

    if not membership_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Current user is not a member of this group"
        )

    # Get all memberships for the group
    membership_docs = (
        db.collection("memberships")
        .where("group_id", "==", group_id)
        .stream()
    )

    memberships = [Membership.model_validate(doc.to_dict()) for doc in membership_docs]

    user_ids = [membership.user_id for membership in memberships]
    user_refs = [db.collection("users").document(user_id) for user_id in user_ids]

    # Fetch all user documents in parallel using asyncio.gather and batch get
    user_docs_coroutines = [asyncio.to_thread(user_ref.get) for user_ref in user_refs] # Run get() in thread pool
    user_docs = await asyncio.gather(*user_docs_coroutines)

    members_with_details = []
    for membership, user_doc in zip(memberships, user_docs): # Iterate through memberships and fetched user docs
        if user_doc.exists:
            user = User.model_validate(user_doc.to_dict())
            members_with_details.append(MemberWithDetails(user=user, membership=membership))

    return members_with_details

@router.get("/{group_id}", response_model=Group)
async def get_group_details(group_id: str, current_user: User = Depends(get_current_user)):
    """
    Retrieves the details of a specific group, given the group's ID.
    """

    # Ensure that the user is a member of the group before fetching details
    membership_ref = db.collection("memberships").document(f"{current_user.uid}_{group_id}")
    membership_doc = membership_ref.get()

    if not membership_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Current user is not a member of this group"
        )

    group_ref = db.collection("groups").document(group_id)
    group_doc = group_ref.get()

    if not group_doc.exists:
         raise HTTPException(
             status_code=status.HTTP_404_NOT_FOUND,
             detail="Group not found"
         )

    group = Group.model_validate(group_doc.to_dict())
    return group

@router.put("/{group_id}", response_model=Group)
async def update_group(
    group_id: str,
    group_update: GroupUpdate,
    current_user: User = Depends(get_current_user)
):
    """
    Updates the name and description of a specific group.

    Only admins of the group can update the group details.
    """
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
            detail="Only admins can update group details",
        )

    # Retrieve the existing group document
    group_ref = db.collection("groups").document(group_id)
    group_doc = group_ref.get()

    if not group_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found",
        )

    existing_group = group_doc.to_dict()

    # Update the group with new name and description and updated_at
    updated_group_data = {
        **existing_group,
         "name": group_update.name,
        "description": group_update.description,
        "updated_at": datetime.now()
        }

    group_ref.set(updated_group_data)

    # Return the updated group
    return Group.model_validate(updated_group_data)


@router.put("/{group_id}/token-settings", response_model=Group)
async def update_group_token_settings(
    group_id: str,
    token_settings_update: TokenSettingsUpdate,
    current_user: User = Depends(get_current_user)
):
    """
    Updates the token settings of a specific group.

    Only admins of the group can update the token settings.
    """
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
            detail="Only admins can update group token settings",
        )

    # Retrieve the existing group document
    group_ref = db.collection("groups").document(group_id)
    group_doc = group_ref.get()

    if not group_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found",
        )

    # Update the group with new token settings and updated_at
    updated_group_data = {
        **group_doc.to_dict(), # start with existing data to preserve other fields
        "token_settings": token_settings_update.token_settings.model_dump(),
        "updated_at": datetime.now()
    }

    group_ref.set(updated_group_data)

    # Return the updated group
    return Group.model_validate(updated_group_data)


@router.patch("/{group_id}/members/{user_id}/token-balance", response_model=Membership)
async def update_member_token_balance(
    group_id: str,
    user_id: str,
    request: UpdateTokenBalanceRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Updates the token balance of a specific member within a group.

    Only admins of a group can update member's token balances.
    """

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
            detail="Only admins can update member's token balances",
        )

    # Retrieve the membership document
    membership_id = f"{user_id}_{group_id}"
    membership_ref = db.collection("memberships").document(membership_id)
    membership_doc = membership_ref.get()

    if not membership_doc.exists:
         raise HTTPException(
             status_code=status.HTTP_404_NOT_FOUND,
             detail="Membership not found",
         )

    existing_membership = membership_doc.to_dict()

    # Update the token balance
    updated_membership_data = {
         **existing_membership,
        "token_balance": request.token_balance,
        "updated_at": datetime.now()
    }

    membership_ref.set(updated_membership_data)

    # Return the updated membership
    return Membership.model_validate(updated_membership_data)