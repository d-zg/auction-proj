import { useState } from 'react';
import { api } from '@/lib/api';

interface StartElectionModalProps {
  isOpen: boolean;
  onClose: () => void;
    groupId: string;
    user: any;
    fetchGroupDetails: () => Promise<void>;
}

const StartElectionModal: React.FC<StartElectionModalProps> = ({ isOpen, onClose, groupId, user, fetchGroupDetails }) => {
    const [startDate, setStartDate] = useState<Date>(new Date());
    const [endDate, setEndDate] = useState<Date>(new Date(new Date().getTime() + 60 * 60 * 1000));
  const [paymentOptions, setPaymentOptions] = useState('fiat');
  const [priceOptions, setPriceOptions] = useState('1.0');
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false);

  const handleStartElection = async () => {
      if(!user) {
          return
      }
      setLoading(true);

    try {
        const token = await user.getIdToken();


         const response = await api.post(
            `/groups/${groupId}/elections`,
            {
                start_date: startDate.toISOString(),
                end_date: endDate.toISOString(),
                payment_options: paymentOptions,
                price_options: priceOptions,
                 proposals: [{title: "proposal1"},{title: "proposal2"}]
            },
            {
              headers: {
                Authorization: `Bearer ${token}`
              }
            }
          );

      if (response.status === 201) {
          alert(`Successfully started election`)
        onClose();
          fetchGroupDetails();
        setError(null);
      } else {
        setError(`Failed to start election: ${response.status}`);
      }
    } catch (error: any) {
      setError(`Failed to start election: ${error.message}`);
        console.error(`Failed to start election: ${error.message}`);
    }
        finally {
            setLoading(false);
        }
  };

    const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setStartDate(new Date(e.target.value));
        if(endDate < new Date(e.target.value)) {
            setEndDate(new Date(new Date(e.target.value).getTime() + 60 * 60 * 1000));
        }
    }

      const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEndDate(new Date(e.target.value));
    }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
      <div className="bg-white p-8 rounded shadow-lg">
        <h2 className="text-2xl font-bold mb-4">Start Election</h2>

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
            <option value="fiat">Fiat</option>
            <option value="crypto">Crypto</option>
          </select>
        </div>

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
            <option value="1.0">1.0</option>
            <option value="2.5">2.5</option>
              <option value="5.0">5.0</option>
          </select>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex justify-end">
          <button
               disabled={loading}
            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded mr-2"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
               disabled={loading}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
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