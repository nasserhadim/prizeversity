// src/pages/BazaarPage.jsx

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
// import axios from 'axios'
import apiBazaar from '../API/apiBazaar.js'
import CreateBazaar from '../components/CreateBazaar';
import CreateItem from '../components/CreateItem';
import ItemCard from '../components/ItemCard';

const Bazaar = () => {
  const { classroomId } = useParams();
  const { user } = useAuth();
  const [bazaar, setBazaar] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchBazaar = async () => {
    try {
      const res = await apiBazaar.get(`classroom/${classroomId}/bazaar`);
      setBazaar(res.data.bazaar);
    } catch {
      setBazaar(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBazaar();
  }, [classroomId]);

  if (loading) return <p className="text-center py-8">Loading...</p>;

  // Case: Bazaar not yet created
  if (!bazaar) {
    return user.role === 'teacher' ? (
      <div className="p-6">
        <CreateBazaar classroomId={classroomId} onCreate={setBazaar} />
      </div>
    ) : (
      <div className="p-6 text-center text-lg font-semibold text-gray-700">
        The marketplace is not open yet.
      </div>
    );
  }

  // Case: Bazaar exists
  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold">{bazaar.name}</h2>
      <p className="text-gray-600 mb-4">{bazaar.description}</p>

      {user.role === 'teacher' && (
        <CreateItem
          bazaarId={bazaar._id}
          classroomId={classroomId}
          onAdd={(newItem) =>
            setBazaar(prev => ({
              ...prev,
              items: [...(prev.items || []), newItem]
            }))
          }
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        {bazaar.items?.length > 0 ? (
          bazaar.items.map((item) => (
            <ItemCard
              key={item._id}
              item={item}
              role={user.role}
              classroomId={classroomId} 
            />
          ))
        ) : (
          <p className="text-gray-500 italic">Nothing is yet for sale.</p>
        )}
      </div>
    </div>
  );
};

export default Bazaar;
