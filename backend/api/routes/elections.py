from fastapi import APIRouter, Depends, HTTPException, status
from models import Group, Membership, User, Election, Proposal, Vote, ElectionStatus
from db import db
from core.security import get_current_user
from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel, ValidationError
from google.cloud import firestore
from strategies.auction_resolution import (
    AuctionResolutionStrategy,
    MostVotesWinsStrategy,
    FirstPriceCalculationStrategy,
    SecondPriceCalculationStrategy,
    AllPayPaymentStrategy,
    WinnersPayPaymentStrategy
)
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

class ElectionDetailsResponse(BaseModel):
    election_id: str
    group_id: str
    start_date: datetime
    end_date: datetime
    status: ElectionStatus
    payment_options: str
    price_options: str
    winning_proposal_id: Optional[str] = None
    proposals: List[dict]


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
        # pdb.set_trace()
        if existing_votes:
            # User has voted, update their vote
            for existing_vote_doc in existing_votes:
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
                election_id = election_id, 
                membership_id = membership.membership_id,
                proposal_id = vote_data.proposal_id,
                tokens_used = vote_data.tokens_used,
                created_at = datetime.now(),
                updated_at = datetime.now()
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
            detail="An unexpected error occurred while processing your vote."
        )

@router.get("/{election_id}", response_model=ElectionDetailsResponse)
async def get_election_details(
    group_id: str,
    election_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves election details including all proposals, with their votes (if the election is closed)
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

    # Get all proposals associated with the election
    proposal_docs = (
      db.collection("proposals")
      .where("election_id", "==", election_id)
      .stream()
    )
    proposals = []
    for proposal_doc in proposal_docs:
      proposal = Proposal.model_validate(proposal_doc.to_dict())
        # if the election is closed, get all of the votes for that proposal
      if election.status == ElectionStatus.CLOSED:
           vote_docs = (
                db.collection("votes")
                .where("proposal_id", "==", proposal.proposal_id)
                .stream()
           )
           votes = [Vote.model_validate(vote_doc.to_dict()).model_dump() for vote_doc in vote_docs]
           proposals.append({**proposal.model_dump(), "votes": votes})
      else:
          proposals.append({**proposal.model_dump(), "votes": []})
    # pdb.set_trace()
    election_data = election.model_dump()
    election_data.pop("proposals", None)
    # Construct a response with all proposals (and vote information if election is closed)
    return ElectionDetailsResponse(**election_data, proposals=proposals)


@router.put("/{election_id}/close", response_model=Election)
async def close_election(
    group_id: str,
    election_id: str,
    current_user: User = Depends(get_current_user),
    winning_proposal_id: Optional[str] = None
):
     """
     Allows an admin to close an election and select the winning proposal
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
        db.collection("proposals")
        .where("election_id", "==", election_id)
        .stream()
     )
     proposals = [Proposal.model_validate(proposal_doc.to_dict()) for proposal_doc in proposal_docs]
     
     # If a winning proposal is not explicitly set, determine the winner based on the votes
     if not winning_proposal_id:
         votes_by_proposal = {}
         for proposal in proposals:
           vote_docs = (
                db.collection("votes")
                .where("proposal_id", "==", proposal.proposal_id)
                .stream()
            )
           total_votes = sum([Vote.model_validate(vote_doc.to_dict()).tokens_used for vote_doc in vote_docs])
           votes_by_proposal[proposal.proposal_id] = total_votes
       
         if not votes_by_proposal:
            # If there are no votes for any proposal set winning proposal to None
             winning_proposal_id = None
         else:
              # Find the proposal with the most votes
             winning_proposal_id = max(votes_by_proposal, key=votes_by_proposal.get)

     # Determine which strategy to use based on the payment and price options
     if election.payment_options == "allpay" and election.price_options.startswith("1,"):
         strategy = MostVotesWinsStrategy(price_strategy=FirstPriceCalculationStrategy(), payment_strategy=AllPayPaymentStrategy())
     elif election.payment_options == "allpay" and election.price_options.startswith("1,"):
         strategy = MostVotesWinsStrategy(price_strategy=SecondPriceCalculationStrategy(), payment_strategy=AllPayPaymentStrategy())
     elif election.payment_options == "winnerspay" and election.price_options.startswith("1,"):
         strategy = MostVotesWinsStrategy(price_strategy=FirstPriceCalculationStrategy(), payment_strategy=WinnersPayPaymentStrategy())
     elif election.payment_options == "winnerspay" and election.price_options.startswith("2,"):
        strategy = MostVotesWinsStrategy(price_strategy=SecondPriceCalculationStrategy(), payment_strategy=WinnersPayPaymentStrategy())
     else:
          raise Exception("invalid payment or price options")

     # Get all memberships of the group so that the strategy can modify the token balance
     membership_docs = (
        db.collection("memberships")
        .where("group_id", "==", group_id)
        .stream()
     )
     memberships = {doc.to_dict().get("membership_id"):Membership.model_validate(doc.to_dict()) for doc in membership_docs}

     vote_docs = (
        db.collection("votes")
        .where("election_id", "==", election_id)
        .stream()
      )
     votes = [Vote.model_validate(vote_doc.to_dict()) for vote_doc in vote_docs]
     

     # Resolve the auction using the selected strategy
     winning_proposal_id = await strategy.resolve_auction(election, proposals, votes, memberships, )


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
