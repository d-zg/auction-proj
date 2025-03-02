'use client';
import { useEffect, useState } from 'react';
import { useAuthContext } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import Link from 'next/link';
import { getAuth, signOut } from 'firebase/auth'; // Import signOut and getAuth
import firebase_app from '@/firebase/config'; // Import firebase app

interface Group {
  group_id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  memberships: string[];
  elections: string[];
}

const GroupsPage: React.FC = () => {
  const { user, setUser } = useAuthContext() as { user: any, setUser: any };
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if(user == null) {
            router.push("/")
        }
    }, [user, router])

  useEffect(() => {
      const fetchGroups = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
          const token = await user.getIdToken();

        const response = await api.get('/groups/my-groups', {
            headers: {
               Authorization: `Bearer ${token}`
           }
        });

        if (response.status === 200) {
          setGroups(response.data);
          setError(null);
        } else {
          setError(`Failed to fetch groups: ${response.status}`);
        }
      } catch (err: any) {
        console.error("Error fetching groups:", err);
        setError(`Failed to fetch groups: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchGroups();
  }, [user]);

  const handleCreateGroup = async () => {
        if (!user) {
            return;
        }
      const groupName = prompt('Enter the name of the new group:')
      if(!groupName) {
          alert("No group name was given.")
          return
      }
      const groupDescription = prompt('Enter an optional description for the group:') || "";

      try{
           const token = await user.getIdToken();

          const response = await api.post('/groups',{
               name: groupName,
               description: groupDescription
            }, {
              headers: {
                Authorization: `Bearer ${token}`
              }
            })

        if(response.status === 201) {
           alert(`Successfully created group: ${response.data.name}`)

            // Refetch the groups to show the newly created group
            const fetchGroups = async () => {
            if (!user) {
                setLoading(false);
                return;
                }

            try {
                setLoading(true);
                const token = await user.getIdToken();

                const response = await api.get('/groups/my-groups', {
                    headers: {
                    Authorization: `Bearer ${token}`
                    }
                });

                if (response.status === 200) {
                setGroups(response.data);
                setError(null);
                } else {
                setError(`Failed to fetch groups: ${response.status}`);
                }
            } catch (err: any) {
                console.error("Error fetching groups:", err);
                setError(`Failed to fetch groups: ${err.message}`);
            } finally {
                setLoading(false);
            }
            };

            fetchGroups();
         }
        else {
            alert(`Failed to create group with status ${response.status}`)
        }
      }
      catch(err:any) {
            alert(`Failed to create group: ${err.message}`)
      }
  }

  const handleLogout = async () => {
    const auth = getAuth(firebase_app); // Get auth instance
    try {
      await signOut(auth); // Sign out the user
      setUser(null); // Explicitly set user state to null in AuthContext
      router.push('/'); // Redirect to home page after logout
    } catch (error) {
      console.error('Logout failed:', error);
      setError('Logout failed.'); // Set error state to display message
    }
  };


  if (loading) {
    return <div>Loading groups...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
     <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">My Groups</h1>
            <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
            >
                Logout
            </button>
        </div>

        <button onClick={handleCreateGroup} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-4">
            Create New Group
        </button>
        {groups.length > 0 ? (
            <ul className="space-y-4">
                {groups.map(group => (
                    <li key={group.group_id} className="bg-white shadow rounded p-4">
                         <Link href={`/groups/${group.group_id}`} >
                             <h2 className="text-xl font-semibold hover:underline cursor-pointer">{group.name}</h2>
                          </Link>
                        <p className="text-gray-700">{group.description}</p>
                        <p className="text-gray-500">
                             Created At: {new Date(group.created_at).toLocaleString()}
                        </p>
                    </li>
                ))}
            </ul>
        ) : (
           <p>You are not a member of any groups yet.</p>
        )}
    </div>
  );
};

export default GroupsPage;