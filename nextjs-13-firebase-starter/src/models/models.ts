// src/models/models.ts
import { User as FirebaseUser } from 'firebase/auth';

export interface User {
  uid: string;
  email: string | null;
}

export interface Group {
  group_id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  memberships: string[];
  elections: string[];
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
  election_id: string;
  group_id: string;
  start_date: string;
  end_date: string;
  status: string;
  payment_options: string;
  price_options: string;
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
}

// Interfaces for creating new objects
export interface ProposalCreate {
  title: string;
}

export interface ElectionCreate {
  start_date: string;
  end_date: string;
  payment_options: string;
  price_options: string;
  proposals: ProposalCreate[];
}

export interface VoteCreate {
  proposal_id: string;
  tokens_used: number;
}