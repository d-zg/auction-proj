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
    members: MemberWithDetails[]; // Receive members as prop
    electionId: string; // Receive electionId as prop
}

const ElectionProposalList: React.FC<ElectionProposalListProps> = ({ electionDetails, groupId, isAdmin, members, electionId }) => { // Receive electionDetails and isAdmin as props, and electionId
    const { user } = useAuthContext() as { user: any };
    // const [electionDetails, setElectionDetails] = useState<Election | null>(null); // No longer manage electionDetails here
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newProposalTitle, setNewProposalTitle] = useState('');
    const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
    const [voteTokens, setVoteTokens] = useState<number>(0);
    const [userVoteForElection, setUserVoteForElection] = useState<Vote | null>(null);
    // const [isAdmin, setIsAdmin] = useState(false); // No longer manage isAdmin here
    const [userTokenBalance, setUserTokenBalance] = useState<number>(0);
    const router = useRouter();

    useEffect(() => {
        const fetchProposalListData = async () => { // Fetch only proposal list related data
            if (!user || !electionDetails) return; // Depend on prop electionDetails
            setLoading(true);
            setError(null);
            try {
                const token = await user.getIdToken();


                const membershipDetails: Membership = await getMembershipDetails(groupId, token);
                setUserTokenBalance(membershipDetails.token_balance);

                const myVote = await getMyVoteForElection(groupId, electionId, token); // Use electionId prop here!
                setUserVoteForElection(myVote);


                if (!electionDetails.proposals?.some(p => p.proposal_id === selectedProposalId)) {
                    setSelectedProposalId(null);
                    setVoteTokens(0);
                }

            } catch (err: any) {
                setError(err.message || 'Failed to load proposal list data');
                console.error("Error fetching proposal list data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchProposalListData(); // Call function to fetch proposal list related data
    }, [electionId, groupId, user, electionDetails]); // Depend on prop electionDetails, and now electionId is available

    if (loading) {
        return <div>Loading election proposals...</div>;
    }

    if (error || !electionDetails) { // Use prop electionDetails
        return <div>Error: {error || 'Could not load election details'}</div>;
    }

    const handleAddProposal = async () => {
        if (!user || !newProposalTitle.trim()) return;
        try {
            const token = await user.getIdToken();
            const proposalData = { title: newProposalTitle };
            await addProposalToElection(groupId, electionId, proposalData, token); // Use electionId prop here!
            setNewProposalTitle('');
            const updatedDetails = await getElectionDetails(groupId, electionId, token);
            // setElectionDetails(updatedDetails); // Parent component now manages electionDetails, no need to update here - or maybe update parent via callback? For now re-fetch in parent.
            // Instead of updating local state, trigger a refresh in the parent component, or ideally use optimistic updates and invalidate cache

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
            const newVote = await castVote(groupId, electionId, voteData, token); // Use electionId prop here!
            alert('Vote cast successfully!');

            setUserVoteForElection(newVote);
            // const updatedDetails = await getElectionDetails(groupId, electionId, token); // No need to refetch all details here
            // setElectionDetails(updatedDetails);
            router.refresh(); // Refresh route to reflect vote changes

        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to cast vote');
            console.error("Error casting vote:", err);
        }
    };

    const handleDeleteProposal = async (proposalId: string) => {
        if (!user || !isAdmin || electionDetails.status !== 'upcoming') return; // Use prop isAdmin and electionDetails

        if (!window.confirm("Are you sure you want to delete this proposal?")) {
            return;
        }

        try {
            const token = await user.getIdToken();
            await deleteProposal(groupId, electionId, proposalId, token); // Use electionId prop here!
            // const updatedDetails = await getElectionDetails(groupId, electionId, token); // No need to refetch all details here
            // setElectionDetails(updatedDetails);
            router.refresh(); // Refresh route to reflect proposal deletion

            alert('Proposal deleted successfully!');
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to delete proposal');
            console.error("Error deleting proposal:", err);
        }
    };

    const handleProposalClick = (proposal: Proposal) => {
        setSelectedProposalId(proposal.proposal_id);
        // If user has a vote, pre-fill tokens from their vote, otherwise 0
        setVoteTokens(userVoteForElection?.proposal_id === proposal.proposal_id ? userVoteForElection?.tokens_used : 0);
    };

    const renderProposals = () => {
        console.log('here');
        console.log(electionDetails.proposals);
        if (!electionDetails.proposals) return <div>No proposals yet.</div>; // Use prop electionDetails

        return electionDetails.proposals.map((proposal) => { // Use prop electionDetails
            const userHasVotedForThisProposal = userVoteForElection?.proposal_id === proposal.proposal_id;

            return (
                <div key={proposal.proposal_id}
                    className={`mb-4 p-4 border rounded flex items-start justify-between ${selectedProposalId === proposal.proposal_id ? 'bg-gray-100' : 'bg-white hover:bg-gray-50'} ${userHasVotedForThisProposal ? 'bg-gray-200' : ''}`}
                    onClick={() => handleProposalClick(proposal)}
                >
                    <div>
                        <h4 className="font-semibold cursor-pointer">{proposal.title}</h4>
                        {electionDetails.status === 'open' && userHasVotedForThisProposal && ( // Use prop electionDetails
                            <div className="mt-2 relative">
                                <p className="text-sm text-gray-600">
                                    Voted with {userVoteForElection?.tokens_used ?? 0} tokens
                                </p>
                            </div>
                        )}
                        {electionDetails.status === 'closed' && proposal.votes && proposal.votes.length > 0 && ( // Use prop electionDetails
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
                        {electionDetails.status === 'closed' && electionDetails.winning_proposal_id === proposal.proposal_id && ( // Use prop electionDetails
                            <p className="mt-2 font-bold text-green-600">Winning Proposal!</p>
                        )}
                    </div>
                    {isAdmin && electionDetails.status === 'upcoming' && ( // Use prop isAdmin and electionDetails
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
        <div key={"election_prop"}>
            {error && <p className="text-red-500">{error}</p>}
            <h3 className="text-xl font-semibold mb-4">Proposals</h3>
            {renderProposals()}

            {electionDetails?.status === 'open' && selectedProposalId && ( // Use prop electionDetails
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

            {electionDetails?.status === 'upcoming' && ( // Use prop electionDetails
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