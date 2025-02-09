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
import ElectionList from './components/ElectionList';
import { getGroupDetails, getGroupMembers, getGroupElections } from '@/api/groups';
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
            <Link href={`/groups`} className="inline-block mb-4 text-blue-500 hover:underline">
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
                        {isAdmin && (
                            <button
                                onClick={() => handleOpenEditTokenModal(member)}
                                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded text-sm"
                                aria-label={`Edit tokens for ${member.user.email}`}
                            >
                                Edit Tokens
                            </button>
                        )}
                    </li>
                ))}
            </ul>

            {/* Invite User Button (only for admins) */}
            {isAdmin && (
                <button
                    onClick={handleOpenInviteModal}
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-4"
                >
                    Invite User
                </button>
            )}

            {/* Start Election Button (only for admins) */}
            {isAdmin && (
                <button
                    onClick={handleOpenStartElectionModal}
                    className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mb-4 ml-4"
                >
                    Start Election
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
        </div>
    );
};

export default GroupDetailsPage;