import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import CreateBazaar from '../components/CreateBazaar';
import AddItem from '../components/AddItem';
import { Store } from 'lucide-react';

// The bazzar will show in the bazaar link layer
const Bazaar = () => {
  const { id: classroomId } = useParams();
  const [bazaars, setBazaars] = useState([]);
  const [loading, setLoading] = useState(true);
  // fetching the bazaars based on the classrom the user is joined
  useEffect(() => {
    const fetchBazaars = async () => {
      try {
        const response = await axios.get(`/api/bazaar?classroomId=${classroomId}`);
        setBazaars(response.data);
      } catch (err) {
        console.error('Failed to fetch bazaars', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBazaars();
  }, [classroomId]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-4xl font-bold text-primary mb-4 flex items-center gap-2">
        <Store className='w-8 h-8' />
        Bazaar Marketplace
      </h1>

      {loading ? (
        <>
          {/* Skeleton for CreateBazaar card */}
          <div className="bg-base-100 shadow-xl rounded-box p-8">
            <div className="flex flex-col gap-4">
              <div className="skeleton h-6 w-32"></div>
              <div className="skeleton h-10 w-full"></div>
              <div className='skeleton h-6 w-32'></div>
              <div className="skeleton h-10 w-full"></div>
              <div className='skeleton h-6 w-32'></div>
              <div className="skeleton h-10 w-full"></div>
              <div className="skeleton h-10 w-full"></div>
            </div>
          </div>

          {/* Skeleton for the grid of bazaars */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(4)].map((_, idx) => (
              <div key={idx} className="card bg-base-200 shadow-lg">
                <div className="card-body space-y-3">
                  <div className="skeleton h-6 w-40"></div>
                  <div className="skeleton h-4 w-3/4"></div>
                  <div className="skeleton h-4 w-full"></div>
                  <div className="skeleton h-10 w-24 mt-4"></div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Actual UI when not loading */}
          <div className="bg-base-100 shadow-xl rounded-box p-4">
            <CreateBazaar classroomId={classroomId} />
          </div>

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
        </>
      )}
    </div>
  );
};

export default Bazaar;