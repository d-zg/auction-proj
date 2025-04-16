from fastapi import APIRouter, Depends, HTTPException, status
from models import Group, Membership, User, Election, Proposal, Vote, ElectionStatus, ResolutionStrategyType
from db import db
from core.security import get_current_user
from typing import List, Dict, Any, Optional
import asyncio
from datetime import datetime, timezone
from pydantic import BaseModel, ValidationError
from google.cloud import firestore
from strategies.auction_resolution import (
    AuctionResolutionStrategy,
    MostVotesWinsStrategy,
    FirstPriceCalculationStrategy,
    SecondPriceCalculationStrategy,
    AllPayPaymentStrategy,
    WinnersPayPaymentStrategy,
    LotteryWinsStrategy, # Import LotteryWinsStrategy
)
from core.election_state_manager import update_election_status_and_resolve
import logging
import pdb

# set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# router = APIRouter()
router = APIRouter()
logger = logging.getLogger(__name__)
logger.setLevel(logging.ERROR)
handler = logging.StreamHandler()
formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
handler.setFormatter(formatter)
logger.addHandler(handler)


class ProposalCreate(BaseModel):
    title: str


class ElectionCreate(BaseModel):
    name: str
    start_date: datetime
    end_date: datetime
    payment_options: str
    price_options: str
    resolution_strategy: str # Add resolution strategy
    proposals: List[ProposalCreate]


class VoteCreate(BaseModel):
    proposal_id: str
    tokens_used: int


class ElectionDetailsResponse(BaseModel):
    election_id: str
    group_id: str
    start_date: datetime
    end_date: datetime
    status: ElectionStatus
    payment_options: str
    price_options: str
    resolution_strategy: ResolutionStrategyType # Add resolution_strategy here
    winning_proposal_id: Optional[str] = None
    proposals: List[dict]


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_election(
    group_id: str,
    election_data: ElectionCreate,
    current_user: User = Depends(get_current_user),
):
    """
    Creates a new election for a group, with initial proposals.
    Only admins of a group can create an election.
    """

    # Check if the current user is an admin of the group
    current_user_membership_ref = db.collection("memberships").document(
        f"{current_user.uid}_{group_id}"
    )
    current_user_membership_doc = current_user_membership_ref.get()

    if not current_user_membership_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Current user is not a member of this group",
        )

    current_user_membership = Membership.model_validate(
        current_user_membership_doc.to_dict()
    )

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
        election_name=election_data.name,
        election_id=election_id,
        group_id=group_id,
        start_date=election_data.start_date,
        end_date=election_data.end_date,
        payment_options=election_data.payment_options,
        price_options=election_data.price_options,
        resolution_strategy=election_data.resolution_strategy, # Set resolution strategy
        status="upcoming",  # Set the initial status to 'upcoming'
        proposals=[],
    )

    new_election_ref.set(election.model_dump())

    # Create proposal documents
    for proposal_create in election_data.proposals:
        new_proposal_ref = db.collection("proposals").document()
        proposal_id = new_proposal_ref.id

        proposal = Proposal(
            proposal_id=proposal_id,
            election_id=election_id,
            title=proposal_create.title,
            proposer_id=current_user.uid,  # Set proposer ID to the current user id
            created_at=datetime.now(),
            votes=[],
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
    group_id: str, current_user: User = Depends(get_current_user)
):
    """
    Retrieves all elections for a group, sorted by end date (latest first).
    Processes most I/O concurrently.
    """
    # Check if the current user is a member of the group
    current_user_membership_ref = db.collection("memberships").document(
        f"{current_user.uid}_{group_id}"
    )
    current_user_membership_doc = await asyncio.to_thread(
        current_user_membership_ref.get
    )
    if not current_user_membership_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Current user is not a member of this group",
        )

    # Concurrently fetch elections and memberships for the group
    elections_future = asyncio.to_thread(
        lambda: list(
            db.collection("elections")
            .where("group_id", "==", group_id)
            .stream()
        )
    )
    memberships_future = asyncio.to_thread(
        lambda: list(
            db.collection("memberships")
            .where("group_id", "==", group_id)
            .stream()
        )
    )
    election_docs, membership_docs = await asyncio.gather(
        elections_future, memberships_future
    )

    memberships = {
        doc.to_dict().get("membership_id"): Membership.model_validate(doc.to_dict())
        for doc in membership_docs
    }

    # Define an async function to process a single election concurrently
    async def process_election(election_doc):
        election_data = election_doc.to_dict()
        if not election_data:
            return None
        election = Election.model_validate(election_data)

        # Concurrently fetch votes and proposals for this election
        vote_future = asyncio.to_thread(
            lambda: list(
                db.collection("votes")
                .where("election_id", "==", election.election_id)
                .stream()
            )
        )
        proposal_future = asyncio.to_thread(
            lambda: list(
                db.collection("proposals")
                .where("election_id", "==", election.election_id)
                .stream()
            )
        )
        vote_docs, proposal_docs = await asyncio.gather(vote_future, proposal_future)

        votes = [Vote.model_validate(doc.to_dict()) for doc in vote_docs]
        proposals = [Proposal.model_validate(doc.to_dict()) for doc in proposal_docs]

        # Update the election status concurrently
        updated_election = await update_election_status_and_resolve(
            election, db, memberships, proposals, votes
        )
        return updated_election

    # Launch processing for all elections concurrently
    tasks = [process_election(doc) for doc in election_docs]
    results = await asyncio.gather(*tasks)

    # Filter out any None results and sort by end_date descending
    elections_list = [result for result in results if result is not None]
    elections_list.sort(key=lambda e: e.end_date, reverse=True)

    return elections_list


