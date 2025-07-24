import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const JoinGroup = ({ groupId }) => {
  const handleJoin = async () => {
    try {
      const response = await axios.post(`/api/group/${groupId}/join`);
      toast.success('Joined group successfully!');
    } catch (err) {
      toast.error('Failed to join group');
    }
  };

  return (
    <div>
      <button onClick={handleJoin}>Join Group</button>
    </div>
  );
};

export default JoinGroup;