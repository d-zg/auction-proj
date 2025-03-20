// src/models/models.ts
import { User as FirebaseUser } from 'firebase/auth';

export interface User {
  uid: string;
  email: string | null;
}

export interface TokenSettings {
    regeneration_rate: number;
    regeneration_interval: string;
    max_tokens: number;
    initial_tokens: number;
}

export interface Group {
  group_id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  memberships: string[];
  elections: string[];
  token_settings?: TokenSettings; // Added token_settings property
}

export interface Membership {
  membership_id: string;
  user_id: string;
  group_id: string;
  token_balance: number;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface MemberWithDetails {
  user: User;
  membership: Membership;
}

export interface Election {
  election_name: string;
  election_id: string;
  group_id: string;
  start_date: string;
  end_date: string;
  status: string;
  payment_options: string;
  price_options: string;
  resolution_strategy: string;
  winning_proposal_id?: string;
  proposals: Proposal[];
}

export interface Proposal {
  proposal_id: string;
  election_id: string;
  proposer_id: string;
  title: string;
  created_at: string;
  votes: Vote[];
}

export interface Vote {
  vote_id: string;
  election_id: string;
  membership_id: string;
  proposal_id: string;
  tokens_used: number;
  created_at: string;
  updated_at: string;
  amount_paid: number;
  tokens_regenerated: number;
}

// Interfaces for creating new objects
export interface ProposalCreate {
  title: string;
}

export interface ElectionCreate {
  name: string;
  start_date: string;
  end_date: string;
  payment_options: string;
  price_options: string;
  resolution_strategy: string;
  proposals: ProposalCreate[];
}

export interface VoteCreate {
  proposal_id: string;
  tokens_used: number;
}

export interface EnhancedGroupResponse {
  group: Group;
  has_active_elections: boolean;
  last_election_date: string | null; // Or Date if you prefer to parse as Date object on frontend
}

export interface EnhancedGroupDetailsResponse {
  group: Group;
  members: MemberWithDetails[];
  elections: Election[];
}