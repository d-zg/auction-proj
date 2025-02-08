'use client';

import React, { useEffect, useState } from 'react';
import { useAuthContext } from '@/context/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getElectionDetails } from '@/api/elections';
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

    useEffect(() => {
        if (!user) {
            router.push("/");
        }
    }, [user, router]);

    useEffect(() => {
        const fetchElectionDetails = async () => {
            if (!groupId || !electionId || !user) return;
            setLoading(true);
            setError(null);
            try {
                const token = await user.getIdToken();
                const electionDetails = await getElectionDetails(groupId, electionId, token);
                setElection(electionDetails);
            } catch (err: any) {
                setError(err.message || 'Failed to load election details.');
                console.error("Error fetching election details:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchElectionDetails();
    }, [groupId, electionId, user]);


    if (loading) {
        return <div>Loading election details...</div>;
    }

    if (error || !election) {
        return <div>Error: {error || 'Failed to load election.'}</div>;
    }


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

            <ElectionProposalList electionId={electionId} groupId={groupId} />

        </div>
    );
};

export default ElectionDetailsPage;