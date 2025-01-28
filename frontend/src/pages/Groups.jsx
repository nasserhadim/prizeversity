import React, { useEffect, useState } from 'react';
import axios from 'axios';

const Groups = () => {
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const response = await axios.get('/api/group');
        setGroups(response.data);
      } catch (err) {
        console.error('Failed to fetch groups', err);
      }
    };
    fetchGroups();
  }, []);

  return (
    <div>
      <h1>Groups</h1>
      {groups.map((group) => (
        <div key={group._id}>
          <h2>{group.name}</h2>
          <p>Members: {group.members.length}</p>
        </div>
      ))}
    </div>
  );
};

export default Groups;