# backend/api/routes/enhanced_group_details.py
from fastapi import APIRouter, Depends, HTTPException, status
import asyncio
from models import Group, Membership, User, Election, MemberWithDetails
from db import db
from core.security import get_current_user
from google.cloud import firestore
from datetime import datetime
from pydantic import BaseModel
from typing import List

router = APIRouter()

class EnhancedGroupDetailsResponse(BaseModel):
    group: Group
    members: List[MemberWithDetails]
    elections: List[Election]

@router.get("/enhanced-group/{group_id}", response_model=EnhancedGroupDetailsResponse)
async def get_enhanced_group_details(group_id: str, current_user: User = Depends(get_current_user)):
    """
    Retrieve group details, members (with user info), and elections in one call.
    Uses concurrency and batching, and leverages a composite index on elections for fast queries.
    """
    # Run queries concurrently.
    group_future = asyncio.to_thread(db.collection("groups").document(group_id).get)
    memberships_future = asyncio.to_thread(
        lambda: list(db.collection("memberships").where("group_id", "==", group_id).stream())
    )
    elections_future = asyncio.to_thread(
        lambda: list(
            db.collection("elections")
            .where("group_id", "==", group_id)
            .order_by("start_date", direction=firestore.Query.DESCENDING)
            .stream()
        )
    )
    group_doc, membership_docs, election_docs = await asyncio.gather(
        group_future, memberships_future, elections_future
    )

    if not group_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found.")

    # Parse group document.
    group_data = Group.model_validate(group_doc.to_dict())

    # Process memberships.
    memberships = [Membership.model_validate(doc.to_dict()) for doc in membership_docs]

    # Batch fetch user documents for memberships.
    user_ids = list({membership.user_id for membership in memberships})
    user_refs = [db.collection("users").document(user_id) for user_id in user_ids]
    user_docs = await asyncio.to_thread(db.get_all, user_refs)
    users_dict = {doc.id: User.model_validate(doc.to_dict()) for doc in user_docs if doc.exists}

    # Build list of MemberWithDetails objects.
    members_with_details = []
    for membership in memberships:
        user = users_dict.get(membership.user_id)
        if user:
            members_with_details.append({
                "membership": membership,
                "user": user
            })

    # Process elections.
    elections = [Election.model_validate(doc.to_dict()) for doc in election_docs]

    return EnhancedGroupDetailsResponse(
        group=group_data,
        members=members_with_details,
        elections=elections
    )

def include_enhanced_group_details_routes(app):
    app.include_router(router, prefix="/groups", tags=["enhanced_group_details"])
