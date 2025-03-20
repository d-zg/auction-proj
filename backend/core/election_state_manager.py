# backend/core/election_state_manager.py
import pdb
from datetime import datetime, timezone
from google.cloud import firestore
from models import Election, ElectionStatus, Group
from strategies.auction_resolution import ( # Import strategies if needed for closing
    AuctionResolutionStrategy,
    MostVotesWinsStrategy,
    LotteryWinsStrategy,
    FirstPriceCalculationStrategy,
    SecondPriceCalculationStrategy,
    AllPayPaymentStrategy,
    WinnersPayPaymentStrategy
)

async def update_election_status_and_resolve(election: Election, db: firestore.Client, memberships, proposals, votes) -> Election:
    """
    Checks the election's start and end times and updates its status accordingly.
    If an election is ending, it also resolves and closes it.

    Args:
        election: The Election object.
        db: Firestore client.
        memberships: Dictionary of group memberships.
        proposals: List of proposals for the election
        votes: List of votes for the election

    Returns:
        The updated Election object.
    """
    now_utc = datetime.now(timezone.utc)

    if election.status == ElectionStatus.UPCOMING and now_utc >= election.start_date:
        # Transition to OPEN
        election.status = ElectionStatus.OPEN
        election_ref = db.collection("elections").document(election.election_id)
        election_ref.update({"status": ElectionStatus.OPEN})
        election.status = ElectionStatus.OPEN # Update the object as well for immediate use
        print(f"Election {election.election_id} transitioned to OPEN.")  # Optional log

    elif election.status == ElectionStatus.OPEN and now_utc >= election.end_date:
        # Transition to CLOSED and Resolve
        election.status = ElectionStatus.CLOSED
        election_ref = db.collection("elections").document(election.election_id)
        updated_election_data = {
            "status": ElectionStatus.CLOSED,
        }

        # --- Resolve and Close Election Logic (Reusing from your close_election route) ---
        # Determine which strategy to use based on the payment and price options
        if election.resolution_strategy == 'lottery':
            # For lottery, price options don't affect the strategy
            if election.payment_options == "allpay":
                strategy = LotteryWinsStrategy(payment_strategy=AllPayPaymentStrategy())
            elif election.payment_options == "winnerspay":
                strategy = LotteryWinsStrategy(payment_strategy=WinnersPayPaymentStrategy())
            else:
                raise Exception("Invalid payment option for lottery resolution")
        elif election.resolution_strategy == 'most_votes':
            if election.payment_options == "allpay" and election.price_options.startswith("1,"):
                strategy = MostVotesWinsStrategy(price_strategy=FirstPriceCalculationStrategy(),
                                                payment_strategy=AllPayPaymentStrategy())
            elif election.payment_options == "allpay" and election.price_options.startswith("2,"):
                strategy = MostVotesWinsStrategy(price_strategy=SecondPriceCalculationStrategy(),
                                                payment_strategy=AllPayPaymentStrategy())
            elif election.payment_options == "winnerspay" and election.price_options.startswith("1,"):
                strategy = MostVotesWinsStrategy(price_strategy=FirstPriceCalculationStrategy(),
                                                payment_strategy=WinnersPayPaymentStrategy())
            elif election.payment_options == "winnerspay" and election.price_options.startswith("2,"):
                strategy = MostVotesWinsStrategy(price_strategy=SecondPriceCalculationStrategy(),
                                                payment_strategy=WinnersPayPaymentStrategy())
            else:
                raise Exception("Invalid payment or price options for most votes resolution")
        else:
            raise Exception("Invalid resolution strategy")


        # Resolve the auction using the selected strategy
        winning_proposal_id = await strategy.resolve_auction(election, proposals, votes, memberships, )
        updated_election_data["winning_proposal_id"] = winning_proposal_id # Add winning proposal to update data

        election_ref.update(updated_election_data) # Update status and winning proposal
        election.status = ElectionStatus.CLOSED # Update the object
        election.winning_proposal_id = winning_proposal_id # Update the object

        print(f"Election {election.election_id} transitioned to CLOSED and resolved. Winning proposal: {winning_proposal_id}")  # Optional log

    return election