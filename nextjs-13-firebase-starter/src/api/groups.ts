// src/api/groups.ts
import { api } from '@/lib/api';
import { Group, MemberWithDetails, Election } from '@/models/models'; // Import from models.ts

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
  groupId: string,
  startDate: string,
  endDate: string,
  paymentOptions: string,
  priceOptions: string,
  token: string
) => {
  const response = await api.post(
    `/groups/${groupId}/elections`,
    {
      start_date: startDate,
      end_date: endDate,
      payment_options: paymentOptions,
      price_options: priceOptions,
      proposals: [{ title: 'Proposal 1' }, { title: 'Proposal 2' }],
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response;
};