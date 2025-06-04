import React, { useState } from 'react';
import axios from 'axios';

const JoinGroup = ({ groupId }) => {
  const handleJoin = async () => {
    try {
      const response = await axios.post(`/api/group/${groupId}/join`);
      alert('Joined group successfully!');
    } catch (err) {
      alert('Failed to join group');
    }
  };

  return (
    <div>
      <button onClick={handleJoin}>Join Group</button>
    </div>
  );
};

export default JoinGroup;