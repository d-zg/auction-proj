// src/components/StartElectionModal.tsx
import { useState, KeyboardEvent } from 'react';
import { startElection } from '@/api/groups';

interface StartElectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  user: any;
  fetchGroupDetails: () => Promise<void>;
}

const StartElectionModal: React.FC<StartElectionModalProps> = ({
  isOpen,
  onClose,
  groupId,
  user,
  fetchGroupDetails,
}) => {
  const [name, setName] = useState<string>(''); // Election name
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date(new Date().getTime() + 60 * 60 * 1000));
  const [paymentOptions, setPaymentOptions] = useState<string>('allpay');
  const [priceOptions, setPriceOptions] = useState<string>('1,2,3');
  const [proposals, setProposals] = useState<string[]>([]); // Proposals list
  const [newProposal, setNewProposal] = useState<string>(''); // Current proposal input
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleStartElection = async () => {
    if (!user) return;

    if (proposals.length === 0) {
      setError('Please add at least one proposal.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const response = await startElection(
        name, // Election name
        groupId,
        startDate.toISOString(),
        endDate.toISOString(),
        paymentOptions,
        priceOptions,
        proposals, // User-submitted proposals
        token
      );

      if (response.status === 201) {
        alert(`Successfully started election "${name}"`);
        onClose();
        fetchGroupDetails();
      } else {
        setError(`Failed to start election: ${response.status}`);
      }
    } catch (error: any) {
      setError(`Failed to start election: ${error.message}`);
      console.error('Failed to start election:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartDate = new Date(e.target.value);
    setStartDate(newStartDate);
    if (endDate < newStartDate) {
      setEndDate(new Date(newStartDate.getTime() + 60 * 60 * 1000));
    }
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEndDate(new Date(e.target.value));
  };

  const handleNewProposalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewProposal(e.target.value);
  };

  const addProposal = () => {
    const trimmedProposal = newProposal.trim();
    if (trimmedProposal && !proposals.includes(trimmedProposal)) {
      setProposals([...proposals, trimmedProposal]);
      setNewProposal('');
    }
  };

  const removeProposal = (proposalToRemove: string) => {
    setProposals(proposals.filter((proposal) => proposal !== proposalToRemove));
  };

  const handleProposalKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addProposal();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
      <div className="bg-white p-8 rounded shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Start Election</h2>

        {/* Election Name Input */}
        <div className="mb-4">
          <label htmlFor="electionName" className="block text-gray-700 text-sm font-bold mb-2">
            Election Name
          </label>
          <input
            type="text"
            id="electionName"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={name}
            onChange={handleNameChange}
            placeholder="Enter election name"
            required
          />
        </div>

        {/* Start Date/Time Input */}
        <div className="mb-4">
          <label htmlFor="startDate" className="block text-gray-700 text-sm font-bold mb-2">
            Start Date/Time
          </label>
          <input
            type="datetime-local"
            id="startDate"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={startDate.toISOString().slice(0, 16)}
            onChange={handleStartDateChange}
          />
        </div>

        {/* End Date/Time Input */}
        <div className="mb-4">
          <label htmlFor="endDate" className="block text-gray-700 text-sm font-bold mb-2">
            End Date/Time
          </label>
          <input
            type="datetime-local"
            id="endDate"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={endDate.toISOString().slice(0, 16)}
            onChange={handleEndDateChange}
          />
        </div>

        {/* Payment Options Select */}
        <div className="mb-4">
          <label htmlFor="paymentOptions" className="block text-gray-700 text-sm font-bold mb-2">
            Payment Options
          </label>
          <select
            id="paymentOptions"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={paymentOptions}
            onChange={(e) => setPaymentOptions(e.target.value)}
          >
            <option value="allpay">All Pay</option>
            <option value="winnerspay">Winners Pay</option>
          </select>
        </div>

        {/* Price Options Select */}
        <div className="mb-4">
          <label htmlFor="priceOptions" className="block text-gray-700 text-sm font-bold mb-2">
            Price Options
          </label>
          <select
            id="priceOptions"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={priceOptions}
            onChange={(e) => setPriceOptions(e.target.value)}
          >
            <option value="1,2,3">First Price</option>
            <option value="2,3,4">Second Price</option>
          </select>
        </div>

        {/* Proposals Input */}
        <div className="mb-4">
          <label htmlFor="proposals" className="block text-gray-700 text-sm font-bold mb-2">
            Proposals
          </label>
          <div className="flex">
            <input
              type="text"
              id="proposals"
              className="shadow appearance-none border rounded-l w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={newProposal}
              onChange={handleNewProposalChange}
              onKeyDown={handleProposalKeyDown}
              placeholder="Enter proposal title"
            />
            <button
              type="button"
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-r"
              onClick={addProposal}
            >
              Add
            </button>
          </div>
          {proposals.length > 0 && (
            <ul className="mt-2">
              {proposals.map((proposal, index) => (
                <li key={index} className="flex justify-between items-center bg-gray-100 p-2 rounded mb-2">
                  <span>{proposal}</span>
                  <button
                    type="button"
                    className="text-red-500 hover:text-red-700"
                    onClick={() => removeProposal(proposal)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Error Message */}
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        {/* Action Buttons */}
        <div className="flex justify-end">
          <button
            disabled={loading}
            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded mr-2"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            disabled={loading || name.trim() === '' || proposals.length === 0}
            className={`${
              loading || name.trim() === '' || proposals.length === 0
                ? 'bg-blue-300 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-700'
            } text-white font-bold py-2 px-4 rounded`}
            onClick={handleStartElection}
          >
            {loading ? 'Starting...' : 'Start'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StartElectionModal;