@router.get("/{election_id}", response_model=ElectionDetailsResponse)
async def get_election_details(
    group_id: str, election_id: str, current_user: User = Depends(get_current_user)
):
    """
    Retrieves election details including all proposals, with their votes (if the election is closed)
    """

    # Check if the current user is a member of the group
    current_user_membership_ref = db.collection("memberships").document(
        f"{current_user.uid}_{group_id}"
    )
    current_user_membership_doc = current_user_membership_ref.get()

    if not current_user_membership_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Current user is not a member of this group",
        )

    # Get the election
    election_ref = db.collection("elections").document(election_id)

    # Parallelize these Firestore reads using asyncio.gather
    election_doc_future = asyncio.to_thread(election_ref.get) # Run get() in thread pool
    membership_docs_future = asyncio.to_thread(lambda: list(db.collection("memberships").where("group_id", "==", group_id).stream()))
    vote_docs_future = asyncio.to_thread(lambda: list(db.collection("votes").where("election_id", "==", election_id).stream()))
    proposal_docs_future = asyncio.to_thread(lambda: list(db.collection("proposals").where("election_id", "==", election_id).stream()))

    (election_doc, membership_docs, vote_docs_list, proposal_docs_list) = await asyncio.gather(
        election_doc_future, membership_docs_future, vote_docs_future, proposal_docs_future
    )

    if not election_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Election not found"
        )

    election = Election.model_validate(election_doc.to_dict())

    memberships = {
        doc.to_dict().get("membership_id"): Membership.model_validate(doc.to_dict())
        for doc in membership_docs
    }
    votes = [Vote.model_validate(vote_doc.to_dict()) for vote_doc in vote_docs_list]
    proposals = [
        Proposal.model_validate(proposal_doc.to_dict())
        for proposal_doc in proposal_docs_list
    ]

    updated_election = await update_election_status_and_resolve(
        election, db, memberships, proposals, votes
    )  # Pass memberships, proposals, votes

    # Get all proposals associated with the election (after status update)
    proposal_docs = (  # Re-fetch proposals to ensure they are in sync with potentially updated election
        db.collection("proposals").where("election_id", "==", election_id).stream()
    )
    proposals = []  # Re-initialize proposals list
    for proposal_doc in proposal_docs:
        proposal = Proposal.model_validate(proposal_doc.to_dict())
        # if the election is closed, get all of the votes for that proposal
        if (
            updated_election.status == ElectionStatus.CLOSED
        ):  # Use updated_election status
            vote_docs = (
                db.collection("votes")
                .where("proposal_id", "==", proposal.proposal_id)
                .stream()
            )
            votes_for_proposal = [
                Vote.model_validate(vote_doc.to_dict()).model_dump()
                for vote_doc in vote_docs
            ]
            proposals.append({**proposal.model_dump(), "votes": votes_for_proposal})
        else:
            proposals.append({**proposal.model_dump(), "votes": []})

    election_data = updated_election.model_dump()  # Use updated_election data
    election_data.pop("proposals", None)
    # Construct a response with all proposals (and vote information if election is closed)
    return ElectionDetailsResponse(**election_data, proposals=proposals)

