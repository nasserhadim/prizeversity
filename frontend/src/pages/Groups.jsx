import React, { useEffect, useState } from 'react';
import axios from 'axios';
import JoinGroup from '../components/JoinGroup';

const Groups = ({ classroomId }) => {
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const response = await axios.get(`/api/group?classroomId=${classroomId}`);
        setGroups(response.data);
      } catch (err) {
        console.error('Failed to fetch groups', err);
      }
    };
    fetchGroups();
  }, [classroomId]);

  return (
    <div>
      <h1>Groups</h1>
      {groups.map((group) => (
        <div key={group._id}>
          <h2>{group.name}</h2>
          <p>Members: {group.members.length}</p>
          <JoinGroup groupId={group._id} />
        </div>
      ))}
    </div>
  );
};

export default Groups;