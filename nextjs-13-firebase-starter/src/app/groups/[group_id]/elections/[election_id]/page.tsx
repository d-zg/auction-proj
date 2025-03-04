'use client';

import React, { useEffect, useState } from 'react';
import { useAuthContext } from '@/context/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { closeElectionEarly, startElectionNow, getEnhancedElectionDetails } from '@/api/elections';
import { Election, MemberWithDetails, Proposal } from '@/models/models';
import ElectionProposalList from './components/ElectionProposalList';

const ElectionDetailsPage: React.FC = () => {
  const { user } = useAuthContext() as { user: any };
  const router = useRouter();
  const params = useParams();
  const groupId = params.group_id as string;
  const electionId = params.election_id as string;

  const [election, setElection] = useState<Election | null>(null);
  const [members, setMembers] = useState<MemberWithDetails[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!groupId || !electionId || !user) return;
      setLoading(true);
      setError(null);
      try {
        const token = await user.getIdToken();
        const data = await getEnhancedElectionDetails(groupId, electionId, token);
        setElection(data.election);
        setMembers(data.members);
        setProposals(data.proposals);

        const currentUserMembership = data.members.find(
          (member) => member.membership.user_id === user.uid
        );
        setIsAdmin(currentUserMembership?.membership.role === 'admin' || false);
      } catch (err: any) {
        setError(err.message || 'Failed to load election details.');
        console.error("Error fetching election details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [groupId, electionId, user]);

  // Callback to update proposals when a new proposal is added
  const handleProposalAdded = (newProposal: Proposal) => {
    setProposals((prev) => [...prev, newProposal]);
  };

  const handleCloseElectionEarly = async () => {
    if (!user || !groupId || !electionId) return;
    if (!window.confirm("Are you sure you want to close this election early? This action is irreversible.")) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const closedElection = await closeElectionEarly(groupId, electionId, token);
      setElection(closedElection);
      alert(`Election "${closedElection.election_name}" closed successfully.`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to close election early.');
      console.error("Error closing election early:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartElectionNow = async () => {
    if (!user || !groupId || !electionId) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const startedElection = await startElectionNow(groupId, electionId, token);
      setElection(startedElection);
      alert(`Election "${startedElection.election_name}" started successfully.`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to start election.');
      console.error("Error starting election:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading election details...</div>;
  }

  if (error || !election) {
    return <div>Error: {error || 'Failed to load election.'}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <Link
        href={`/groups/${groupId}`}
        className="inline-block mb-4 text-blue-500 hover:underline"
        aria-label="Back to group details"
      >
        ← Back to Group
      </Link>

      <h1 className="text-2xl font-bold mb-2">{election.election_name}</h1>
      <p className="text-gray-700 mb-4">
        {new Date(election.start_date).toLocaleString()} - {new Date(election.end_date).toLocaleString()}
        <span className="ml-2">Status: {election.status}</span>
      </p>
      <p className="text-gray-700 mb-4">
        Payment Option: {election.payment_options === 'allpay' ? 'All Pay' : election.payment_options === 'winnerspay' ? 'Winners Pay' : 'Unknown'}
      </p>
      <p className="text-gray-700 mb-4">Price Option: {election.price_options}</p>
      <p className="text-gray-700 mb-4">Resolution Strategy: {election.resolution_strategy}</p>

      {isAdmin && election.status === 'upcoming' && (
        <button
          onClick={handleStartElectionNow}
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mb-4"
          aria-label="Start election now"
        >
          Start Election Now
        </button>
      )}
      {isAdmin && election.status === 'open' && (
        <button
          onClick={handleCloseElectionEarly}
          className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded mb-4 ml-4"
          aria-label="Close election early"
        >
          Close Election Early
        </button>
      )}

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Proposals</h2>
        {proposals.length > 0 ? (
          <ElectionProposalList
            proposals={proposals}
            onProposalAdded={handleProposalAdded}
            groupId={groupId}
            election={election}
            electionId={electionId}
            isAdmin={isAdmin}
            members={members}
          />
        ) : (
          <p>No proposals found for this election.</p>
        )}
      </div>
    </div>
  );
};

export default ElectionDetailsPage;
