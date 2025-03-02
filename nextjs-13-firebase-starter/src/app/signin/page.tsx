'use client'
import signIn from "@/firebase/auth/signIn";
import { useRouter } from 'next/navigation';
import { useState } from "react";
import Link from 'next/link'; // Import Link

function Page(): JSX.Element {
  const [ email, setEmail ] = useState( '' );
  const [ password, setPassword ] = useState( '' );
  const router = useRouter();

  // Handle form submission
  const handleForm = async ( event: { preventDefault: () => void } ) => {
    event.preventDefault();

    // Attempt to sign in with provided email and password
    const { result, error } = await signIn( email, password );

    if ( error ) {
      // Display and log any sign-in errors
      console.log( error );
      return;
    }

    // Sign in successful
    console.log( result );

    // Redirect to the groups page
    router.push( "/groups" ); // Changed redirect to /groups
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100"> {/* Added background for visual appeal */}
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl"> {/* Container for sign-in form with styling */}
        <h1 className="text-3xl font-bold mb-6 text-gray-800 text-center">Sign In</h1> {/* Centered title */}
        <form onSubmit={handleForm} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-gray-700 text-sm font-bold mb-2">
              Email
            </label>
            <input
              onChange={( e ) => setEmail( e.target.value )}
              required
              type="email"
              name="email"
              id="email"
              placeholder="example@mail.com"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">
              Password
            </label>
            <input
              onChange={( e ) => setPassword( e.target.value )}
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
            className="w-full bg-blue-500 hover:bg-blue-700 text-white font-semibold py-2 rounded focus:outline-none focus:shadow-outline" // Added focus styles
          >
            Sign In
          </button>
        </form>
        <div className="mt-4 text-sm text-gray-600 text-center"> {/* Added register link below form */}
          Don't have an account? <Link href="/signup" className="text-blue-500 hover:text-blue-700">Sign Up</Link>
        </div>
      </div>
    </div>
  );
}

export default Page;