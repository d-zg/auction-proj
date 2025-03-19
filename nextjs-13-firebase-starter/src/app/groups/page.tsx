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
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc'); // New state for sort order
    const sortOptions = ['lastElection', 'name']; // Available sort options

    useEffect(() => {
        if (user == null) {
            router.push("/");
        }
    }, [user, router]);

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
        const groupName = prompt('Enter the name of the new group:');
        if (!groupName) {
            alert("No group name was given.");
            return;
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
            });

            if (response.status === 201) {
                alert(`Successfully created group: ${response.data.name}`);
                // Refetch groups to update the list
                fetchGroupsData();
            } else {
                alert(`Failed to create group with status ${response.status}`);
            }
        } catch (err: any) {
            alert(`Failed to create group: ${err.message}`);
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

    // Filter groups by name using searchQuery
    const filteredGroups = useMemo(() => {
        return groupsEnhanced.filter(group =>
            group.group.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [groupsEnhanced, searchQuery]);

    // Sort groups based on sortBy and sortOrder
    const sortedGroups = useMemo(() => {
        let sorted = [...filteredGroups]; // Sort filtered groups

        if (sortBy === 'name') {
            sorted.sort((a, b) => {
                return sortOrder === 'asc'
                    ? a.group.name.localeCompare(b.group.name)
                    : b.group.name.localeCompare(a.group.name);
            });
        } else if (sortBy === 'lastElection') {
            sorted.sort((a, b) => {
                const dateA = a.last_election_date ? new Date(a.last_election_date).getTime() : (sortOrder === 'asc' ? Infinity : -Infinity);
                const dateB = b.last_election_date ? new Date(b.last_election_date).getTime() : (sortOrder === 'asc' ? Infinity : -Infinity);
                return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
            });
        }
        return sorted;
    }, [filteredGroups, sortBy, sortOrder]);

    if (loading) {
        return <div>Loading groups...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }

return (
    <div className="container mx-auto p-6 max-w-6xl bg-gray-50 min-h-screen">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-3xl font-bold text-gray-800">My Groups</h1>
        <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center gap-2 shadow-sm"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
                fillRule="evenodd"
                d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7z"
                clipRule="evenodd"
            />
            <path d="M8 7a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" />
            </svg>
            Logout
        </button>
        </div>

        {/* Control Panel with improved styling */}
        <div className="bg-white p-5 rounded-xl shadow-md mb-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            <select
                className="bg-gray-50 border border-gray-300 text-gray-700 rounded-lg py-2.5 px-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 w-full sm:w-auto"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
            >
                <option value="lastElection">Sort by Last Election</option>
                <option value="name">Sort by Name</option>
            </select>
            <button
                onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2.5 px-4 rounded-lg transition-colors duration-200 w-full sm:w-auto justify-center"
            >
                {sortOrder === "asc" ? (
                <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                        fillRule="evenodd"
                        d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
                        clipRule="evenodd"
                    />
                    </svg>
                    Ascending
                </>
                ) : (
                <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                        fillRule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clipRule="evenodd"
                    />
                    </svg>
                    Descending
                </>
                )}
            </button>
            </div>

            <div className="w-full md:w-auto">
            <button
                onClick={handleCreateGroup}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-lg transition-colors duration-200 flex items-center gap-2 shadow-sm w-full justify-center"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                    fillRule="evenodd"
                    d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                    clipRule="evenodd"
                />
                </svg>
                Create New Group
            </button>
            </div>
        </div>

        {/* Search bar with improved styling */}
        <div className="mt-4 w-full">
            <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg
                className="w-5 h-5 text-gray-500"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
                >
                <path
                    fillRule="evenodd"
                    d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                    clipRule="evenodd"
                ></path>
                </svg>
            </div>
            <input
                type="search"
                placeholder="Search groups..."
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 p-2.5 transition-all duration-200"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
            </div>
        </div>
        </div>

        {sortedGroups.length > 0 ? (
        <ul className="space-y-5">
            {sortedGroups.map((groupEnhanced) => (
            <li
                key={groupEnhanced.group.group_id}
                className="bg-white shadow-md rounded-xl p-5 hover:shadow-lg transition-shadow duration-200 border border-gray-100"
            >
                <Link href={`/groups/${groupEnhanced.group.group_id}`} className="block">
                <div className="flex justify-between items-start">
                    <h2 className="text-xl font-semibold text-gray-800 hover:text-blue-600 transition-colors duration-200 flex items-center group-header">
                    {groupEnhanced.group.name}
                    {groupEnhanced.has_active_elections && (
                        <span className="ml-2 text-sm font-medium px-2 py-1 bg-green-100 text-green-800 rounded-full">
                        Active Election
                        </span>
                    )}
                    </h2>
                    <div className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                    {groupEnhanced.last_election_date
                        ? new Date(groupEnhanced.last_election_date).toLocaleDateString()
                        : "No Elections Yet"}
                    </div>
                </div>
                <p className="text-gray-700 mt-3 line-clamp-2">{groupEnhanced.group.description}</p>
                <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                    <div className="flex items-center">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-gray-400 mr-1"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                    >
                        <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                        clipRule="evenodd"
                        />
                    </svg>
                    <span className="text-sm text-gray-500">
                        Created {new Date(groupEnhanced.group.created_at).toLocaleDateString()}
                    </span>
                    </div>
                    <span className="text-blue-600 text-sm font-medium hover:underline">View Details →</span>
                </div>
                </Link>
            </li>
            ))}
        </ul>
        ) : (
        <div className="bg-white shadow-md rounded-xl p-8 text-center">
            <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-16 w-16 text-gray-300 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
            </svg>
            <p className="text-gray-600 text-lg">You are not a member of any groups yet.</p>
            <button
            onClick={handleCreateGroup}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors duration-200 inline-flex items-center gap-2"
            >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                fillRule="evenodd"
                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                clipRule="evenodd"
                />
            </svg>
            Create Your First Group
            </button>
        </div>
        )}
    </div>
    )
}

export default GroupsPage