@router.post(
    "/{election_id}/proposals",
    response_model=Proposal,
    status_code=status.HTTP_201_CREATED,
)
async def add_proposal_to_election(
    group_id: str,
    election_id: str,
    proposal_data: ProposalCreate,
    current_user: User = Depends(get_current_user),
):
    """
    Allows users to add proposals to an election that has not yet started
    """

    # Check if the current user is a member of the group
    current_user_membership_ref = db.collection("memberships").document(
        f"{current_user.uid}_{group_id}"
    )
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
            status_code=status.HTTP_404_NOT_FOUND, detail="Election not found"
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
        proposal_id=proposal_id,
        election_id=election_id,
        title=proposal_data.title,
        proposer_id=current_user.uid,
        created_at=datetime.now(),
        votes=[],
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


@router.delete(
    "/{election_id}/proposals/{proposal_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_proposal_from_election(
    group_id: str,
    election_id: str,
    proposal_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Deletes a proposal from an election.
    Only admins of the group can delete proposals.
    """

    # Check if the current user is an admin of the group
    current_user_membership_ref = db.collection("memberships").document(
        f"{current_user.uid}_{group_id}"
    )
    current_user_membership_doc = current_user_membership_ref.get()

    if not current_user_membership_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Current user is not a member of this group",
        )

    current_user_membership = Membership.model_validate(
        current_user_membership_doc.to_dict()
    )

    if current_user_membership.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete proposals from elections",
        )

    # Get the election
    election_ref = db.collection("elections").document(election_id)
    election_doc = election_ref.get()

    if not election_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Election not found"
        )

    election = Election.model_validate(election_doc.to_dict())

    if election.group_id != group_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Election does not belong to this group",
        )

    # Get the proposal
    proposal_ref = db.collection("proposals").document(proposal_id)
    proposal_doc = proposal_ref.get()

    if not proposal_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found"
        )

    proposal = Proposal.model_validate(proposal_doc.to_dict())

    if proposal.election_id != election_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Proposal does not belong to this election",
        )

    # Delete the proposal document
    proposal_ref.delete()

    # Remove the proposal_id from the election's proposals array
    election_ref = db.collection("elections").document(election_id)
    election_ref.update({"proposals": firestore.ArrayRemove([proposal_id])})

    # Delete any votes associated with the proposal
    vote_docs = db.collection("votes").where("proposal_id", "==", proposal_id).stream()
    batch = db.batch()
    for vote_doc in vote_docs:
        vote_ref = db.collection("votes").document(vote_doc.id)
        batch.delete(vote_ref)
    batch.commit()

    return None


@router.post("/{election_id}/votes", response_model=Vote)
async def cast_vote(
    group_id: str,
    election_id: str,
    vote_data: VoteCreate,
    current_user: User = Depends(get_current_user),
):
    """
    Allows a member to cast or change their vote during the open phase of an election.
    A user can only vote once for a single proposal in a single request.
    """
    try:
        # Check if the current user is a member of the group
        current_user_membership_ref = db.collection("memberships").document(
            f"{current_user.uid}_{group_id}"
        )
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
                status_code=status.HTTP_404_NOT_FOUND, detail="Election not found"
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

        # Validate that the proposal exists in the election
        proposal_ref = db.collection("proposals").document(vote_data.proposal_id)
        proposal_doc = proposal_ref.get()

        if not proposal_doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Proposal {vote_data.proposal_id} not found",
            )
            # Check if the user has already voted in this election
            # Almost definitely a better way to do this query
        existing_vote_docs = (
            db.collection("votes")
            .where("membership_id", "==", membership.membership_id)
            .where("election_id", "==", election_id)
            .stream()
        )
        existing_votes = list(existing_vote_docs)

        updated_vote = None
        if existing_votes:
            # User has voted, update their vote
            for existing_vote_doc in existing_votes:
                existing_vote = Vote.model_validate(existing_vote_doc.to_dict())
                vote_ref = db.collection("votes").document(existing_vote.vote_id)
                updated_vote_data = {
                    # ** FIX: Explicitly set proposal_id from vote_data **
                    "proposal_id": vote_data.proposal_id,
                    "tokens_used": vote_data.tokens_used,
                    "updated_at": datetime.now(),
                    "vote_id": existing_vote.vote_id,  # Keep vote_id
                    "election_id": existing_vote.election_id,  # Keep election_id
                    "membership_id": existing_vote.membership_id,  # Keep membership_id
                    "created_at": existing_vote.created_at,  # Keep created_at
                }
                vote_ref.set(updated_vote_data)
                updated_vote = Vote.model_validate(updated_vote_data)
        else:
            # Create a new vote document
            new_vote_ref = db.collection("votes").document()
            vote_id = new_vote_ref.id

            vote = Vote(
                vote_id=vote_id,
                election_id=election_id,
                membership_id=membership.membership_id,
                proposal_id=vote_data.proposal_id,
                tokens_used=vote_data.tokens_used,
                created_at=datetime.now(),
                updated_at=datetime.now(),
            )

            new_vote_ref.set(vote.model_dump())
            updated_vote = vote

        logger.info(f"Updated vote: {updated_vote}")

        return updated_vote
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Unexpected error in cast_vote: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing your vote.",
        )


@router.put("/{election_id}/close", response_model=Election)
async def close_election(
    group_id: str,
    election_id: str,
    current_user: User = Depends(get_current_user),
    winning_proposal_id: Optional[str] = None,
):
    """
    Allows an admin to close an election and select the winning proposal
    """
    # Check if the current user is an admin of the group
    current_user_membership_ref = db.collection("memberships").document(
        f"{current_user.uid}_{group_id}"
    )
    current_user_membership_doc = current_user_membership_ref.get()

    if not current_user_membership_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Current user is not a member of this group",
        )

    current_user_membership = Membership.model_validate(
        current_user_membership_doc.to_dict()
    )

    if current_user_membership.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can close elections",
        )

    # Retrieve the existing election document
    election_ref = db.collection("elections").document(election_id)
    election_doc = election_ref.get()

    if not election_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Election not found",
        )
    election = Election.model_validate(election_doc.to_dict())

    # Ensure that the election is open
    if election.status != ElectionStatus.OPEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This election is not open",
        )

    # Get all proposals associated with the election
    proposal_docs = (
        db.collection("proposals").where("election_id", "==", election_id).stream()
    )
    proposals = [
        Proposal.model_validate(proposal_doc.to_dict())
        for proposal_doc in proposal_docs
    ]

    # If a winning proposal is not explicitly set, determine the winner based on the votes
    if not winning_proposal_id:
        votes_by_proposal = {}
        for proposal in proposals:
            vote_docs = (
                db.collection("votes")
                .where("proposal_id", "==", proposal.proposal_id)
                .stream()
            )
            total_votes = sum(
                [
                    Vote.model_validate(vote_doc.to_dict()).tokens_used
                    for vote_doc in vote_docs
                ]
            )
            votes_by_proposal[proposal.proposal_id] = total_votes

        if not votes_by_proposal:
            # If there are no votes for any proposal set winning proposal to None
            winning_proposal_id = None
        else:
            # Find the proposal with the most votes
            winning_proposal_id = max(votes_by_proposal, key=votes_by_proposal.get)

    # Determine which strategy to use based on the payment, price, and resolution options
    if election.resolution_strategy == "most_votes": 
        if election.payment_options == "allpay" and election.price_options.startswith("1,"):
            strategy = MostVotesWinsStrategy(
                price_strategy=FirstPriceCalculationStrategy(),
                payment_strategy=AllPayPaymentStrategy(),
            )
        elif election.payment_options == "allpay" and election.price_options.startswith("2,"):
            strategy = MostVotesWinsStrategy(
                price_strategy=SecondPriceCalculationStrategy(),
                payment_strategy=AllPayPaymentStrategy(),
            )
        elif election.payment_options == "winnerspay" and election.price_options.startswith("1,"):
            strategy = MostVotesWinsStrategy(
                price_strategy=FirstPriceCalculationStrategy(),
                payment_strategy=WinnersPayPaymentStrategy(),
            )
        elif election.payment_options == "winnerspay" and election.price_options.startswith("2,"):
            strategy = MostVotesWinsStrategy(
                price_strategy=SecondPriceCalculationStrategy(),
                payment_strategy=WinnersPayPaymentStrategy(),
        )
        else: 
            raise Exception("invalid payment or price options")

    elif election.resolution_strategy == "lottery": # Lottery strategy
       strategy = LotteryWinsStrategy(payment_strategy=AllPayPaymentStrategy())
    else:
        raise Exception("invalid payment or price options")
    # Get all memberships of the group so that the strategy can modify the token balance
    membership_docs = (
        db.collection("memberships").where("group_id", "==", group_id).stream()
    )
    memberships = {
        doc.to_dict().get("membership_id"): Membership.model_validate(doc.to_dict())
        for doc in membership_docs
    }

    vote_docs = db.collection("votes").where("election_id", "==", election_id).stream()
    votes = [Vote.model_validate(vote_doc.to_dict()) for vote_doc in vote_docs]

    # Resolve the auction using the selected strategy
    winning_proposal_id = await strategy.resolve_auction(
        election,
        proposals,
        votes,
        memberships,
    )

    # Update the election document with status closed and set the winning proposal if it exists
    updated_election_data = {
        **election.model_dump(),
        "status": ElectionStatus.CLOSED,
        "winning_proposal_id": winning_proposal_id,
    }
    election_ref.set(updated_election_data)

    # Fetch the updated election
    updated_election_doc = election_ref.get()

    if not updated_election_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update election document",
        )

    return Election.model_validate(updated_election_doc.to_dict())


@router.get("/{election_id}/my-vote", response_model=Optional[Vote])
async def get_my_vote_for_election(
    group_id: str, election_id: str, current_user: User = Depends(get_current_user)
):
    """
    Retrieves the current user's vote for a specific election, if one exists.
    """
    # Check if the current user is a member of the group
    current_user_membership_ref = db.collection("memberships").document(
        f"{current_user.uid}_{group_id}"
    )
    current_user_membership_doc = current_user_membership_ref.get()

    if not current_user_membership_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Current user is not a member of this group",
        )
    current_user_membership_id = f"{current_user.uid}_{group_id}"

    # Query for a vote by the current user in this election
    vote_doc = (
        db.collection("votes")
        .where("election_id", "==", election_id)
        .where("membership_id", "==", current_user_membership_id)
        .limit(1)
        .stream()
    )
    votes = [Vote.model_validate(doc.to_dict()) for doc in vote_doc]

    if votes:
        return votes[0]  # Return the vote if found
    else:
        return None  # Return None if no vote is found


@router.put("/{election_id}/close-early", response_model=ElectionDetailsResponse)
async def close_election_early(
    group_id: str,
    election_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Allows an admin to close an election early, regardless of the end_date.
    Returns full election details including complete proposal data.
    """
    logger.info(
        f"CLOSE_EARLY: Endpoint hit for election_id: {election_id}, group_id: {group_id}, user_uid: {current_user.uid}"
    )

    # Check if the current user is an admin of the group
    current_user_membership_ref = db.collection("memberships").document(
        f"{current_user.uid}_{group_id}"
    )
    current_user_membership_doc = current_user_membership_ref.get()

    if not current_user_membership_doc.exists:
        logger.warning(
            f"CLOSE_EARLY: User {current_user.uid} is NOT a member of group {group_id}"
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Current user is not a member of this group",
        )

    current_user_membership = Membership.model_validate(
        current_user_membership_doc.to_dict()
    )

    if current_user_membership.role != "admin":
        logger.warning(
            f"CLOSE_EARLY: User {current_user.uid} is NOT an admin of group {group_id}, role: {current_user_membership.role}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can close elections early",
        )

    logger.info(
        f"CLOSE_EARLY: User {current_user.uid} IS an admin of group {group_id}"
    )

    # Retrieve the existing election document
    election_ref = db.collection("elections").document(election_id)
    election_doc = election_ref.get()

    if not election_doc.exists:
        logger.warning(f"CLOSE_EARLY: Election {election_id} NOT found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Election not found",
        )
    election = Election.model_validate(election_doc.to_dict())
    logger.info(
        f"CLOSE_EARLY: Election {election_id} FOUND, status: {election.status.value}"
    )

    # Ensure that the election is open or upcoming (prevent closing already closed elections)
    if election.status not in [ElectionStatus.OPEN, ElectionStatus.UPCOMING]:
        logger.warning(
            f"CLOSE_EARLY: Election {election_id} is NOT open or upcoming, status is {election.status.value}, cannot close early"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This election is already {election.status.value} and cannot be closed early.",
        )
    logger.info(
        f"CLOSE_EARLY: Election {election_id} IS open or upcoming, proceeding to close."
    )

    # --- WORKAROUND: Modify end_date to current time ---
    now_utc = datetime.now(timezone.utc)
    updated_election_data = {"end_date": now_utc}
    election_ref.update(updated_election_data)
    election.end_date = now_utc
    logger.info(
        f"CLOSE_EARLY: Temporarily updated election {election_id} end_date to current time for early closure."
    )
    # --- END WORKAROUND ---

    # Get all proposals and votes for resolution
    proposal_docs = (
        db.collection("proposals")
        .where("election_id", "==", election_id)
        .stream()
    )
    proposals_list = [
        Proposal.model_validate(proposal_doc.to_dict())
        for proposal_doc in proposal_docs
    ]
    logger.info(f"CLOSE_EARLY: Fetched {len(proposals_list)} proposals.")

    vote_docs = (
        db.collection("votes")
        .where("election_id", "==", election_id)
        .stream()
    )
    votes = [Vote.model_validate(vote_doc.to_dict()) for vote_doc in vote_docs]
    logger.info(f"CLOSE_EARLY: Fetched {len(votes)} votes.")

    # Get all memberships for token balance updates
    membership_docs = (
        db.collection("memberships")
        .where("group_id", "==", group_id)
        .stream()
    )
    memberships = {
        doc.to_dict().get("membership_id"): Membership.model_validate(doc.to_dict())
        for doc in membership_docs
    }
    logger.info(f"CLOSE_EARLY: Fetched {len(memberships)} memberships.")

    # Resolve and close the election using the helper function
    updated_election = await update_election_status_and_resolve(
        election, db, memberships, proposals_list, votes
    )
    logger.info(
        f"CLOSE_EARLY: update_election_status_and_resolve returned, updated status: {updated_election.status}, winning_proposal_id: {updated_election.winning_proposal_id}"
    )

    # Re-fetch the election document to get the absolute latest state
    updated_election_doc = election_ref.get()
    if not updated_election_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to re-fetch updated election document",
        )
    updated_election = Election.model_validate(updated_election_doc.to_dict())

    # Fetch proposals with full details (including vote info since election should be closed)
    proposal_docs = db.collection("proposals").where("election_id", "==", election_id).stream()
    proposals = []
    for proposal_doc in proposal_docs:
        proposal = Proposal.model_validate(proposal_doc.to_dict())
        vote_docs = db.collection("votes").where("proposal_id", "==", proposal.proposal_id).stream()
        votes_for_proposal = [
            Vote.model_validate(vote_doc.to_dict()).model_dump()
            for vote_doc in vote_docs
        ]
        proposals.append({**proposal.model_dump(), "votes": votes_for_proposal})

    election_data = updated_election.model_dump()
    election_data.pop("proposals", None)
    logger.info(
        f"CLOSE_EARLY: Returning updated election details with full proposals to client."
    )
    return ElectionDetailsResponse(**election_data, proposals=proposals)


