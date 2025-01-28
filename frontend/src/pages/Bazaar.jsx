import React, { useEffect, useState } from 'react';
import axios from 'axios';

const Bazaar = () => {
  const [bazaars, setBazaars] = useState([]);

  useEffect(() => {
    const fetchBazaars = async () => {
      try {
        const response = await axios.get('/api/bazaar');
        setBazaars(response.data);
      } catch (err) {
        console.error('Failed to fetch bazaars', err);
      }
    };
    fetchBazaars();
  }, []);

  return (
    <div>
      <h1>Bazaar</h1>
      {bazaars.map((bazaar) => (
        <div key={bazaar._id}>
          <h2>{bazaar.name}</h2>
          <p>{bazaar.description}</p>
        </div>
      ))}
    </div>
  );
};

export default Bazaar;