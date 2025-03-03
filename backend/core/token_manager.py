# backend/core/token_manager.py
from datetime import datetime, timedelta, timezone
from models import Membership, Group
from db import db
import pdb
import logging

logger = logging.getLogger(__name__)


async def regenerate_tokens_for_membership(membership: Membership, group: Group):
    """
    Regenerates tokens for a given membership based on the group's token settings.

    Args:
        membership: The Membership object to regenerate tokens for.
        group: The Group object to get token settings from.
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
        tokens_to_add = token_settings.regeneration_rate

    else:
        logger.warning(f"Invalid regeneration interval: {token_settings.regeneration_interval} for group {group.group_id}")
        return membership # Invalid interval

    if tokens_to_add > 0:
        new_balance = min(membership.token_balance + tokens_to_add, token_settings.max_tokens)
        membership_ref = db.collection("memberships").document(membership.membership_id)
        membership_ref.update({
            "token_balance": new_balance,
            "last_token_regeneration": now_utc,
        })
        membership.token_balance = new_balance # Update in-memory object
        membership.last_token_regeneration = now_utc # Update in-memory object
        logger.info(
            f"Regenerated {tokens_to_add} tokens for membership {membership.membership_id}, new balance: {new_balance}"
        )
    return membership