@router.put("/{election_id}/start-now", response_model=ElectionDetailsResponse)
async def start_election_now(
    group_id: str,
    election_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Allows an admin to immediately start an upcoming election,
    setting the start_date to the current time and transitioning it to 'open'.
    Returns full election details including complete proposal data.
    """
    # Check if the current user is a member and an admin of the group
    current_user_membership_ref = db.collection("memberships").document(
        f"{current_user.uid}_{group_id}"
    )
    current_user_membership_doc = current_user_membership_ref.get()

    if not current_user_membership_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Current user is not a member of this group",
        )

    current_user_membership = Membership.model_validate(
        current_user_membership_doc.to_dict()
    )

    if current_user_membership.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can start elections early",
        )

    # Retrieve the existing election document
    election_ref = db.collection("elections").document(election_id)
    election_doc = election_ref.get()

    if not election_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Election not found",
        )
    election = Election.model_validate(election_doc.to_dict())

    # Ensure that the election is upcoming
    if election.status != ElectionStatus.UPCOMING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This election is not upcoming, it is {election.status.value}. Cannot start it now.",
        )

    # Update the election start_date to now and set status to OPEN
    now_utc = datetime.now(timezone.utc)
    updated_election_data = {
        "start_date": now_utc,
        "status": ElectionStatus.OPEN,
    }
    election_ref.update(updated_election_data)

    # Get all memberships, votes, and proposals needed for the state update
    membership_docs = db.collection("memberships").where("group_id", "==", group_id).stream()
    memberships = {
        doc.to_dict().get("membership_id"): Membership.model_validate(doc.to_dict())
        for doc in membership_docs
    }

    vote_docs = db.collection("votes").where("election_id", "==", election_id).stream()
    votes = [Vote.model_validate(doc.to_dict()) for doc in vote_docs]

    proposal_docs = db.collection("proposals").where("election_id", "==", election_id).stream()
    proposals_list = [Proposal.model_validate(proposal_doc.to_dict()) for proposal_doc in proposal_docs]

    # Transition to OPEN (or handle immediate closing if end_date is also in the past)
    updated_election = await update_election_status_and_resolve(
        election, db, memberships, proposals_list, votes
    )

    # Re-fetch the election document to get the absolute latest state
    updated_election_doc = election_ref.get()
    if not updated_election_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to re-fetch updated election document",
        )
    updated_election = Election.model_validate(updated_election_doc.to_dict())

    # Fetch proposals with full details (including vote info if election is closed)
    proposal_docs = db.collection("proposals").where("election_id", "==", election_id).stream()
    proposals = []
    for proposal_doc in proposal_docs:
        proposal = Proposal.model_validate(proposal_doc.to_dict())
        if updated_election.status == ElectionStatus.CLOSED:
            vote_docs = db.collection("votes").where("proposal_id", "==", proposal.proposal_id).stream()
            votes_for_proposal = [
                Vote.model_validate(vote_doc.to_dict()).model_dump()
                for vote_doc in vote_docs
            ]
            proposals.append({**proposal.model_dump(), "votes": votes_for_proposal})
        else:
            proposals.append({**proposal.model_dump(), "votes": []})

    election_data = updated_election.model_dump()
    election_data.pop("proposals", None)  # Remove any proposals key from the election data
    return ElectionDetailsResponse(**election_data, proposals=proposals)
