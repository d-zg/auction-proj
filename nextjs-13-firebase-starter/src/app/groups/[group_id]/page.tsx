'use client';
import { useEffect, useState } from 'react';
import { useAuthContext } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import InviteUserModal from './components/InviteUserModal';
import StartElectionModal from './components/StartElectionModal';
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
      <h1 className="text-2xl font-bold mb-4">{group.name}</h1>
      <p className="text-gray-700 mb-4">{group.description}</p>

      {/* Members Section */}
      <h2 className="text-xl font-semibold mb-2">Members</h2>
      <ul className="mb-4">
        {members.map((member) => (
          <li key={member.membership.membership_id} className="flex items-center mb-2">
            <span className="mr-2">{member.user.email}</span>
            <span className="text-sm text-gray-600">({member.membership.role})</span>
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
          {elections.map((election) => (
            <li key={election.election_id} className="mb-2">
              <Link href={`/groups/${groupId}/elections/${election.election_id}`}>
                <div className="hover:underline cursor-pointer">
                  <span>
                    {election.start_date} to {election.end_date} (Status: {election.status})
                  </span>
                </div>
              </Link>
            </li>
          ))}
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
    </div>
  );
};

export default GroupDetailsPage;