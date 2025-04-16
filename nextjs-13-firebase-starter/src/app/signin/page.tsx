'use client'
import signIn from "@/firebase/auth/signIn";
import { useRouter } from 'next/navigation';
import { useState } from "react";
import Link from 'next/link';
import LoadingScreen from '@/app/signin/components/LoadingScreen'; // Import LoadingScreen

const Page: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(''); // Add error state
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true); // State to control loading screen visibility

  // Handle form submission
  const handleForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(''); // Clear any existing errors

    // Attempt to sign in with provided email and password
    const { result, error } = await signIn(email, password);

    if (error) {
      // Handle Firebase error object properly
      const errorMessage = typeof error === 'object' && error !== null && 'message' in error
        ? error.message as string
        : 'Failed to sign in. Please check your credentials.';
      setError(errorMessage);
      return;
    }

    // Sign in successful
    console.log(result);

    // Redirect to the groups page
    router.push("/groups");
  };

  const handleHealthCheckSuccess = () => {
    setIsLoading(false); // Hide loading screen when health check is successful
  };

  return (
    <>
      {isLoading ? (
        <LoadingScreen onHealthCheckSuccess={handleHealthCheckSuccess} />
      ) : (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
          <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl">
            <h1 className="text-3xl font-bold mb-6 text-gray-800 text-center">Sign In</h1>
            {error && ( // Add error message display
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                <span className="block sm:inline">{error}</span>
              </div>
            )}
            <form onSubmit={handleForm} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-gray-700 text-sm font-bold mb-2">
                  Email
                </label>
                <input
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  type="email"
                  name="email"
                  id="email"
                  placeholder="example@mail.com"
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">
                  Password
                </label>
                <input
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  type="password"
                  name="password"
                  id="password"
                  placeholder="password"
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-500 hover:bg-blue-700 text-white font-semibold py-2 rounded focus:outline-none focus:shadow-outline"
              >
                Sign In
              </button>
            </form>
            <div className="mt-4 text-sm text-gray-600 text-center">
              Do you have an account? Sign up here. <Link href="/signup" className="text-blue-500 hover:text-blue-700">Sign Up</Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Page;