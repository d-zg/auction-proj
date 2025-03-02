'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import firebase_app from '@/firebase/config';

// Initialize Firebase auth instance
const auth = getAuth(firebase_app);

// Create the authentication context
export const AuthContext = createContext({});

// Custom hook to access the authentication context
export const useAuthContext = () => useContext(AuthContext);

interface AuthContextProviderProps {
  children: ReactNode;
}

const AuthContextProvider: React.FC<AuthContextProviderProps> = ({ children }) => {
  // Set up state to track the authenticated user and loading status
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to the authentication state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in
        setUser(user);
      } else {
        // User is signed out
        setUser(null);
      }
      // Set loading to false once authentication state is determined
      setLoading(false);
    });

    // Unsubscribe when the component unmounts
    return () => unsubscribe();
  }, []);

  // A helper to get the current ID token (not used in the returned value)
  const getIdToken = async () => {
    if (!user) return null;
    return user.getIdToken(false);
  };

  // Provide the authentication context to child components
  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {loading ? <div>Loading...</div> : children}
    </AuthContext.Provider>
  );
};

export { AuthContextProvider };
