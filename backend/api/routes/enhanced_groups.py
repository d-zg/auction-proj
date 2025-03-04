# backend/api/routes/enhanced_groups.py
from fastapi import APIRouter, Depends
from models import Group, Membership, User, Election, ElectionStatus
from db import db
from core.security import get_current_user
from typing import List, Optional
import asyncio
from google.cloud import firestore
from datetime import datetime
from pydantic import BaseModel

router = APIRouter()

class EnhancedGroupResponse(BaseModel):
    group: Group
    has_active_elections: bool
    last_election_date: Optional[datetime] = None

def chunk_list(lst: List[str], chunk_size: int):
    """Yield successive chunk_size-sized chunks from lst."""
    for i in range(0, len(lst), chunk_size):
        yield lst[i:i + chunk_size]

def fetch_elections_for_chunk_sync(group_ids_chunk: List[str]):
    """
    Synchronously fetch elections for a chunk of group IDs.
    Returns two dictionaries:
      - last_elections: maps group_id to the most recent election end_date.
      - active_flags: maps group_id to a boolean indicating active elections.
    """
    elections_query = (
        db.collection("elections")
        .where("group_id", "in", group_ids_chunk)
        .order_by("end_date", direction=firestore.Query.DESCENDING)
    )
    elections_docs = list(elections_query.stream())
    last_elections = {}
    active_flags = {}
    for doc in elections_docs:
        election = Election.model_validate(doc.to_dict())
        group_id = election.group_id
        # Because of descending order, the first encountered election per group is the latest.
        if group_id not in last_elections:
            last_elections[group_id] = election.end_date
        # Mark the group as having an active election if status is OPEN or UPCOMING.
        if election.status in [ElectionStatus.OPEN, ElectionStatus.UPCOMING]:
            active_flags[group_id] = True
    return last_elections, active_flags

@router.get("/my-groups-enhanced", response_model=List[EnhancedGroupResponse])
async def get_my_enhanced_groups(current_user: User = Depends(get_current_user)):
    """
    Retrieves a list of groups with enhanced election information for the current user.
    This version uses concurrency and batching to improve performance.
    """
    user_id = current_user.uid

    # 1. Fetch memberships for the user.
    membership_docs = list(
        db.collection("memberships").where("user_id", "==", user_id).stream()
    )
    group_ids = [doc.to_dict().get("group_id") for doc in membership_docs]
    if not group_ids:
        return []

    # 2. Batch fetch group documents concurrently.
    group_refs = [db.collection("groups").document(group_id) for group_id in group_ids]
    group_docs = await asyncio.gather(
        *[asyncio.to_thread(ref.get) for ref in group_refs]
    )
    groups_dict = {
        doc.id: Group.model_validate(doc.to_dict())
        for doc in group_docs if doc.exists
    }

    # 3. Batch fetch elections using "in" queries in chunks (Firestore allows max 10 elements per "in" query).
    tasks = [
        asyncio.to_thread(fetch_elections_for_chunk_sync, chunk)
        for chunk in chunk_list(group_ids, 10)
    ]
    results = await asyncio.gather(*tasks)

    # Merge results from all chunks.
    last_elections = {}
    active_flags = {}
    for le, af in results:
        last_elections.update(le)
        active_flags.update(af)

    # 4. Build enhanced group responses.
    enhanced_groups = []
    for group_id in group_ids:
        if group_id in groups_dict:
            enhanced_groups.append(EnhancedGroupResponse(
                group=groups_dict[group_id],
                last_election_date=last_elections.get(group_id),
                has_active_elections=active_flags.get(group_id, False)
            ))
    return enhanced_groups

def include_enhanced_groups_routes(app):
    app.include_router(router, prefix="/groups", tags=["enhanced_groups"])
