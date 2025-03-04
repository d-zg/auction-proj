'use client';
import { useEffect, useState, useMemo } from 'react';
import { useAuthContext } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import Link from 'next/link';
import { getAuth, signOut } from 'firebase/auth';
import firebase_app from '@/firebase/config';
import { EnhancedGroupResponse } from '@/models/models'; // Import EnhancedGroupResponse

interface GroupEnhanced extends EnhancedGroupResponse {} // Extend EnhancedGroupResponse

interface Group { // Original Group interface, assuming it's already defined
    group_id: string;
    name: string;
    description: string;
    created_at: string;
    updated_at: string;
    memberships: string[];
    elections: string[];
}


const GroupsPage: React.FC = () => {
    const { user, setUser } = useAuthContext() as { user: any, setUser: any };
    const router = useRouter();
    const [groupsEnhanced, setGroupsEnhanced] = useState<GroupEnhanced[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('lastElection'); // Default sort by last election
    const sortOptions = ['lastElection', 'name']; // Available sort options - removed admin and role

    useEffect(() => {
        if (user == null) {
            router.push("/")
        }
    }, [user, router])

    const fetchGroupsData = async () => {
        if (!user) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const token = await user.getIdToken();
            const response = await api.get('/groups/my-groups-enhanced/', { // Call the NEW endpoint
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (response.status === 200) {
                setGroupsEnhanced(response.data); // Data is already enhanced!
                setError(null);
            } else {
                setError(`Failed to fetch groups: ${response.status}`);
            }
        } catch (err: any) {
            console.error("Error fetching groups:", err);
            setError(`Failed to fetch groups: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchGroupsData();
    }, [user]);

    const handleCreateGroup = async () => {
        if (!user) {
            return;
        }
        const groupName = prompt('Enter the name of the new group:')
        if (!groupName) {
            alert("No group name was given.")
            return
        }
        const groupDescription = prompt('Enter an optional description for the group:') || "";

        try {
            const token = await user.getIdToken();

            const response = await api.post('/groups', {
                name: groupName,
                description: groupDescription
            }, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })

            if (response.status === 201) {
                alert(`Successfully created group: ${response.data.name}`)
                // Refetch groups to update the list
                fetchGroupsData();
            }
            else {
                alert(`Failed to create group with status ${response.status}`)
            }
        }
        catch (err: any) {
            alert(`Failed to create group: ${err.message}`)
        }
    };

    const handleLogout = async () => {
        const auth = getAuth(firebase_app);
        try {
            await signOut(auth);
            setUser(null);
            router.push('/');
        } catch (error) {
            console.error('Logout failed:', error);
            setError('Logout failed.');
        }
    };

    const filteredGroups = useMemo(() => {
        return groupsEnhanced.filter(group =>
            group.group.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [groupsEnhanced, searchQuery]);

    const sortedGroups = useMemo(() => {
        let sorted = [...filteredGroups]; // Sort filtered groups

        if (sortBy === 'name') {
            sorted.sort((a, b) => a.group.name.localeCompare(b.group.name));
        } else if (sortBy === 'lastElection') {
            sorted.sort((a, b) => {
                const dateA = a.last_election_date ? new Date(a.last_election_date).getTime() : -Infinity; // No election = bottom
                const dateB = b.last_election_date ? new Date(b.last_election_date).getTime() : -Infinity;
                return dateB - dateA; // Descending for last election
            });
        }
        return sorted;
    }, [filteredGroups, sortBy]);


    if (loading) {
        return <div>Loading groups...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }

    return (
        <div className="container mx-auto p-4">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold">My Groups</h1>
                <button
                    onClick={handleLogout}
                    className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                >
                    Logout
                </button>
            </div>

            <div className="mb-4 flex items-center space-x-4">
                <input
                    type="search"
                    placeholder="Search groups..."
                    className="shadow appearance-none border rounded w-1/3 py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <select
                    className="shadow appearance-none border rounded py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                >
                    <option value="lastElection">Sort by Last Election</option>
                    <option value="name">Sort by Name</option>
                </select>
                <button onClick={handleCreateGroup} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                    Create New Group
                </button>
            </div>


            {sortedGroups.length > 0 ? (
                <ul className="space-y-4">
                    {sortedGroups.map(groupEnhanced => (
                        <li key={groupEnhanced.group.group_id} className="bg-white shadow rounded p-4">
                            <Link href={`/groups/${groupEnhanced.group.group_id}`} >
                                <h2 className="text-xl font-semibold hover:underline cursor-pointer group-header">
                                    {groupEnhanced.group.name}
                                    {groupEnhanced.has_active_elections && (
                                        <span className="ml-2 text-sm text-green-600">(Open Election)</span>
                                    )}
                                </h2>
                            </Link>
                            <div className="group-details">
                                <p>
                                    Last Election: {groupEnhanced.last_election_date ? new Date(groupEnhanced.last_election_date).toLocaleDateString() : 'No Elections Yet'}
                                </p>
                            </div>
                            <p className="text-gray-700 mt-2">{groupEnhanced.group.description}</p>
                            <p className="text-gray-500 mt-1">
                                Created At: {new Date(groupEnhanced.group.created_at).toLocaleString()}
                            </p>
                        </li>
                    ))}
                </ul>
            ) : (
                <p>You are not a member of any groups yet.</p>
            )}
        </div>
    );
};

export default GroupsPage;