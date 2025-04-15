// src/app/groups/[group_id]/elections/[election_id]/components/ElectionProposalList.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Election, Proposal, Vote, VoteCreate, Membership, MemberWithDetails } from '@/models/models';
import { useAuthContext } from '@/context/AuthContext';
import { castVote, addProposalToElection, getElectionDetails, deleteProposal, getMyVoteForElection } from '@/api/elections';
import { getMembershipDetails } from '@/api/groups';
import { useRouter } from 'next/navigation';

interface ElectionProposalListProps {
    electionDetails: Election | null;
    groupId: string;
    isAdmin: boolean;
    members: MemberWithDetails[];
    electionId: string;
    onProposalAdded: () => Promise<void>;
}

const ElectionProposalList: React.FC<ElectionProposalListProps> = ({ electionDetails, groupId, isAdmin, members, electionId, onProposalAdded }) => {
    const { user } = useAuthContext() as { user: any };
    const [initialLoading, setInitialLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newProposalTitle, setNewProposalTitle] = useState('');
    const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
    const [voteTokens, setVoteTokens] = useState<number>(0);
    const [userVoteForElection, setUserVoteForElection] = useState<Vote | null>(null);
    const [userTokenBalance, setUserTokenBalance] = useState<number>(0);
    const [localProposals, setLocalProposals] = useState<Proposal[]>([]);
    const router = useRouter();

    useEffect(() => {
        // Update local proposals whenever electionDetails changes
        if (electionDetails?.proposals) {
            setLocalProposals(electionDetails.proposals);
        }
    }, [electionDetails?.proposals]);

    useEffect(() => {
        const fetchProposalListData = async () => {
            if (!user || !electionDetails) return;
            try {
                const token = await user.getIdToken();

                const membershipDetails: Membership = await getMembershipDetails(groupId, token);
                setUserTokenBalance(membershipDetails.token_balance);

                const myVote = await getMyVoteForElection(groupId, electionId, token);
                setUserVoteForElection(myVote);

                if (!electionDetails.proposals?.some(p => p.proposal_id === selectedProposalId)) {
                    setSelectedProposalId(null);
                    setVoteTokens(0);
                }
            } catch (err: any) {
                setError(err.message || 'Failed to load proposal list data');
                console.error("Error fetching proposal list data:", err);
            } finally {
                setInitialLoading(false);
            }
        };

        fetchProposalListData();
    }, [electionId, groupId, user, electionDetails]);

    if (initialLoading) {
        return <div>Loading election proposals...</div>;
    }

    if (error || !electionDetails) {
        return <div>Error: {error || 'Could not load election details'}</div>;
    }

    const handleAddProposal = async () => {
        if (!user || !newProposalTitle.trim()) return;
        
        // Create temporary proposal for optimistic update
        const tempProposal: Proposal = {
            proposal_id: 'temp_' + Date.now(),
            election_id: electionId,
            proposer_id: user.uid,
            title: newProposalTitle,
            created_at: new Date().toISOString(),
            votes: []
        };

        // Optimistically add the proposal
        setLocalProposals(prev => [...prev, tempProposal]);
        
        try {
            const token = await user.getIdToken();
            const proposalData = { title: newProposalTitle };
            await addProposalToElection(groupId, electionId, proposalData, token);
            setNewProposalTitle('');
            await onProposalAdded();
        } catch (err: any) {
            // Revert optimistic update on error
            setLocalProposals(prev => prev.filter(p => p.proposal_id !== tempProposal.proposal_id));
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
            router.refresh();

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
            router.refresh();

            alert('Proposal deleted successfully!');
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to delete proposal');
            console.error("Error deleting proposal:", err);
        }
    };

    const handleProposalClick = (proposal: Proposal) => {
        setSelectedProposalId(proposal.proposal_id);
        setVoteTokens(userVoteForElection?.proposal_id === proposal.proposal_id ? userVoteForElection.tokens_used : 0);
    };

    const renderProposals = () => {
        if (!localProposals?.length) return <div>No proposals yet.</div>;

        return localProposals.map((proposal) => {
            if (!proposal?.proposal_id) {
                console.error('Invalid proposal object:', proposal);
                return null;
            }

            const userHasVotedForThisProposal = userVoteForElection?.proposal_id === proposal.proposal_id;
            const isTemporary = proposal.proposal_id.startsWith('temp_');

            return (
                <div key={proposal.proposal_id}
                    className={`mb-4 p-4 border rounded flex items-start justify-between 
                        ${selectedProposalId === proposal.proposal_id ? 'bg-gray-100' : 'bg-white hover:bg-gray-50'} 
                        ${userHasVotedForThisProposal ? 'bg-gray-200' : ''}
                        ${isTemporary ? 'opacity-50' : ''}`}
                    onClick={() => !isTemporary && handleProposalClick(proposal)}
                >
                    <div>
                        <h4 className="font-semibold cursor-pointer">
                            {proposal.title}
                            {isTemporary && <span className="ml-2 text-gray-400">(Saving...)</span>}
                        </h4>
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
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProposal(proposal.proposal_id);
                            }}
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

            {electionDetails?.status === 'open' && selectedProposalId && (
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

            {electionDetails?.status === 'upcoming' && (
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