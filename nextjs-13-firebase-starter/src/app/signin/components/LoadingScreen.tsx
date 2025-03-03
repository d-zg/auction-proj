// src/app/signin/components/LoadingScreen.tsx
import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface LoadingScreenProps {
    onHealthCheckSuccess: () => void; // Callback when health check is successful
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ onHealthCheckSuccess }) => {
    const [loadingMessage, setLoadingMessage] = useState('Waking up the backend service...');
    const [retryDelay, setRetryDelay] = useState<number>(0); // Initial delay 0 for immediate check
    const [timeToNextRequest, setTimeToNextRequest] = useState<number | null>(null); // Time until next request

    useEffect(() => {
        let intervalId: NodeJS.Timeout | null = null;
        let timeoutId: NodeJS.Timeout | null = null;

        const checkBackendHealth = async () => {
            setTimeToNextRequest(null); // Clear countdown when request starts

            try {
                await api.get('/healthz'); // Call the /healthz endpoint
                setLoadingMessage('Backend service is ready!');
                if (intervalId) clearInterval(intervalId); // Clear interval if health check succeeds
                if (timeoutId) clearTimeout(timeoutId);   // Clear timeout if health check succeeds
                setTimeout(onHealthCheckSuccess, 1000); // Delay before proceeding
            } catch (error) {
                console.log('Health check failed, retrying...', error);
                setLoadingMessage(`Waking up the backend service...`);

                let nextDelay: number;
                if (retryDelay === 0) {
                    nextDelay = 5000; // 5 seconds
                } else if (retryDelay < 30000) {
                    nextDelay = retryDelay * 2; // Exponential backoff (doubling delay)
                    if (nextDelay > 30000) nextDelay = 30000; // Cap at 30 seconds
                } else {
                    nextDelay = 30000; // Stay at 30 seconds
                }
                setRetryDelay(nextDelay);

                setTimeToNextRequest(nextDelay / 1000); // Initialize countdown
                timeoutId = setTimeout(checkBackendHealth, nextDelay);
            }
        };

        checkBackendHealth(); // Initial health check immediately

        intervalId = setInterval(() => { // Countdown timer interval
            setTimeToNextRequest(prevTime => {
                if (prevTime === null || prevTime <= 0) {
                    clearInterval(intervalId as NodeJS.Timeout); // Clear interval if time runs out (or request starts)
                    return null;
                }
                return prevTime - 1;
            });
        }, 1000);


        return () => { // Cleanup on unmount
            if (intervalId) clearInterval(intervalId);
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [onHealthCheckSuccess, retryDelay]);

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
            <div className="text-center">
                <div className="flex justify-center mb-4"> {/* Center the spinner horizontally */}
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
                </div>
                <p className="text-lg text-gray-700 mb-2">{loadingMessage}</p>
                {timeToNextRequest !== null && (
                    <p className="text-sm text-gray-600 mb-2">
                        Next request in: {timeToNextRequest} seconds...
                    </p>
                )}
                <p className="text-sm text-gray-500">
                    Using Render Free Tier - service may take a minute to start after inactivity.
                </p>
            </div>
        </div>
    );
};

export default LoadingScreen;