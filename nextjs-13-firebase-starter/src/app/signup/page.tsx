'use client'
import signUp from "@/firebase/auth/signup";
import { useRouter } from 'next/navigation';
import { useState } from "react";
import { api } from '@/lib/api';
import Link from 'next/link';

const Page: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  // Handle form submission
  const handleForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Attempt to sign up with provided email and password
    const { result, error } = await signUp(email, password);

    if (error) {
      // Display and log any sign-up errors
      console.log(error);
      return;
    }

    // Ensure result and result.user exist before getting the ID token
    if (!result || !result.user) {
      console.error("Sign up did not return a valid user result.");
      return;
    }

    // Sign up successful
    console.log(result);

    // --- Call backend endpoint to create user if new ---
    try {
      const idToken = await result.user.getIdToken();

      const response = await api.post(
        '/users/create_if_new',
        {},
        {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      );

      if (response.status === 201) {
        console.log("User created in Firestore (if new)");
      } else {
        console.error("Error creating user in Firestore:", response);
      }
    } catch (err: any) {
      console.error("Error creating user in Firestore:", err);
    }
    // ----------------------------------------------------

    // Redirect to the groups page
    router.push("/groups");
  };

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <div className="w-96 bg-white rounded shadow p-6">
        <h1 className="text-3xl font-bold mb-6 text-gray-800 text-center">Registration</h1>
        <form onSubmit={handleForm} className="space-y-4">
          <div>
            <label htmlFor="email" className="block mb-1 font-medium text-gray-700">
              Email
            </label>
            <input
              onChange={(e) => setEmail(e.target.value)}
              required
              type="email"
              name="email"
              id="email"
              placeholder="example@mail.com"
              className="w-full border border-gray-300 rounded px-3 py-2 shadow-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="password" className="block mb-1 font-medium text-gray-700">
              Password
            </label>
            <input
              onChange={(e) => setPassword(e.target.value)}
              required
              type="password"
              name="password"
              id="password"
              placeholder="password"
              className="w-full border border-gray-300 rounded px-3 py-2 shadow-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-500 hover:bg-blue-700 text-white font-semibold py-2 rounded focus:outline-none focus:shadow-outline"
          >
            Sign up
          </button>
        </form>
        <div className="mt-4 text-sm text-gray-600 text-center">
          Already have an account?{" "}
          <Link href="/signin" className="text-blue-500 hover:text-blue-700">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Page;
