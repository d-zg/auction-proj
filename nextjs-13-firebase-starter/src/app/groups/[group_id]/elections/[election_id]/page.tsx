// src/app/groups/[group_id]/elections/[election_id]/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useAuthContext } from '@/context/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getElectionDetails, closeElectionEarly, startElectionNow } from '@/api/elections';
import { getGroupMembers } from '@/api/groups'; // Import getGroupMembers
import { Election } from '@/models/models';
import ElectionProposalList from './components/ElectionProposalList';

const ElectionDetailsPage: React.FC = () => {
    const { user } = useAuthContext() as { user: any };
    const router = useRouter();
    const params = useParams();
    const groupId = params.group_id as string;
    const electionId = params.election_id as string;
    const [election, setElection] = useState<Election | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false); // Track admin status

    useEffect(() => {
        const fetchElectionDetailsData = async () => {
            if (!groupId || !electionId || !user) return;
            setLoading(true);
            setError(null);
            try {
                const token = await user.getIdToken();
                const electionDetails = await getElectionDetails(groupId, electionId, token);
                setElection(electionDetails);

                // --- CORRECT ADMIN CHECK ---
                const membersData = await getGroupMembers(groupId, token); // Fetch group members
                const currentUserMembership = membersData.find(member => member.membership.user_id === user.uid); // Find current user's membership
                setIsAdmin(currentUserMembership?.membership.role === 'admin' || false); // Check role from membership
                // --- END CORRECT ADMIN CHECK ---


            } catch (err: any) {
                setError(err.message || 'Failed to load election details.');
                console.error("Error fetching election details:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchElectionDetailsData();
    }, [groupId, electionId, user]);

    const handleCloseElectionEarly = async () => {
        if (!user || !groupId || !electionId) return;
        if (!window.confirm("Are you sure you want to close this election early? This action is irreversible.")) {
            return; // User cancelled
        }

        setLoading(true);
        setError(null);
        try {
            console.log("Calling closeElectionEarly API..."); // DEBUG: Log API call start
            const token = await user.getIdToken();
            const closedElection = await closeElectionEarly(groupId, electionId, token); // Call closeElectionEarly API
            console.log("closeElectionEarly API call successful:", closedElection); // DEBUG: Log API call success
            setElection(closedElection); // Update election details with closed election
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
            console.log("Calling startElectionNow API..."); // DEBUG: Log API call start
            const token = await user.getIdToken();
            const startedElection = await startElectionNow(groupId, electionId, token); // Call startElectionNow API
            console.log("startElectionNow API call successful:", startedElection); // DEBUG: Log API call success
            setElection(startedElection); // Update local election state
            alert(`Election "${startedElection.election_name}" started successfully.`);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to start election early.');
            console.error("Error starting election early:", err);
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

    // --- DEBUG LOGS - Keep these for now to verify ---
    console.log("isAdmin value:", isAdmin);
    console.log("election.status value:", election.status);
    console.log("Condition isAdmin && election.status === 'open':", isAdmin && election.status === 'open');
    // --- END DEBUG LOGS ---


    return (
        <div className="container mx-auto p-4">
            <Link href={`/groups/${groupId}`} className="inline-block mb-4 text-blue-500 hover:underline">
                ← Back to Group
            </Link>

            <h1 className="text-2xl font-bold mb-2">{election.election_name}</h1>
            <p className="text-gray-700 mb-4">
                {new Date(election.start_date).toLocaleString()} - {new Date(election.end_date).toLocaleString()}
                <span className="ml-2">Status: {election.status}</span>
            </p>

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
                    className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded mb-4 ml-4" // Added ml-4 for spacing
                    aria-label="Close election early"
                >
                    Close Election Early
                </button>
            )}

            <ElectionProposalList electionId={electionId} groupId={groupId} />

        </div>
    );
};

export default ElectionDetailsPage;