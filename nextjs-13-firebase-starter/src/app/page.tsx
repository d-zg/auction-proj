import Link from "next/link"

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-8">
      <div className="max-w-3xl w-full bg-white rounded-2xl shadow-xl p-6 sm:p-10 text-center transform transition-all duration-500 hover:shadow-2xl">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-black mb-4">Decentralized Decisions</h1>

        <div className="w-24 h-1 bg-gradient-to-r from-blue-400 to-indigo-500 mx-auto mb-6 rounded-full"></div>

        <p className="text-lg text-gray-700 mb-10 leading-relaxed max-w-2xl mx-auto">
          A voting system that ensures fair, balanced, and engaging group decision-making by allowing participants to
          express preferences with regenerating tokens.
        </p>

        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6 justify-center mb-8">
          <Link
            href="/signin"
            className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-8 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-300 transform hover:-translate-y-1 shadow-md hover:shadow-lg"
            aria-label="Sign in to Decentralized Decisions"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50 font-medium py-3 px-8 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-300 transform hover:-translate-y-1 shadow-md hover:shadow-lg"
            aria-label="Register for Decentralized Decisions"
          >
            Register
          </Link>
        </div>

        <div className="pt-6 border-t border-gray-100">
          <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
            Powered by
            <span className="font-medium text-gray-700">Next.js</span> •
            <span className="font-medium text-gray-700">FastAPI</span> •
            <span className="font-medium text-gray-700">Firebase</span>
          </p>
        </div>
      </div>

    </main>
  )
}

