from fastapi import APIRouter, Depends, HTTPException, status
from models import Group, Membership, User
from db import db
from core.security import get_current_user
from typing import List
from datetime import datetime

router = APIRouter()


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
async def create_group(current_user: User = Depends(get_current_user)):
    """
    Creates a new group and a corresponding membership for the creator.
    """

    # Add a new document with a generated ID
    new_group_ref = db.collection("groups").document()
    group_id = new_group_ref.id

    # Create the new group document
    group_data = {
        "group_id": group_id,
        "name": "New Group",
        "description": "",
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
        "memberships": [f"{current_user.uid}_{group_id}"],  # Add the membership ID here
    }

    # Create a new Group instance using the data
    group = Group(**group_data)

    new_group_ref.set(group.model_dump())

    # Create a membership for the user who created the group
    membership_id = f"{current_user.uid}_{group_id}"
    membership = Membership(
        membership_id=membership_id,
        user_id=current_user.uid,
        group_id=group_id,
        token_balance=0,
        role="admin",
    )
    db.collection("memberships").document(membership_id).set(membership.model_dump())

    return group

    
@router.get("/{group_id}/members", response_model=List[User])
async def get_group_members(
    group_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves a list of all members of a specific group.
    """

    # Check if the current user is a member of the group (or adjust authorization as needed)
    current_user_membership_ref = db.collection("memberships").document(f"{current_user.uid}_{group_id}")
    current_user_membership_doc = current_user_membership_ref.get()

    if not current_user_membership_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Current user is not a member of this group",
        )

    # Get the memberships for the group
    membership_docs = (
        db.collection("memberships")
        .where("group_id", "==", group_id)
        .stream()
    )

    # Extract the user IDs from the memberships
    user_ids = [doc.to_dict().get("user_id") for doc in membership_docs]

    # Fetch the users based on the user IDs
    users = []
    if user_ids:
        # Use the 'in' operator to fetch users in batches (Firestore 'in' operator has a limit of 30)
        for i in range(0, len(user_ids), 30):
            user_ids_chunk = user_ids[i:i + 30]
            user_docs_chunk = (
                db.collection("users")
                .where("uid", "in", user_ids_chunk)
                .stream()
            )
            users.extend([User.model_validate(doc.to_dict()) for doc in user_docs_chunk])

    return users