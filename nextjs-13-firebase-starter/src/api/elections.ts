// src/api/elections.ts
import { api } from '@/lib/api';
import { Election, Proposal, Vote, ProposalCreate, ElectionCreate, VoteCreate } from '@/models/models'; // Import from models.ts


export const createElection = async (
  groupId: string,
  electionData: ElectionCreate,
  token: string
): Promise<Election> => {
  const response = await api.post(`/groups/${groupId}/elections`, electionData, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const getElectionsByGroup = async (groupId: string, token: string): Promise<Election[]> => {
  const response = await api.get(`/groups/${groupId}/elections`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const addProposalToElection = async (
  groupId: string,
  electionId: string,
  proposalData: ProposalCreate,
  token: string
): Promise<Proposal> => {
  const response = await api.post(
    `/groups/${groupId}/elections/${electionId}/proposals`,
    proposalData,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
};

export const castVote = async (
  groupId: string,
  electionId: string,
  voteData: VoteCreate,
  token: string
): Promise<Vote> => {
  const response = await api.post(`/groups/${groupId}/elections/${electionId}/votes`, voteData, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const getElectionDetails = async (
  groupId: string,
  electionId: string,
  token: string
): Promise<Election> => {
  const response = await api.get(`/groups/${groupId}/elections/${electionId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const closeElection = async (
    groupId: string,
    electionId: string,
    token: string,
    winningProposalId?: string
): Promise<Election> => {
    const response = await api.put(
        `/groups/${groupId}/elections/${electionId}/close`,
        winningProposalId ? { winning_proposal_id: winningProposalId } : {},
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );
    return response.data;
};


export const deleteProposal = async (
  groupId: string,
  electionId: string,
  proposalId: string,
  token: string
): Promise<void> => {
  const response = await api.delete(`/groups/${groupId}/elections/${electionId}/proposals/${proposalId}`, {
      headers: {
          Authorization: `Bearer ${token}`,
      },
  });
  return response.data; // Or just return void if you don't need response data
};