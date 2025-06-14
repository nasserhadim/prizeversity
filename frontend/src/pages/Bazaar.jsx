import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import CreateBazaar from '../components/CreateBazaar';
import AddItem from '../components/AddItem';
import { Store } from 'lucide-react';

const Bazaar = () => {
  const { id: classroomId } = useParams();
  const [bazaars, setBazaars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);

  // Fetch user info to get role
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const res = await axios.get('/api/users/profile');
        setUserRole(res.data.role);
      } catch (err) {
        console.error('Failed to fetch user role', err);
      }
    };
    fetchUserRole();
  }, []);

  // Fetch bazaars for classroom
  useEffect(() => {
    const fetchBazaars = async () => {
      try {
        const response = await axios.get(`/api/bazaar/classroom/${classroomId}`);
        setBazaars(response.data);
      } catch (err) {
        console.error('Failed to fetch bazaars', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBazaars();
  }, [classroomId]);

  // Reload Bazaar after successful creation.
  const onBazaarCreated = (newBazaar) => {
    setBazaars([newBazaar]);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-4xl font-bold text-primary mb-4 flex items-center gap-2">
        <Store className="w-8 h-8" />
        Bazaar Marketplace
      </h1>

      {loading ? (
        <>
          <div className="bg-base-100 shadow-xl rounded-box p-8">
            <div className="flex flex-col gap-4">
              <div className="skeleton h-6 w-32"></div>
              <div className="skeleton h-10 w-full"></div>
            </div>
          </div>
        </>
      ) : (
        <>
          {bazaars.length === 0 ? (
            userRole === 'teacher' ? (
              <div className="bg-base-100 shadow-xl rounded-box p-4">
                <CreateBazaar classroomId={classroomId} onBazaarCreated={onBazaarCreated} />
              </div>
            ) : (
              <p className="text-center text-gray-500 mt-10">No bazaar has been set up yet.</p>
            )
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {bazaars.map((bazaar) => (
                <div key={bazaar._id} className="card bg-base-200 shadow-lg">
                  <div className="card-body">
                    <h2 className="card-title text-secondary">{bazaar.name}</h2>
                    <p className="text-sm text-gray-500">{bazaar.description}</p>
                    <div className="mt-4">
                      <AddItem bazaarId={bazaar._id} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Bazaar;
