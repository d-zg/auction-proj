from fastapi import APIRouter, Depends, HTTPException, status
from models import Group, Membership, User, Election, Proposal, Vote, ElectionStatus
from db import db
from core.security import get_current_user
from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel, ValidationError
from google.cloud import firestore
import logging
import pdb

#set up logging
# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)


# router = APIRouter()
router = APIRouter()
logger = logging.getLogger(__name__)
logger.setLevel(logging.ERROR)
handler = logging.StreamHandler()
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)
logger.addHandler(handler)

class ProposalCreate(BaseModel):
    title: str


class ElectionCreate(BaseModel):
    start_date: datetime
    end_date: datetime
    payment_options: str 
    price_options: str
    proposals: List[ProposalCreate]

class VoteCreate(BaseModel):
    proposal_id: str
    tokens_used: int


@router.post("/", response_model=Election, status_code=status.HTTP_201_CREATED)
async def create_election(
    group_id: str,
    election_data: ElectionCreate,
    current_user: User = Depends(get_current_user)
):
    """
    Creates a new election for a group, with initial proposals.
    Only admins of a group can create an election.
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
            detail="Only admins can create elections",
        )

    # Check if there are any active elections for the group
    active_election_docs = (
        db.collection("elections")
        .where("group_id", "==", group_id)
        .where("status", "in", ["open", "upcoming"])
        .stream()
    )

    if any(active_election_docs):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="There is already an active or upcoming election for this group.",
        )

    # Validate start and end dates
    if election_data.start_date >= election_data.end_date:
          raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start date must be before end date.",
          )

    # Create a new election document with a generated ID
    new_election_ref = db.collection("elections").document()
    election_id = new_election_ref.id

    # Create the new election document
    election = Election(
        election_id=election_id,
        group_id=group_id,
        start_date=election_data.start_date,
        end_date=election_data.end_date,
        payment_options=election_data.payment_options,
        price_options=election_data.price_options,
        status="upcoming", # Set the initial status to 'upcoming'
        proposals=[]
    )

    new_election_ref.set(election.model_dump())

    # Create proposal documents
    for proposal_create in election_data.proposals:
      new_proposal_ref = db.collection("proposals").document()
      proposal_id = new_proposal_ref.id

      proposal = Proposal(
          proposal_id = proposal_id,
          election_id = election_id,
          title = proposal_create.title,
          proposer_id = current_user.uid, # Set proposer ID to the current user id
          created_at = datetime.now(),
          votes = []
      )

      new_proposal_ref.set(proposal.model_dump())
      new_election_ref.update({"proposals": firestore.ArrayUnion([proposal_id])})

    # Fetch the created election
    election_doc = new_election_ref.get()
    if not election_doc.exists:
      raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create election document",
        )


    return Election.model_validate(election_doc.to_dict())

@router.get("/", response_model=List[Election])
async def get_elections_by_group(
    group_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves all elections for a group, sorted by end date (latest first)
    """

    # Check if the current user is a member of the group
    current_user_membership_ref = db.collection("memberships").document(f"{current_user.uid}_{group_id}")
    current_user_membership_doc = current_user_membership_ref.get()

    if not current_user_membership_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Current user is not a member of this group",
        )

    # Query elections for the group and order by end_date
    election_docs = (
        db.collection("elections")
        .where("group_id", "==", group_id)
        .stream()
    )

    elections = [Election.model_validate(doc.to_dict()) for doc in election_docs]
    return elections

