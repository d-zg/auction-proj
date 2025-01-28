import { useState } from 'react';
import { inviteUserToGroup } from '@/api/groups';

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  user: any;
  fetchGroupDetails: () => Promise<void>;
}

const InviteUserModal: React.FC<InviteUserModalProps> = ({
  isOpen,
  onClose,
  groupId,
  user,
  fetchGroupDetails,
}) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleInvite = async () => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await inviteUserToGroup(groupId, email, token);

      if (response.status === 201) {
        setSuccess('User invited successfully!');
        setError(null);
        setEmail('');
        onClose();
        fetchGroupDetails();
      } else {
        setError('Failed to invite user.');
        setSuccess(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'An error occurred.');
      setSuccess(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
      <div className="bg-white p-5 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold mb-4">Invite User to Group</h2>
        {error && <div className="text-red-500 mb-4">{error}</div>}
        {success && <div className="text-green-500 mb-4">{success}</div>}
        <input
          type="email"
          placeholder="Enter user email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border border-gray-300 p-2 rounded w-full mb-4"
        />
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded mr-2"
          >
            Cancel
          </button>
          <button
            onClick={handleInvite}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Invite
          </button>
        </div>
      </div>
    </div>
  );
};

export default InviteUserModal;