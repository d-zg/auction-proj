from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum

class User(BaseModel):
    uid: str
    email: EmailStr | None = None
    memberships: List["Membership"] = []
    # Add other relevant fields based on your user data

# --- Group Model ---
class Group(BaseModel):
    group_id: str
    name: str
    description: str
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    memberships: List[str] = []  # Relationship: Group has many Memberships -- stored as ID
    elections: List[str] = []  # Relationship: Group has many Elections -- stored as ID

# --- Membership Model ---
class Membership(BaseModel):
    membership_id: str
    user_id: str  # Relationship: Membership belongs to User (replace with reference if needed)
    group_id: str  # Relationship: Membership belongs to Group (replace with reference if needed)
    token_balance: int
    role: str  # Consider using an Enum: "admin" | "member"
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    user: Optional[User] = None  # Relationship: Membership belongs to User
    group: Optional[Group] = None  # Relationship: Membership belongs to Group
    votes: List["Vote"] = []  # Relationship: Membership has many Votes

# --- Election Model ---
class ElectionStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"
    UPCOMING = "upcoming"


# --- Election Model ---
class Election(BaseModel):
    election_id: str
    group_id: str  # Relationship: Election belongs to Group (replace with reference if needed)
    start_date: datetime
    end_date: datetime
    status: ElectionStatus = Field(default=ElectionStatus.UPCOMING) # default to upcoming
    payment_options: str  # Example: ["fiat", "crypto"]
    price_options: str  # Example: [1.0, 2.5, 5.0]
    winning_proposal_id: Optional[str] = None # Relationship: Election has one winning Proposal (replace with reference if needed)
    group: Optional[Group] = None  # Relationship: Election belongs to Group
    proposals: List[str] = []  # Relationship: Election has many Proposals

# --- Proposal Model ---
class Proposal(BaseModel):
    proposal_id: str
    election_id: str  # Relationship: Proposal belongs to Election (replace with reference if needed)
    proposer_id: str  # Relationship: Proposal belongs to Membership (replace with reference if needed)
    title: str
    created_at: datetime = Field(default_factory=datetime.now)
    election: Optional[Election] = None  # Relationship: Proposal belongs to Election
    membership: Optional[Membership] = None # Relationship: Proposal belongs to Membership
    votes: List["Vote"] = []  # Relationship: Proposal has many Votes

# --- Vote Model ---
class Vote(BaseModel):
    vote_id: str
    membership_id: str  # Relationship: Vote belongs to Membership (replace with reference if needed)
    proposal_id: str  # Relationship: Vote belongs to Proposal (replace with reference if needed)
    tokens_used: int
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    membership: Optional[Membership] = None  # Relationship: Vote belongs to Membership
    proposal: Optional[Proposal] = None  # Relationship: Vote belongs to Proposal

# Forward references to avoid circular dependencies
User.model_rebuild()
Group.model_rebuild()
Membership.model_rebuild()
Election.model_rebuild()
Proposal.model_rebuild()
Vote.model_rebuild()