'use client'
import signUp from "@/firebase/auth/signup";
import { useRouter } from 'next/navigation';
import { useState } from "react";
import { api } from '@/lib/api';
import Link from 'next/link'; // Import Link


function Page(): JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  // Handle form submission
  const handleForm = async (event: { preventDefault: () => void }) => {
    event.preventDefault();

    // Attempt to sign up with provided email and password
    const { result, error } = await signUp(email, password);

    if (error) {
      // Display and log any sign-up errors
      console.log(error);
      return;
    }

    // Sign up successful
    console.log(result);

    // --- Call backend endpoint to create user if new ---
    try {
      const idToken = await result.user.getIdToken();

      const response = await api.post('/users/create_if_new', {}, {
        headers: {
          Authorization: `Bearer ${idToken}`
        }
      });

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
    router.push("/groups"); // Changed redirect to /groups
  };

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100"> {/* Added background for visual appeal */}
      <div className="w-96 bg-white rounded shadow p-6"> {/* Container for signup form with styling */}
        <h1 className="text-3xl font-bold mb-6 text-gray-800 text-center">Registration</h1> {/* Centered title */}
        <form onSubmit={handleForm} className="space-y-4">
          <div>
            <label htmlFor="email" className="block mb-1 font-medium text-gray-700"> {/* Text color for labels */}
              Email
            </label>
            <input
              onChange={(e) => setEmail(e.target.value)}
              required
              type="email"
              name="email"
              id="email"
              placeholder="example@mail.com"
              className="w-full border border-gray-300 rounded px-3 py-2 shadow-sm focus:outline-none focus:border-blue-500" // Added shadow and focus styles
            />
          </div>
          <div>
            <label htmlFor="password" className="block mb-1 font-medium text-gray-700"> {/* Text color for labels */}
              Password
            </label>
            <input
              onChange={(e) => setPassword(e.target.value)}
              required
              type="password"
              name="password"
              id="password"
              placeholder="password"
              className="w-full border border-gray-300 rounded px-3 py-2 shadow-sm focus:outline-none focus:border-blue-500" // Added shadow and focus styles
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-500 hover:bg-blue-700 text-white font-semibold py-2 rounded focus:outline-none focus:shadow-outline" // Added focus styles
          >
            Sign up
          </button>
        </form>
        <div className="mt-4 text-sm text-gray-600 text-center"> {/* Added signin link below form */}
          Already have an account? <Link href="/signin" className="text-blue-500 hover:text-blue-700">Sign In</Link>
        </div>
      </div>
    </div>
  );
}

export default Page;