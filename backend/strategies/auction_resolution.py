from abc import ABC, abstractmethod
from models import Election, Proposal, Vote, Membership, Group
from typing import List, Dict, Optional, Tuple
from google.cloud import firestore
from db import db

class PriceCalculationStrategy(ABC):
    """
    Abstract base class for price calculation strategies
    """
    @abstractmethod
    async def calculate_price(self, election: Election, proposals: List[Proposal], votes: List[Vote]) -> float:
        """
        Calculates the price for the auction.
        """
        pass

class PaymentApplicationStrategy(ABC):
    """
    Abstract base class for payment application strategies.
    """

    @abstractmethod
    async def apply_payment(self, election: Election, proposals: List[Proposal], votes: List[Vote], memberships: Dict[str, Membership], price_for_tokens: float, winning_proposal_id: Optional[str]):
        """
        Applies the payment rules based on the bids and the price

        Args:
            election: The election object.
            proposals: A list of proposal objects.
            votes: A list of vote objects.
             memberships: A dictionary of all memberships for all members of the group
            price_for_tokens: The price per token that all winning members pay.
        """
        pass

class AuctionResolutionStrategy(ABC):
    """
    Abstract base class for auction resolution strategies.
    """
    def __init__(self, price_strategy: PriceCalculationStrategy, payment_strategy: PaymentApplicationStrategy):
        self.price_strategy = price_strategy
        self.payment_strategy = payment_strategy

    @abstractmethod
    async def resolve_auction(self, election: Election, proposals: List[Proposal], votes: List[Vote], memberships: Dict[str, Membership]) -> Optional[str]:
        """
        Resolves an election and returns a winning proposal ID.

        Args:
            election: The election object.
            proposals: A list of proposal objects.
            votes: A list of vote objects.
             memberships: A dictionary of all memberships for all members of the group

        Returns:
            The winning proposal ID, or None if no proposal won.
        """
        pass

class MostVotesWinsStrategy(AuctionResolutionStrategy):
    """
    A simple strategy where the proposal with the most votes wins
    """
    def __init__(self, price_strategy: PriceCalculationStrategy, payment_strategy: PaymentApplicationStrategy):
        super().__init__(price_strategy, payment_strategy)
    async def resolve_auction(self, election: Election, proposals: List[Proposal], votes: List[Vote], memberships: Dict[str, Membership]) -> Optional[str]:
        votes_by_proposal = {}
        for proposal in proposals:
            total_votes = sum([vote.tokens_used for vote in votes if vote.proposal_id == proposal.proposal_id])
            votes_by_proposal[proposal.proposal_id] = total_votes

        if not votes_by_proposal:
            return None  # No votes, no winner
        winning_proposal_id = max(votes_by_proposal, key=votes_by_proposal.get)
        price = await self.price_strategy.calculate_price(election, proposals, votes)
        await self.payment_strategy.apply_payment(election,proposals, votes, memberships, price, winning_proposal_id)
        return winning_proposal_id

class FirstPriceCalculationStrategy(PriceCalculationStrategy):
    """
    Calculates a price by using the first price option
    """
    async def calculate_price(self, election: Election, proposals: List[Proposal], votes: List[Vote]) -> float:
        price_options = election.price_options.split(",")

        if len(price_options) == 0:
            raise Exception("Price options should have a comma seperated list")
        if not price_options[0]:
            raise Exception("Price options should not be empty")
        return float(price_options[0])


class SecondPriceCalculationStrategy(PriceCalculationStrategy):
    """
    Calculates a price by using the second highest bid
    """
    async def calculate_price(self, election: Election, proposals: List[Proposal], votes: List[Vote]) -> float:
        votes_by_proposal = {}
        for proposal in proposals:
            total_votes = sum([vote.tokens_used for vote in votes if vote.proposal_id == proposal.proposal_id])
            votes_by_proposal[proposal.proposal_id] = total_votes

        sorted_votes = sorted(votes_by_proposal.values(), reverse = True)
        price_options = election.price_options.split(",")
        if len(price_options) == 0:
            raise Exception("Price options should have a comma seperated list")

        if not price_options[1]:
            raise Exception("Price options should not be empty")
        if len(sorted_votes) < 2:
            return float(price_options[0])
        else:
            return float(sorted_votes[1])

class AllPayPaymentStrategy(PaymentApplicationStrategy):
    """
    A strategy where all users pay based on their own bids.
    """
    async def apply_payment(self, election: Election, proposals: List[Proposal], votes: List[Vote], memberships: Dict[str, Membership], price_for_tokens: float, winning_proposal_id: Optional[str]):
        # Process payment for all votes
        for vote in votes:
            membership = memberships.get(vote.membership_id)
            if membership:
                membership_ref = db.collection("memberships").document(membership.membership_id)
                new_balance = membership.token_balance - vote.tokens_used

                if new_balance < 0:
                    # should log this somewhere so that admins know that something has gone wrong
                    new_balance = 0

                group_id = membership.group_id
                group_ref = db.collection("groups").document(group_id)
                group_doc = group_ref.get()

                if group_doc.exists:
                    group = Group.model_validate(group_doc.to_dict())

                token_settings = group.token_settings

                if token_settings.regeneration_interval == "election":
        # Election Regeneration - handled after election closure, not here
                    tokens_to_add = token_settings.regeneration_rate

                new_balance = min(new_balance + tokens_to_add, token_settings.max_tokens)

                membership_ref.update({"token_balance": new_balance})

class WinnersPayPaymentStrategy(PaymentApplicationStrategy):
    """
    A strategy where only winning users pay based on their own bids.
    """
    async def apply_payment(self, election: Election, proposals: List[Proposal], votes: List[Vote], memberships: Dict[str, Membership], price_for_tokens: float, winning_proposal_id: Optional[str]):

        # Process payment for all votes
        for vote in votes:
            membership = memberships.get(vote.membership_id)
            if membership and vote.proposal_id == winning_proposal_id:
                membership_ref = db.collection("memberships").document(membership.membership_id)
                new_balance = membership.token_balance - vote.tokens_used

                group_id = membership.group_id
                group_ref = db.collection("groups").document(group_id)
                group_doc = group_ref.get()

                if group_doc.exists:
                    group = Group.model_validate(group_doc.to_dict())

                token_settings = group.token_settings

                if token_settings.regeneration_interval == "election":
        # Election Regeneration - handled after election closure, not here
                    tokens_to_add = token_settings.regeneration_rate

                new_balance = min(new_balance + tokens_to_add, token_settings.max_tokens)

                if new_balance < 0:
                    # should log this somewhere so that admins know that something has gone wrong
                    new_balance = 0
                membership_ref.update({"token_balance": new_balance})