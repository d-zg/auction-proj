# backend/core/token_manager.py
from datetime import datetime, timedelta, timezone
from models import Membership, Group, Vote, Election
from db import db
import logging
from google.cloud import firestore

logger = logging.getLogger(__name__)


@firestore.transactional
def apply_payment_and_regenerate_transaction(transaction: firestore.Transaction, memberships, votes, election, group):
    """
    Applies payment and regenerates tokens for memberships within a Firestore transaction.

    Args:
        transaction: Firestore transaction object.
        memberships: Dictionary of memberships to update.
        votes: List of votes in the election.
        election: The Election object.
        group: The Group object.

    Returns:
        None
    """
    token_settings = group.token_settings
    if not token_settings:
        logger.warning(f"No token settings found for group {group.group_id}, skipping regeneration and payment.")
        return

    # --- Apply Payment Logic (Example - Adapt to your actual payment strategy) ---
    for vote in votes: # This is a placeholder - adapt to your payment strategy's logic
        membership_ref = db.collection("memberships").document(vote.membership_id)
        membership_doc = transaction.get(membership_ref) # Get document within transaction
        membership = Membership.model_validate(membership_doc.to_dict())

        new_balance = membership.token_balance - vote.tokens_used # Example payment logic - adapt as needed

        if new_balance < 0:
            new_balance = 0

        transaction.update(membership_ref, {"token_balance": new_balance}) # Update within transaction
        logger.info(f"Transaction: Applied payment for membership {membership.membership_id}, new balance: {new_balance}")


    # --- ELECTION-BASED TOKEN REGENERATION ---
    if group.token_settings and group.token_settings.regeneration_interval == "election":
        for membership_id in memberships:
            membership_ref = db.collection("memberships").document(membership_id)
            membership_doc = transaction.get(membership_ref) # Get document within transaction
            membership_to_regenerate = Membership.model_validate(membership_doc.to_dict())


            updated_membership = regenerate_tokens_for_membership(membership_to_regenerate, group) # Regenerate tokens (synchronous within transaction)

            transaction.update(membership_ref, { # Update both token_balance and last_token_regeneration within transaction
                "token_balance": updated_membership.token_balance,
                "last_token_regeneration": updated_membership.last_token_regeneration
            })
            logger.info(f"Transaction: Regenerated tokens for membership {membership_id}, new balance: {updated_membership.token_balance}")
    # --- END ELECTION-BASED TOKEN REGENERATION ---



async def regenerate_tokens_for_membership(membership: Membership, group: Group):
    """
    Regenerates tokens for a given membership based on the group's token settings.
    (Non-transactional version - used within the transaction)
    """
    token_settings = group.token_settings
    if not token_settings:
        logger.warning(f"No token settings found for group {group.group_id}, skipping regeneration for membership {membership.membership_id}")
        return membership

    now_utc = datetime.now(timezone.utc)
    tokens_to_add = 0

    if token_settings.regeneration_interval == "daily":
        # Daily Regeneration
        if membership.last_token_regeneration.date() < now_utc.date():
            tokens_to_add = token_settings.regeneration_rate


    elif token_settings.regeneration_interval == "election":
        # Election Regeneration - handled after election closure, not here
        return membership # No regeneration needed here for election-based

    else:
        logger.warning(f"Invalid regeneration interval: {token_settings.regeneration_interval} for group {group.group_id}")
        return membership # Invalid interval

    if tokens_to_add > 0:
        new_balance = min(membership.token_balance + tokens_to_add, token_settings.max_tokens)
        membership.token_balance = new_balance # Update in-memory object only (transaction will handle DB update)
        membership.last_token_regeneration = now_utc # Update in-memory object only
        logger.info(
            f"Transaction: Regenerated {tokens_to_add} tokens (transactional) for membership {membership.membership_id}, new balance: {new_balance}"
        )
    return membership