'use client';
import { useEffect, useState } from 'react';
import { useAuthContext } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useParams } from 'next/navigation';

interface Member {
    user: {
        uid: string,
        email: string
    },
    membership: {
        membership_id: string,
        user_id: string,
        group_id: string,
        token_balance: number,
        role: string,
        created_at: string,
        updated_at: string
    }
}

interface Election {
    election_id: string,
    group_id: string,
    start_date: string,
    end_date: string,
    status: string,
    payment_options: string,
    price_options: string,
    winning_proposal_id: string | null,
    proposals: string[]
}

interface Group {
  group_id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  memberships: string[];
  elections: string[];
}


const GroupDetailsPage: React.FC = () => {
  const { user } = useAuthContext() as { user: any };
  const router = useRouter();
  const { group_id } = useParams();
    const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
     // Redirect to the home page if the user is not logged in
    if ( user == null ) {
        router.push( "/" );
    }
  }, [ user, router ] );


  useEffect(() => {
    const fetchGroupDetails = async () => {
        if(!user) {
            setLoading(false)
             return
        }

      try {
          setLoading(true)
        const token = await user.getIdToken();


        const [groupResponse, membersResponse, electionsResponse] = await Promise.all([
            api.get(`/groups/${group_id}`, {
              headers: {
                Authorization: `Bearer ${token}`
              }
            }),
            api.get(`/groups/${group_id}/members`, {
              headers: {
                Authorization: `Bearer ${token}`
                }
            }),
            api.get(`/groups/${group_id}/elections`,{
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })
        ]);


        if (groupResponse.status === 200) {
             setGroup(groupResponse.data);
        } else {
              setError(`Failed to fetch group details: ${groupResponse.status}`);
        }

        if(membersResponse.status === 200) {
           setMembers(membersResponse.data)
            //find if the current user is an admin
            const current_user_member = membersResponse.data.find((member : Member) => member.user.uid == user.uid)
            if(current_user_member && current_user_member.membership.role == 'admin') {
                setIsAdmin(true)
            }
            else {
                 setIsAdmin(false)
            }
        } else {
          setError(`Failed to fetch group members: ${membersResponse.status}`);
         }

          if(electionsResponse.status === 200) {
            setElections(electionsResponse.data)
        } else {
          setError(`Failed to fetch elections: ${electionsResponse.status}`);
         }
      } catch (err: any) {
        console.error("Error fetching group details:", err);
        setError(`Failed to fetch group details: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchGroupDetails();
  }, [user, group_id]);


  if (loading) {
    return <div>Loading group details...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

    if (!group) {
        return <div>Group not found</div>
    }


  return (
     <div className="container mx-auto p-4">
       <h1 className="text-2xl font-bold mb-4">{group.name}</h1>
        <p className="mb-4">{group.description}</p>

        <h2 className="text-xl font-semibold mb-2">Members</h2>
        {members.length > 0 ? (
            <ul className="space-y-2">
                {members.map(member => (
                    <li key={member.membership.membership_id} className="bg-white shadow rounded p-2">
                        {member.user.email} (Role: {member.membership.role})
                    </li>
                ))}
            </ul>
        ) : (
            <p>No members in this group.</p>
        )}

         <h2 className="text-xl font-semibold mb-2 mt-4">Elections</h2>
        {elections.length > 0 ? (
            <ul className="space-y-2">
                {elections.map(election => (
                    <li key={election.election_id} className="bg-white shadow rounded p-2">
                        {new Date(election.start_date).toLocaleString()} - {new Date(election.end_date).toLocaleString()} - {election.status}
                    </li>
                ))}
            </ul>
        ) : (
            <p>No elections in this group.</p>
        )}
        {isAdmin && (
             <div>
                <button className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mr-2">Invite User</button>
                 <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Start Election</button>
             </div>
        )}
    </div>
  );
};

export default GroupDetailsPage;