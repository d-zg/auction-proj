// src/app/groups/[group_id]/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useAuthContext } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import InviteUserModal from './components/InviteUserModal';
import StartElectionModal from './components/StartElectionModal';
import EditTokenBalanceModal from './components/EditTokenBalanceModal'; // Import the new modal
import EditTokenSettingsModal from './components/EditTokenSettingsModal';
import ElectionList from './components/ElectionList';
import { getGroupDetails, getGroupMembers, getGroupElections, removeUserFromGroup } from '@/api/groups';
import { User, Membership, MemberWithDetails, Group, Election } from '@/models/models'; //

const GroupDetailsPage: React.FC = () => {
    const { user } = useAuthContext() as { user: any };
    const router = useRouter();
    const [group, setGroup] = useState<Group | null>(null);
    const [members, setMembers] = useState<MemberWithDetails[]>([]);
     const [elections, setElections] = useState<Election[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const pathname = usePathname();
    const [isAdmin, setIsAdmin] = useState(false);
    const [isStartElectionModalOpen, setIsStartElectionModalOpen] = useState(false);
    const [isEditTokenModalOpen, setIsEditTokenModalOpen] = useState(false); // State for EditTokenBalanceModal
    const [isEditTokenSettingsModalOpen, setIsEditTokenSettingsModalOpen] = useState(false); // State for EditTokenSettingsModal
    const [memberToEdit, setMemberToEdit] = useState<MemberWithDetails | null>(null); // State to track member being edited

    const groupId = pathname.split('/')[2];

    const fetchGroupData = async () => {
        if (!user || !groupId) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const token = await user.getIdToken();

            const groupData = await getGroupDetails(groupId, token);
            const membersData = await getGroupMembers(groupId, token);
             const electionsData = await getGroupElections(groupId, token);

            setGroup(groupData);
            setMembers(membersData);
             setElections(electionsData);
            setError(null);

            const currentUserMembership = membersData.find(
                (member) => member.membership.user_id === user.uid
            );
            if (currentUserMembership && currentUserMembership.membership.role === 'admin') {
                setIsAdmin(true);
            }
        } catch (err: any) {
            console.error('Error fetching group details:', err);
            setError(`Failed to fetch group details: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user == null) {
            router.push('/');
        }
    }, [user, router]);

    useEffect(() => {
        fetchGroupData();
    }, [user, groupId]);

    const handleOpenInviteModal = () => setIsInviteModalOpen(true);
    const handleCloseInviteModal = () => setIsInviteModalOpen(false);

    const handleOpenStartElectionModal = () => setIsStartElectionModalOpen(true);
    const handleCloseStartElectionModal = () => setIsStartElectionModalOpen(false);

    const handleOpenEditTokenModal = (member: MemberWithDetails) => {
        setMemberToEdit(member);
        setIsEditTokenModalOpen(true);
    };

    const handleCloseEditTokenModal = () => {
        setIsEditTokenModalOpen(false);
        setMemberToEdit(null); // Clear member to edit when modal closes
    };

    const handleOpenEditTokenSettingsModal = () => setIsEditTokenSettingsModalOpen(true);
    const handleCloseEditTokenSettingsModal = () => setIsEditTokenSettingsModalOpen(false);

    const handleRemoveMember = async (memberToRemove: MemberWithDetails) => {
        if (!user || !groupId) return;
        if (!isAdmin) {
            alert("Only admins can remove members."); // Or handle this with better UI feedback
            return;
        }
        if (!window.confirm(`Are you sure you want to remove ${memberToRemove.user.email} from the group?`)) {
            return; // User cancelled removal
        }

        setLoading(true);
        setError(null);
        try {
            const token = await user.getIdToken();
            if (typeof memberToRemove.user.email === 'string') { // Check if email is a string
                await removeUserFromGroup(groupId, memberToRemove.user.email, token);
                alert(`${memberToRemove.user.email} removed from group.`);
                fetchGroupData(); // Refresh member list
            } else {
                setError("Could not remove member: Email address is missing."); // Handle case where email is null
                console.error("Error removing member: Email address is missing.");
            }

        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to remove member.');
            console.error("Error removing member:", err);
        } finally {
            setLoading(false);
        }
    };


    if (loading) {
        return <div>Loading group details...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }

    if (!group) {
        return <div>Group not found.</div>;
    }

    return (
        <div className="container mx-auto p-4">
            <Link href={`/groups`} className="inline-block mb-4 text-blue-500 hover:underline" aria-label="Back to groups list">
                ← Back to Groups
            </Link>

            <h1 className="text-2xl font-bold mb-4">{group.name}</h1>
            <p className="text-gray-700 mb-4">{group.description}</p>

            {/* Members Section */}
            <h2 className="text-xl font-semibold mb-2">Members</h2>
            <ul className="mb-4">
                {members.map((member) => (
                    <li key={member.membership.membership_id} className="flex items-center justify-between mb-2">
                        <div>
                            <span className="mr-2">{member.user.email}</span>
                            <span className="text-sm text-gray-600">({member.membership.role})</span>
                        </div>
                        <div className="text-sm text-gray-600">
                            Tokens: {member.membership.token_balance}
                        </div>
                        <div className="flex gap-2">
                            {isAdmin && member.membership.user_id !== user.uid && ( // Don't allow admin to remove themselves with this button
                                <button
                                    onClick={() => handleRemoveMember(member)}
                                    className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded text-sm"
                                    aria-label={`Remove ${member.user.email} from group`}
                                >
                                    Remove
                                </button>
                            )}
                            {isAdmin && (
                                <button
                                    onClick={() => handleOpenEditTokenModal(member)}
                                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded text-sm"
                                    aria-label={`Edit tokens for ${member.user.email}`}
                                >
                                    Edit Tokens
                                </button>
                            )}
                        </div>
                    </li>
                ))}
            </ul>

            {/* Invite User Button (only for admins) */}
            {isAdmin && (
                <button
                    onClick={handleOpenInviteModal}
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-4"
                    aria-label="Invite user to group"
                >
                    Invite User
                </button>
            )}

            {/* Start Election Button (only for admins) */}
            {isAdmin && (
                <button
                    onClick={handleOpenStartElectionModal}
                    className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mb-4 ml-4"
                    aria-label="Start a new election"
                >
                    Start Election
                </button>
            )}

            {/* Edit Token Settings Button (only for admins) */}
            {isAdmin && (
                <button
                    onClick={handleOpenEditTokenSettingsModal}
                    className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded mb-4 ml-4"
                    aria-label="Edit token settings for the group"
                >
                    Edit Token Settings
                </button>
            )}

            {/* Elections Section */}
            <h2 className="text-xl font-semibold mb-2">Elections</h2>
            {elections.length > 0 ? (
                <ul className="mb-4">
                  <ElectionList groupId={groupId} elections={elections} />
                </ul>
            ) : (
                <p>No elections found for this group.</p>
            )}

            {/* Invite User Modal */}
            <InviteUserModal
                isOpen={isInviteModalOpen}
                onClose={handleCloseInviteModal}
                groupId={groupId}
                user={user}
                fetchGroupDetails={fetchGroupData}
            />

            {/* Start Election Modal */}
            <StartElectionModal
                isOpen={isStartElectionModalOpen}
                onClose={handleCloseStartElectionModal}
                groupId={groupId}
                user={user}
                fetchGroupDetails={fetchGroupData}
            />

            {/* Edit Token Balance Modal */}
            <EditTokenBalanceModal
                isOpen={isEditTokenModalOpen}
                onClose={handleCloseEditTokenModal}
                groupId={groupId}
                member={memberToEdit}
                user={user}
                fetchGroupDetails={fetchGroupData}
            />
             {/* Edit Token Settings Modal */}
             <EditTokenSettingsModal
                isOpen={isEditTokenSettingsModalOpen}
                onClose={handleCloseEditTokenSettingsModal}
                groupId={groupId}
                user={user}
                fetchGroupDetails={fetchGroupData}
            />
        </div>
    );
};

export default GroupDetailsPage;