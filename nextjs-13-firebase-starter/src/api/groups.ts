// src/api/groups.ts
import { api } from '@/lib/api';
import { Group, Membership, MemberWithDetails, Election } from '@/models/models'; // Import from models.ts

export const getGroupDetails = async (groupId: string, token: string): Promise<Group> => {
  const response = await api.get(`/groups/${groupId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const getGroupMembers = async (
  groupId: string,
  token: string
): Promise<MemberWithDetails[]> => {
  const response = await api.get(`/groups/${groupId}/members`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const getGroupElections = async (groupId: string, token: string): Promise<Election[]> => {
  const response = await api.get(`/groups/${groupId}/elections`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const inviteUserToGroup = async (groupId: string, email: string, token: string) => {
  const response = await api.post(
    `/memberships/groups/${groupId}/members`,
    { email_to_add: email },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response;
};

export const startElection = async (
    name: string,
    groupId: string,
    startDate: string,
    endDate: string,
    paymentOptions: string,
    priceOptions: string,
    proposals: string[], // Array of proposal titles
    token: string
  ) => {
    const formattedProposals = proposals.map((title) => ({ title }));

    const response = await api.post(
      `/groups/${groupId}/elections`,
      {
        name: name,
        start_date: startDate,
        end_date: endDate,
        payment_options: paymentOptions,
        price_options: priceOptions,
        proposals: formattedProposals, // Send formatted proposals
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response;
  };

export const getMembershipDetails = async (groupId: string, token: string): Promise<Membership> => {
  const response = await api.get(`/memberships/groups/${groupId}/me`, { // Assuming you have a "me" endpoint on backend for memberships
      headers: {
          Authorization: `Bearer ${token}`,
      },
  });
  return response.data;
};

export const updateGroupTokenSettings = async (
  groupId: string,
  tokenSettings: any, // Replace 'any' with a more specific type if you have one
  token: string
): Promise<Group> => {
  const response = await api.put(`/groups/${groupId}/token-settings`, { token_settings: tokenSettings }, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const updateMemberTokenBalance = async (
  groupId: string,
  userId: string,
  requestBody: { token_balance: number },
  token: string
): Promise<Membership> => {
  const response = await api.patch(`/groups/${groupId}/members/${userId}/token-balance`, requestBody, {
      headers: {
          Authorization: `Bearer ${token}`,
      },
  });
  return response.data;
};

export const removeUserFromGroup = async (groupId: string, email: string, token: string) => {
    const response = await api.delete(`/memberships/groups/${groupId}/members`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
        data: { email_to_remove: email } // Send email in the request body
    });
    return response;
};