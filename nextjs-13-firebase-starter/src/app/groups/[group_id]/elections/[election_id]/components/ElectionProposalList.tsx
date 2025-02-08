'use client';

import React, { useState, useEffect } from 'react';
import { Election, Proposal, Vote, VoteCreate, Membership } from '@/models/models'; // Import Membership
import { useAuthContext } from '@/context/AuthContext';
import { castVote, addProposalToElection, getElectionDetails, deleteProposal } from '@/api/elections';
import { getGroupMembers, getMembershipDetails } from '@/api/groups'; // Import getMembershipDetails
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface ElectionProposalListProps {
    electionId: string;
    groupId: string;
}

const ElectionProposalList: React.FC<ElectionProposalListProps> = ({ electionId, groupId }) => {
    const { user } = useAuthContext() as { user: any };
    const [electionDetails, setElectionDetails] = useState<Election | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newProposalTitle, setNewProposalTitle] = useState('');
    const [voteProposalId, setVoteProposalId] = useState<string | null>(null);
    const [voteTokens, setVoteTokens] = useState<number>(0);
    const [currentVote, setCurrentVote] = useState<Vote | null>(null); // To track user's current vote
    const [isAdmin, setIsAdmin] = useState(false); // State to track admin status
    const [userTokenBalance, setUserTokenBalance] = useState<number>(0); // State for user's token balance
    const router = useRouter();

    useEffect(() => {
        const fetchElectionData = async () => {
            if (!user) return;
            setLoading(true);
            setError(null);
            try {
                const token = await user.getIdToken();
                const details = await getElectionDetails(groupId, electionId, token);
                setElectionDetails(details);

                // Fetch group members to determine admin status
                const membersData = await getGroupMembers(groupId, token);
                const currentUserMembership = membersData.find(
                    (member) => member.membership.user_id === user.uid
                );
                if (currentUserMembership && currentUserMembership.membership.role === 'admin') {
                    setIsAdmin(true);
                } else {
                    setIsAdmin(false);
                }

                // Fetch membership details to get token balance
                const membershipDetails: Membership = await getMembershipDetails(groupId, token); // Fetch membership details
                setUserTokenBalance(membershipDetails.token_balance);


            } catch (err: any) {
                setError(err.message || 'Failed to load election details');
                console.error("Error fetching election details:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchElectionData();
    }, [electionId, groupId, user]);

    if (loading) {
        return <div>Loading election proposals...</div>;
    }

    if (error || !electionDetails) {
        return <div>Error: {error || 'Could not load election details'}</div>;
    }

    const handleAddProposal = async () => {
        if (!user || !newProposalTitle.trim()) return;
        try {
            const token = await user.getIdToken();
            const proposalData = { title: newProposalTitle };
            await addProposalToElection(groupId, electionId, proposalData, token);
            setNewProposalTitle('');
            // Refresh election details after adding proposal
            const updatedDetails = await getElectionDetails(groupId, electionId, token);
            setElectionDetails(updatedDetails);

        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to add proposal');
            console.error("Error adding proposal:", err);
        }
    };

    const handleCastVote = async () => {
        if (!user || !voteProposalId) return;
        try {
            const token = await user.getIdToken();
            const voteData: VoteCreate = {
                proposal_id: voteProposalId,
                tokens_used: voteTokens,
            };
            await castVote(groupId, electionId, voteData, token);
            alert('Vote cast successfully!');
            // Optionally refresh election details or just votes for the proposal
             const updatedDetails = await getElectionDetails(groupId, electionId, token);
            setElectionDetails(updatedDetails);

        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to cast vote');
            console.error("Error casting vote:", err);
        }
    };

    const handleDeleteProposal = async (proposalId: string) => {
        if (!user || !isAdmin || electionDetails.status !== 'upcoming') return; // Security checks

        if (!window.confirm("Are you sure you want to delete this proposal?")) {
            return; // User cancelled deletion
        }

        try {
            const token = await user.getIdToken();
            await deleteProposal(groupId, electionId, proposalId, token);
            // Refresh election details after deleting proposal
            const updatedDetails = await getElectionDetails(groupId, electionId, token);
            setElectionDetails(updatedDetails);
            alert('Proposal deleted successfully!');
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to delete proposal');
            console.error("Error deleting proposal:", err);
        }
    };


    const renderProposals = () => {
        if (!electionDetails.proposals) return <div>No proposals yet.</div>;

        return electionDetails.proposals.map((proposal) => (
            <div key={proposal.proposal_id} className="mb-4 p-4 border rounded flex items-start justify-between">
                <div>
                    <h4 className="font-semibold">{proposal.title}</h4>
                    {electionDetails.status === 'open' && (
                        <div className="mt-2 relative"> {/* Make this div relative for positioning */}
                            <label className="block text-sm font-medium text-gray-700">Vote Tokens</label>
                            <input
                                type="range"
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                                min="0"
                                max={userTokenBalance} // Set max to user's token balance
                                value={voteTokens}
                                onChange={(e) => setVoteTokens(Number(e.target.value))}
                            />
                            <p className="text-sm text-gray-500">Tokens to use: {voteTokens}</p>
                            <button
                                onClick={() => { setVoteProposalId(proposal.proposal_id); handleCastVote(); }}
                                className={`mt-2 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded ${voteTokens === 0 ? 'opacity-50 cursor-not-allowed bg-gray-400 hover:bg-gray-400' : ''}`}
                                disabled={voteTokens === 0} // Disable button when voteTokens is 0
                            >
                                Confirm Vote
                            </button>
                            {voteTokens === 0 && (
                                <p className="text-red-500 text-xs mt-1 absolute left-0"> {/* Position warning text */}
                                    No tokens committed
                                </p>
                            )}
                        </div>
                    )}
                    {electionDetails.status === 'closed' && proposal.votes && proposal.votes.length > 0 && (
                        <div className="mt-2">
                            <h5 className="font-semibold">Votes:</h5>
                            <ul>
                                {proposal.votes.map((vote) => (
                                    <li key={vote.vote_id} className="text-sm text-gray-600">
                                        User ID: {vote.membership_id}, Tokens: {vote.tokens_used}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                     {electionDetails.status === 'closed' && electionDetails.winning_proposal_id === proposal.proposal_id && (
                        <p className="mt-2 font-bold text-green-600">Winning Proposal!</p>
                    )}
                </div>
                {isAdmin && electionDetails.status === 'upcoming' && (
                    <button
                        onClick={() => handleDeleteProposal(proposal.proposal_id)}
                        className="text-red-500 hover:text-red-700 font-bold text-xl"
                    >
                        ×
                    </button>
                )}
            </div>
        ));
    };


    return (
        <div>
            {error && <p className="text-red-500">{error}</p>}

            <h3 className="text-xl font-semibold mb-4">Proposals</h3>
            {renderProposals()}

            {electionDetails.status === 'upcoming' && (
                <div className="mt-4">
                    <input
                        type="text"
                        placeholder="Enter your proposal"
                        className="border p-2 rounded mr-2"
                        value={newProposalTitle}
                        onChange={(e) => setNewProposalTitle(e.target.value)}
                    />
                    <button onClick={handleAddProposal} className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
                        Add Proposal
                    </button>
                </div>
            )}
        </div>
    );
};

export default ElectionProposalList;