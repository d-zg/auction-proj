// src/app/groups/[group_id]/components/EditTokenSettingsModal.tsx
import React, { useState, useEffect } from 'react';
import { Group } from '@/models/models';
import { updateGroupTokenSettings, getGroupDetails } from '@/api/groups';
import { AxiosError } from 'axios'; // Import AxiosError type

interface EditTokenSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    fetchGroupDetails: () => Promise<void>; // Function to refresh group details
    groupId: string;
    user: any;
}

const EditTokenSettingsModal: React.FC<EditTokenSettingsModalProps> = ({
    isOpen,
    onClose,
    groupId,
    user,
    fetchGroupDetails,
}) => {
    const [regenerationRate, setRegenerationRate] = useState<number>(1);
    const [regenerationInterval, setRegenerationInterval] = useState<string>('election');
    const [maxTokens, setMaxTokens] = useState<number>(10);
    const [initialTokens, setInitialTokens] = useState<number>(5);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        setError(null);
        setSuccess(null);
        const loadGroupDetails = async () => {
            if (!user || !groupId) return;
            try {
                setLoading(true);
                const token = await user.getIdToken();
                const groupData: Group = await getGroupDetails(groupId, token);
                if (groupData.token_settings) {
                    setRegenerationRate(groupData.token_settings.regeneration_rate);
                    setRegenerationInterval(groupData.token_settings.regeneration_interval);
                    setMaxTokens(groupData.token_settings.max_tokens);
                    setInitialTokens(groupData.token_settings.initial_tokens);
                }
            } catch (err) {
                console.error("Error loading group details for token settings:", err);
            } finally {
                setLoading(false);
            }
        };
        loadGroupDetails();
    }, [groupId, user, isOpen]);

    const handleSaveTokenSettings = async () => {
        if (!user || !groupId) return;
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
             const tokenSettings = {
                regeneration_rate: regenerationRate,
                regeneration_interval: regenerationInterval,
                max_tokens: maxTokens,
                initial_tokens: initialTokens
            };

            const token = await user.getIdToken();
            // Explicitly type tokenSettings payload as any, or create a proper type
            await updateGroupTokenSettings(groupId, tokenSettings, token);

            setSuccess('Token settings updated successfully!');
            setError(null);
            setTimeout(() => { // Small delay before closing for feedback
                onClose();
                fetchGroupDetails(); // Refresh group details to reflect changes
            }, 500);

        } catch (err: any) {
            if (err instanceof AxiosError) {
                setError(err.response?.data?.detail || 'Failed to update token settings.'); // More specific error from backend
            } else {
                setError('An unexpected error occurred while updating token settings.'); // General error
            }
            setSuccess(null);
            console.error("Error updating token settings:", err);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
            <div className="bg-white p-8 rounded shadow-lg w-full max-w-md">
                <h2 className="text-2xl font-bold mb-4">Edit Token Settings</h2>
                {error && <div className="text-red-500 mb-4">{error}</div>}
                {success && <div className="text-green-500 mb-4">{success}</div>}

                <div className="mb-4">
                    <label htmlFor="regenerationRate" className="block text-gray-700 text-sm font-bold mb-2">
                        Regeneration Rate
                    </label>
                    <input
                        type="number"
                        id="regenerationRate"
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        value={regenerationRate}
                        onChange={(e) => {
                            const value = parseInt(e.target.value, 10);
                            if (!isNaN(value)) {
                                setRegenerationRate(value);
                            }
                        }}
                    />
                </div>

                <div className="mb-4">
                    <label htmlFor="regenerationInterval" className="block text-gray-700 text-sm font-bold mb-2">
                        Regeneration Interval
                    </label>
                    <select
                        id="regenerationInterval"
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        value={regenerationInterval}
                        onChange={(e) => setRegenerationInterval(e.target.value)}
                    >
                        <option value="daily">Daily</option>
                        <option value="election">Per Election</option>
                    </select>
                </div>

                <div className="mb-4">
                    <label htmlFor="maxTokens" className="block text-gray-700 text-sm font-bold mb-2">
                        Max Tokens
                    </label>
                    <input
                        type="number"
                        id="maxTokens"
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        value={maxTokens}
                        onChange={(e) => {
                            const value = parseInt(e.target.value, 10);
                            if (!isNaN(value)) {
                                setMaxTokens(value);
                            }
                        }}
                    />
                </div>

                <div className="mb-4">
                    <label htmlFor="initialTokens" className="block text-gray-700 text-sm font-bold mb-2">
                        Initial Tokens
                    </label>
                    <input
                        type="number"
                        id="initialTokens"
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        value={initialTokens}
                        onChange={(e) => {
                            const value = parseInt(e.target.value, 10);
                            if (!isNaN(value)) {
                                setInitialTokens(value);
                            }
                        }}
                    />
                </div>

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
                        onClick={handleSaveTokenSettings}
                    >
                        Save Settings
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditTokenSettingsModal;