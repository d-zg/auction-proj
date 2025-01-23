'use client';
import { useEffect, useState } from 'react';
import { useAuthContext } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

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
  const { user } = useAuthContext() as { user: any };
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

   useEffect(() => {
     // Redirect to the home page if the user is not logged in
    if ( user == null ) {
        router.push( "/" );
    }
  }, [ user, router ] );


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


  if (loading) {
    return <div>Loading groups...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
     <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">My Groups</h1>
        <button onClick={handleCreateGroup} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-4">
            Create New Group
        </button>
        {groups.length > 0 ? (
            <ul className="space-y-4">
                {groups.map(group => (
                    <li key={group.group_id} className="bg-white shadow rounded p-4">
                        <h2 className="text-xl font-semibold">{group.name}</h2>
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