@router.post("/{election_id}/proposals", response_model=Proposal, status_code=status.HTTP_201_CREATED)
async def add_proposal_to_election(
    group_id: str,
    election_id: str,
    proposal_data: ProposalCreate,
    current_user: User = Depends(get_current_user)
):
    """
    Allows users to add proposals to an election that has not yet started
    """

    # Check if the current user is a member of the group
    current_user_membership_ref = db.collection("memberships").document(f"{current_user.uid}_{group_id}")
    current_user_membership_doc = current_user_membership_ref.get()

    if not current_user_membership_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Current user is not a member of this group",
        )


    # Get the election
    election_ref = db.collection("elections").document(election_id)
    election_doc = election_ref.get()

    if not election_doc.exists:
         raise HTTPException(
             status_code=status.HTTP_404_NOT_FOUND,
             detail="Election not found"
         )

    election = Election.model_validate(election_doc.to_dict())

    # Validate that election is upcoming
    if election.status != "upcoming":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Proposals can only be added to elections that are upcoming",
        )

    # Create the proposal
    new_proposal_ref = db.collection("proposals").document()
    proposal_id = new_proposal_ref.id

    proposal = Proposal(
        proposal_id = proposal_id,
        election_id = election_id,
        title = proposal_data.title,
        proposer_id = current_user.uid,
        created_at = datetime.now(),
        votes = []
    )

    new_proposal_ref.set(proposal.model_dump())
    election_ref.update({"proposals": firestore.ArrayUnion([proposal_id])})


    # fetch the newly created proposal
    proposal_doc = new_proposal_ref.get()
    if not proposal_doc.exists:
      raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create proposal document",
        )

    return Proposal.model_validate(proposal_doc.to_dict())



@router.post("/{election_id}/votes", response_model=Vote)
async def cast_vote(
    group_id: str,
    election_id: str,
    vote_data: VoteCreate,
    current_user: User = Depends(get_current_user)
):
    """
    Allows a member to cast or change their vote during the open phase of an election.
    A user can only vote once for a single proposal in a single request.
    """
    logger.info("What the fuck?")
    try:
         # Check if the current user is a member of the group
        current_user_membership_ref = db.collection("memberships").document(f"{current_user.uid}_{group_id}")
        current_user_membership_doc = current_user_membership_ref.get()

        if not current_user_membership_doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Current user is not a member of this group",
            )

        membership = Membership.model_validate(current_user_membership_doc.to_dict())

        # Get the election
        election_ref = db.collection("elections").document(election_id)
        election_doc = election_ref.get()

        if not election_doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Election not found"
            )

        election = Election.model_validate(election_doc.to_dict())

        # Validate that election is open
        if election.status != ElectionStatus.OPEN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can only vote in open elections.",
            )
        # Validate total tokens used
        if vote_data.tokens_used > membership.token_balance:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Not enough tokens to cast these votes.",
            )

        #Validate that the proposal exists in the election
        proposal_ref = db.collection("proposals").document(vote_data.proposal_id)
        proposal_doc = proposal_ref.get()

        if not proposal_doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Proposal {vote_data.proposal_id} not found",
            )
            # Check if the user has already voted for this proposal
        existing_vote_docs = (
            db.collection("votes")
            .where("membership_id", "==", membership.membership_id)
            .where("proposal_id", "==", vote_data.proposal_id)
            .stream()
        )

        updated_vote = None
        if any(existing_vote_docs):
            # User has voted, update their vote
            for existing_vote_doc in existing_vote_docs:
                existing_vote = Vote.model_validate(existing_vote_doc.to_dict())
                vote_ref = db.collection("votes").document(existing_vote.vote_id)
                updated_vote_data = {
                    **existing_vote.model_dump(),
                        "tokens_used": vote_data.tokens_used,
                        "updated_at": datetime.now()
                        }
                vote_ref.set(updated_vote_data)
                updated_vote = Vote.model_validate(updated_vote_data)
        else:
            # Create a new vote document
            new_vote_ref = db.collection("votes").document()
            vote_id = new_vote_ref.id

            vote = Vote(
                vote_id = vote_id,
                membership_id = membership.membership_id,
                proposal_id = vote_data.proposal_id,
                tokens_used = vote_data.tokens_used,
                created_at = datetime.now(),
                updated_at = datetime.now()
            )


            new_vote_ref.set(vote.model_dump())
            updated_vote = vote

        pdb.set_trace()
        logger.info(f"Updated vote: {updated_vote}") 

        return Vote(
            vote_id = "dummy_vote_id",
             membership_id = "dummy_memership_id",
             proposal_id = vote_data.proposal_id,
             tokens_used = vote_data.tokens_used,
             created_at = datetime.now(),
              updated_at = datetime.now()
        )
        if True:
            print('hey')
        return updated_vote
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Unexpected error in cast_vote: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing your vote."
        )