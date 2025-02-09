// src/app/groups/[group_id]/elections/[election_id]/components/ElectionProposalList.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Election, Proposal, Vote, VoteCreate, Membership } from '@/models/models';
import { useAuthContext } from '@/context/AuthContext';
import { castVote, addProposalToElection, getElectionDetails, deleteProposal, getMyVoteForElection } from '@/api/elections';
import { getGroupMembers, getMembershipDetails } from '@/api/groups';
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
    const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
    const [voteTokens, setVoteTokens] = useState<number>(0);
    const [userVoteForElection, setUserVoteForElection] = useState<Vote | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [userTokenBalance, setUserTokenBalance] = useState<number>(0);
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

                const membersData = await getGroupMembers(groupId, token);
                const currentUserMembership = membersData.find(
                    (member) => member.membership.user_id === user.uid
                );
                if (currentUserMembership && currentUserMembership.membership.role === 'admin') {
                    setIsAdmin(true);
                } else {
                    setIsAdmin(false);
                }

                const membershipDetails: Membership = await getMembershipDetails(groupId, token);
                setUserTokenBalance(membershipDetails.token_balance);

                const myVote = await getMyVoteForElection(groupId, electionId, token);
                setUserVoteForElection(myVote);


                if (!details.proposals?.some(p => p.proposal_id === selectedProposalId)) {
                    setSelectedProposalId(null);
                    setVoteTokens(0);
                }

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
            const updatedDetails = await getElectionDetails(groupId, electionId, token);
            setElectionDetails(updatedDetails);

        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to add proposal');
            console.error("Error adding proposal:", err);
        }
    };

    const handleCastVote = async () => {
        if (!user || !selectedProposalId) return;
        try {
            const token = await user.getIdToken();
            const voteData: VoteCreate = {
                proposal_id: selectedProposalId,
                tokens_used: voteTokens,
            };
            const newVote = await castVote(groupId, electionId, voteData, token);
            alert('Vote cast successfully!');

            setUserVoteForElection(newVote);

            const updatedDetails = await getElectionDetails(groupId, electionId, token);
            setElectionDetails(updatedDetails);

        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to cast vote');
            console.error("Error casting vote:", err);
        }
    };

    const handleDeleteProposal = async (proposalId: string) => {
        if (!user || !isAdmin || electionDetails.status !== 'upcoming') return;

        if (!window.confirm("Are you sure you want to delete this proposal?")) {
            return;
        }

        try {
            const token = await user.getIdToken();
            await deleteProposal(groupId, electionId, proposalId, token);
            const updatedDetails = await getElectionDetails(groupId, electionId, token);
            setElectionDetails(updatedDetails);
            alert('Proposal deleted successfully!');
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to delete proposal');
            console.error("Error deleting proposal:", err);
        }
    };

    const handleProposalClick = (proposal: Proposal) => {
        setSelectedProposalId(proposal.proposal_id);
        // If user has a vote, pre-fill tokens from their vote, otherwise 0
        setVoteTokens(userVoteForElection?.proposal_id === proposal.proposal_id ? userVoteForElection.tokens_used : 0);
    };

    const renderProposals = () => {
        if (!electionDetails.proposals) return <div>No proposals yet.</div>;

        return electionDetails.proposals.map((proposal) => {
            const userHasVotedForThisProposal = userVoteForElection?.proposal_id === proposal.proposal_id;

            return (
                <div key={proposal.proposal_id}
                     className={`mb-4 p-4 border rounded flex items-start justify-between ${selectedProposalId === proposal.proposal_id ? 'bg-gray-100' : 'bg-white hover:bg-gray-50'} ${userHasVotedForThisProposal ? 'bg-gray-200' : ''}`}
                     onClick={() => handleProposalClick(proposal)}>
                    <div>
                        <h4 className="font-semibold cursor-pointer">{proposal.title}</h4>
                        {electionDetails.status === 'open' && userHasVotedForThisProposal && (
                            <div className="mt-2 relative">
                                <p className="text-sm text-gray-600">Voted with {userVoteForElection!.tokens_used} tokens</p>
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
                            aria-label={`Delete proposal ${proposal.title}`}
                        >
                            ×
                        </button>
                    )}
                </div>
            );
        });
    };

    return (
        <div>
            {error && <p className="text-red-500">{error}</p>}
            <h3 className="text-xl font-semibold mb-4">Proposals</h3>
            {renderProposals()}

            {electionDetails.status === 'open' && selectedProposalId && (
                <div className="mt-6 p-4 border rounded bg-white shadow-sm">
                    <h4 className="font-semibold mb-2">Vote for Selected Proposal</h4>
                    <label htmlFor="voteSliderBottom" className="block text-sm font-medium text-gray-700">
                        Vote Tokens
                    </label>
                    <input
                        type="range"
                        id="voteSliderBottom"
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                        min="0"
                        max={userTokenBalance}
                        value={voteTokens}
                        onChange={(e) => setVoteTokens(Number(e.target.value))}
                        aria-labelledby="voteSliderLabel"
                    />
                    <p className="text-sm text-gray-500" id="voteSliderLabel">Tokens to use: {voteTokens}</p>
                    <button
                        onClick={handleCastVote}
                        className={`mt-2 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded ${voteTokens === 0 ? 'opacity-50 cursor-not-allowed bg-gray-400 hover:bg-gray-400' : ''}`}
                        disabled={voteTokens === 0}
                    >
                        {userVoteForElection?.proposal_id === selectedProposalId ? "Change your vote" : "Confirm Vote"}
                    </button>
                </div>
            )}

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