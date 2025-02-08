// src/app/groups/[group_id]/components/EditTokenBalanceModal.tsx
import React, { useState, useEffect } from 'react';
import { MemberWithDetails, Membership } from '@/models/models';
import { updateMemberTokenBalance } from '@/api/groups';
import { AxiosError } from 'axios'; // Import AxiosError type

interface EditTokenBalanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    groupId: string;
    member: MemberWithDetails | null;
    user: any;
    fetchGroupDetails: () => Promise<void>; // Function to refresh group details
}

const EditTokenBalanceModal: React.FC<EditTokenBalanceModalProps> = ({
    isOpen,
    onClose,
    groupId,
    member,
    user,
    fetchGroupDetails,
}) => {
    const [tokenBalance, setTokenBalance] = useState<number>(0);
    const [sliderValue, setSliderValue] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        if (member) {
            setTokenBalance(member.membership.token_balance);
            setSliderValue(member.membership.token_balance);
        } else {
            setTokenBalance(0);
            setSliderValue(0);
        }
        setError(null);
        setSuccess(null);
    }, [member, isOpen]); // Reset state when modal opens or member changes

    const handleSaveTokenBalance = async () => {
        if (!user || !member) return;
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const token = await user.getIdToken();
            const updatedMembership: Membership = await updateMemberTokenBalance(groupId, member.membership.user_id, { token_balance: tokenBalance }, token);

            setSuccess('Token balance updated successfully!');
            setError(null);
            setTimeout(() => { // Small delay before closing for feedback
                onClose();
                fetchGroupDetails(); // Refresh group details to reflect changes
            }, 500);

        } catch (err: any) {
            if (err instanceof AxiosError) {
                setError(err.response?.data?.detail || 'Failed to update token balance.'); // More specific error from backend
            } else {
                setError('An unexpected error occurred while updating token balance.'); // General error
            }
            setSuccess(null);
            console.error("Error updating token balance:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value)) {
            setTokenBalance(value);
            setSliderValue(value);
        }
    };

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        setSliderValue(value);
        setTokenBalance(value);
    };


    if (!isOpen || !member) return null;

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
            <div className="bg-white p-8 rounded shadow-lg w-full max-w-md">
                <h2 className="text-2xl font-bold mb-4">Edit Token Balance</h2>
                {error && <div className="text-red-500 mb-4">{error}</div>}
                {success && <div className="text-green-500 mb-4">{success}</div>}

                <div className="mb-4">
                    <label htmlFor="tokenBalanceText" className="block text-gray-700 text-sm font-bold mb-2">
                        Token Balance
                    </label>
                    <input
                        type="number"
                        id="tokenBalanceText"
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        value={tokenBalance}
                        onChange={handleInputChange}
                    />
                </div>

                <div className="mb-6">
                    <label htmlFor="tokenBalanceSlider" className="block text-gray-700 text-sm font-bold mb-2">
                        Token Balance Slider (Max 100)
                    </label>
                    <input
                        type="range"
                        id="tokenBalanceSlider"
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                        min="0"
                        max="100"
                        value={sliderValue}
                        onChange={handleSliderChange}
                    />
                    <p className="text-gray-600 text-sm mt-1">Selected Value: {sliderValue}</p>
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
                        onClick={handleSaveTokenBalance}
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditTokenBalanceModal;