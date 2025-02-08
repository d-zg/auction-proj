import React from 'react';
import Link from 'next/link'; // Assuming you are using Next.js for Link, adjust if needed
import { Election } from '@/models/models';


// Define TypeScript interface for ElectionListItem props
interface ElectionListItemProps {
  groupId: string;
  election: Election;
}

const ElectionListItem: React.FC<ElectionListItemProps> = ({ groupId, election }) => {
    // Function to format the date string
    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, { // undefined locale uses browser's default
        year: 'numeric',
        month: 'long', // 'long' for full month name (e.g., February), 'short' for abbreviated (e.g., Feb)
        day: 'numeric',
        hour: 'numeric',     // Include hour
        minute: 'numeric',  // Include minute
        hour12: true,       // Use 12-hour format (AM/PM) - optional, remove if you want 24-hour format
      });
    };
  
    const formattedStartDate = formatDate(election.start_date);
    const formattedEndDate = formatDate(election.end_date);
  
    return (
      <li key={election.election_id} className="mb-4">
        <Link href={`/groups/${groupId}/elections/${election.election_id}`}>
          <div className="group bg-white rounded-md shadow-md hover:shadow-lg transition-shadow duration-200 cursor-pointer p-4">
            <h3 className="text-lg font-semibold text-gray-800 group-hover:text-indigo-600 transition-colors duration-200">
              {election.election_name || `Election ${election.election_id}`}
            </h3>
            <div className="mt-1 flex items-center text-sm text-gray-600">
              <span className="mr-2">
                <i className="fa fa-calendar-alt mr-1"></i>
                {formattedStartDate} to {formattedEndDate}
              </span>
              <span className="ml-auto font-medium px-2 py-1 rounded-full text-xs"
                    style={{
                      backgroundColor:
                        election.status === 'active' ? '#dcfce7' :
                        election.status === 'pending' ? '#fef08a' :
                        election.status === 'closed' ? '#fee2e2' :
                        '#e5e7eb',
                      color:
                        election.status === 'active' ? '#166534' :
                        election.status === 'pending' ? '#713f12' :
                        election.status === 'closed' ? '#991b1b' :
                        '#4b5563',
                    }}>
                {election.status.toUpperCase()}
              </span>
            </div>
          </div>
        </Link>
      </li>
    );
  };

// Define TypeScript interface for ElectionList props
interface ElectionListProps {
  groupId: string;
  elections: Election[];
}

const ElectionList: React.FC<ElectionListProps> = ({ groupId, elections }) => {
  return (
    <ul className="space-y-2"> {/* Use space-y-2 for vertical spacing between list items */}
      {elections.map((election) => (
        <ElectionListItem key={election.election_id} groupId={groupId} election={election} />
      ))}
    </ul>
  );
};

export default ElectionList;