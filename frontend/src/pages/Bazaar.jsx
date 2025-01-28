import React, { useEffect, useState } from 'react';
import axios from 'axios';
import CreateBazaar from '../components/CreateBazaar';
import AddItem from '../components/AddItem';

const Bazaar = ({ classroomId }) => {
  const [bazaars, setBazaars] = useState([]);

  useEffect(() => {
    const fetchBazaars = async () => {
      try {
        const response = await axios.get(`/api/bazaar?classroomId=${classroomId}`);
        setBazaars(response.data);
      } catch (err) {
        console.error('Failed to fetch bazaars', err);
      }
    };
    fetchBazaars();
  }, [classroomId]);

  return (
    <div>
      <h1>Bazaar</h1>
      <CreateBazaar classroomId={classroomId} />
      {bazaars.map((bazaar) => (
        <div key={bazaar._id}>
          <h2>{bazaar.name}</h2>
          <p>{bazaar.description}</p>
          <AddItem bazaarId={bazaar._id} />
        </div>
      ))}
    </div>
  );
};

export default Bazaar;