# backend/api/routes/enhanced_election_details.py
from fastapi import APIRouter, Depends, HTTPException, status
import asyncio
from models import Election, Membership, User, MemberWithDetails, Proposal
from db import db
from core.security import get_current_user
from google.cloud import firestore
from pydantic import BaseModel
from typing import List

router = APIRouter()

class EnhancedElectionDetailsResponse(BaseModel):
    election: Election
    members: List[MemberWithDetails]
    proposals: List[Proposal]

@router.get("/enhanced-election/{group_id}/{election_id}", response_model=EnhancedElectionDetailsResponse)
async def get_enhanced_election_details(group_id: str, election_id: str, current_user: User = Depends(get_current_user)):
    """
    Retrieve election details, group members, and proposals in one call.
    Uses concurrency, batching, and composite indices for fast queries.
    """
    # Run election, memberships, and proposals queries concurrently.
    election_future = asyncio.to_thread(db.collection("elections").document(election_id).get)
    memberships_future = asyncio.to_thread(
        lambda: list(db.collection("memberships").where("group_id", "==", group_id).stream())
    )
    proposals_future = asyncio.to_thread(
        lambda: list(db.collection("proposals").where("election_id", "==", election_id).stream())
    )
    
    election_doc, membership_docs, proposal_docs = await asyncio.gather(
        election_future, memberships_future, proposals_future
    )

    if not election_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Election not found.")

    # Parse election document.
    election_data = Election.model_validate(election_doc.to_dict())

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
        user_obj = users_dict.get(membership.user_id)
        if user_obj:
            members_with_details.append({
                "membership": membership,
                "user": user_obj
            })

    # Process proposals.
    proposals = [Proposal.model_validate(doc.to_dict()) for doc in proposal_docs]

    return EnhancedElectionDetailsResponse(
        election=election_data,
        members=members_with_details,
        proposals=proposals
    )

def include_enhanced_election_routes(app):
    app.include_router(router, prefix="/groups", tags=["enhanced_election_details"])
