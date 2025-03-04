import Image from 'next/image';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex flex-col items-center min-h-screen bg-gray-100 p-8"> {/* Removed justify-between, added padding to main container */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4"> {/* More prominent title */}
          Decentralized Decisions
        </h1>
        <p className="text-lg text-gray-700 mb-8"> {/* More descriptive tagline */}
          transparent and token-based voting.
        </p>
        {/* Interactive Image/Animation Placeholder - Replace with your actual image/animation */}
        <div className="flex space-x-4 justify-center mb-8"> {/* Centered buttons container */}
          <Link href="/signin" className="inline-block bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-full focus:outline-none focus:shadow-outline" aria-label="Sign in to Decentralized Decisions"> {/* Styled sign-in button */}
            Sign In
          </Link>
          <Link href="/signup" className="inline-block bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-full focus:outline-none focus:shadow-outline" aria-label="Register for Decentralized Decisions"> {/* Styled sign-up button */}
            Register
          </Link>
        </div>
         <p className="text-sm text-gray-500"> {/* Optional footer text, now below buttons */}
          Powered by Next.js and Firebase
        </p>
      </div>
    </main>
  );
}