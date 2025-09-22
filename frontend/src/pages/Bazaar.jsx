import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Store, HandCoins  } from 'lucide-react';
import { Image as ImageIcon } from 'lucide-react';
//import axios from 'axios'
//import apiBazaar from '../API/apiBazaar.js'
import CreateBazaar from '../components/CreateBazaar';
import CreateItem from '../components/CreateItem';
import ItemCard from '../components/ItemCard';
import apiBazaar from '../API/apiBazaar';
import apiClassroom from '../API/apiClassroom';
import InventorySection from '../components/InventorySection';
import toast from 'react-hot-toast';
import Footer from '../components/Footer';
import { resolveBannerSrc } from '../utils/image';

const Bazaar = () => {
  const { classroomId } = useParams();
  const { user } = useAuth();
  const [bazaar, setBazaar] = useState(null);
  const [classroom, setClassroom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInventory, setShowInventory] = useState(false);

  const [confirmDeleteBazaar, setConfirmDeleteBazaar] = useState(null);
  const [EditBazaar, setEditBazaar] = useState(false);
  const [StartEdit, setStartEdit] = useState(null);
  const [BazaarImageSource, setBazaarImageSource] = useState('url');
  const [BazaarImageFile, setBazaarImageFile] = useState('placeholder.jpg');
  const [BazaarImageUrl, setBazaarImageUrl] = useState('');
  const [BazaarName, setBazaarName] = useState('');
  const [BazaarDesc, setBazaarDesc] = useState('');
    // delete bazaar
    const handleDeleteBazaar = async () => {
        if (!confirmDeleteBazaar) return;
        try {
            await apiBazaar.delete(`classroom/${classroomId}/bazaar/delete`);
            toast.success('Bazaar deleted');
            setConfirmDeleteBazaar(null);
            setBazaar(null);
        } catch(error) {
            console.error(error);
            toast.error(`Failed to delete bazaar: ${error.response?.data?.error || error.message}`);
            setConfirmDeleteBazaar(null);
        }
    };
    const startEditBazaar = async () => {
        setBazaarName(bazaar.name);
        setBazaarDesc(bazaar.description);
        setBazaarImageSource(bazaar.image);

        setEditBazaar(bazaar);
    }

    const handleEditBazaar = async () => {
        if (!EditBazaar) return;
        try {


            if (BazaarImageSource === 'file' && BazaarImageFile) {
                const fd = new FormData();
                fd.append('name', BazaarName);
                fd.append('description', BazaarDesc);
                fd.append('image', BazaarImageFile);
                await apiBazaar.put(`classroom/${bazaar._id}/bazaar/edit`, fd, { headers: { 'Content-Type': 'multipart/form-data' }});
            } else {
                await apiBazaar.put(`classroom/${bazaar._id}/bazaar/edit`, {
                    name: BazaarName,
                    description: BazaarDesc,
                    image: BazaarImageFile
                });
            }
            toast.success('Bazaar edited');
            setEditBazaar(null);
        }  catch(error) {
            console.error(error);
            toast.error(`Failed to edit bazaar: ${error.response?.data?.error || error.message}`);
            setEditBazaar(null);
        }
        
    };

  // Fetch classroom details
  const fetchClassroom = async () => {
    try {
      const response = await apiClassroom.get(`/${classroomId}`);
      setClassroom(response.data);
    } catch (err) {
      console.error('Failed to fetch classroom:', err);
    }
  };

  // Will fetch the bazaar from the classroom
  const fetchBazaar = async () => {
    try {
      const res = await apiBazaar.get(`classroom/${classroomId}/bazaar`);
      setBazaar(res.data.bazaar);
    } catch (error){
        console.error(error);
        //toast.error(`Failed to fetch bazaar: ${error.response?.data?.error || error.message}`);
      setBazaar(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassroom();
    fetchBazaar();
  }, [classroomId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-base-200">
                        <span className="loading loading-ring loading-lg"></span>
                      </div>

  // Case: Bazaar not yet created
  if (!bazaar) {
    return user.role === 'teacher' ? (
      <div className="flex flex-col min-h-screen bg-base-200">
        <div className="flex-grow p-6">
          <CreateBazaar classroomId={classroomId} onCreate={setBazaar} />
        </div>
        <Footer />
      </div>
    ) : (
      <div className="flex flex-col min-h-screen bg-base-200">
        <div className="flex-grow p-6 text-center text-lg font-semibold text-base-content/70">
          The marketplace is not open yet.
        </div>
        <Footer />
      </div>
    );
  }

  // Case: Bazaar exists
  return (
    <div className="p-6 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold text-success flex items-center justify-center gap-3">
          {/* <Store /> */}
          {classroom
            ? `${classroom.name}${classroom.code ? ` (${classroom.code})` : ''} Bazaar`
            : 'Classroom Bazaar'}
        </h1>
      </div>

      <div className="card bg-base-100 border border-base-200 shadow-md rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center gap-6">
        {/* Image Section */}
        <div className="w-full md:w-1/3">
          {(() => {
            const imgSrc = resolveBannerSrc(bazaar?.image);
            return (
              <img
                src={resolveBannerSrc(bazaar?.image)}
                alt="Bazaar Banner"
                className="w-full h-48 object-cover rounded-xl shadow-sm"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/images/bazaar-placeholder.svg';
                }}
              />
            );
          })()}
        </div>

        {/* Text Section */}
        <div className="flex-1 space-y-2 text-center md:text-left">
          <h2 className="text-3xl sm:text-4xl font-bold text-success leading-tight break-words flex items-center gap-2">
            <Store />
            {bazaar.name}
          </h2>

          <p className="text-base-content opacity-70 text-base sm:text-lg whitespace-pre-wrap">
            {bazaar.description}
          </p>
        </div>
        {/* Modification Section */}
        {(user.role === 'teacher' || user.role === 'admin') && (
            <div className="flex gap-2">
                <button className="btn btn-sm btn-info" onClick={startEditBazaar}>Edit</button>
                <button className="btn btn-sm btn-error" onClick={() => setConfirmDeleteBazaar(bazaar)}>Delete</button>
            </div>
        )}

      </div>

      {/* Teacher Create Item */}
      {user.role === 'teacher' && (
        <div className="card card-compact bg-base-100 shadow p-4 border border-base-200">
          <CreateItem
            bazaarId={bazaar._id}
            classroomId={classroomId}
            onAdd={(newItem) =>
              setBazaar((prev) => ({
                ...prev,
                items: [...(prev.items || []), newItem],
              }))
            }
          />
        </div>
      )}

      {/* Items for Sale Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold text-success flex items-center gap-2">
            <HandCoins />
            Items for Sale
          </h3>
          <span className="badge badge-outline text-sm hidden md:inline">
            {bazaar.items?.length || 0} item{bazaar.items?.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="divider my-0"></div>

        {bazaar.items?.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {bazaar.items.map((item) => (
              <ItemCard
                key={item._id}
                item={item}
                role={user.role}
                classroomId={classroomId}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center text-gray-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-12 h-12 mb-2 opacity-40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 13V9a2 2 0 00-2-2h-1V5a2 2 0 00-2-2H9a2 2 0 00-2 2v2H6a2 2 0 00-2 2v4M3 17h18M9 21h6"
              />
            </svg>
            <p className="italic">Nothing is for sale yet. Please check back later!</p>
          </div>
        )}
      </div>


      {/* Inventory Section with Button in Header */}
      <div className="card bg-base-200 shadow-inner border border-base-300">
        <div className="card-body p-4">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setShowInventory(!showInventory)}
              className={`btn btn-sm transition-all duration-200 ${
                showInventory ? 'btn-outline btn-error' : 'btn-success'
              }`}
            >
              {showInventory ? 'Hide' : 'Show'} Inventory
            </button>
          </div>
          
          {/* Inventory Section */}
          {showInventory && (
            <div className="mt-4">
              <InventorySection userId={user._id} classroomId={classroomId} />
            </div>
          )}
        </div>
      </div>
        {/* Edit Bazaar */}
          {EditBazaar && (
            <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-base-100 p-6 rounded-xl shadow-lg w-[90%] max-w-lg">
                <h2 className="text-lg font-semibold mb-4 text-center">Edit Bazaar</h2>
                
                {/* Modify bazaar name & description */}
                <div className="mb-4">
                  <label className="label">
                    <span className="label-text">Bazaar Name</span>
                  </label>
                <input
                  type="text"
                  placeholder= {bazaar.name}
                  className="input input-bordered w-full mb-3"
                  value={BazaarName}
                  onCreate ={() => setBazaarName(bazaar.name)}
                  onChange={(e) => setBazaarName(e.target.value)}
                />
                </div>
                <div className="mb-4">
                  <label className="label">
                    <span className="label-text">Bazaar Description</span>
                  </label>
                <input
                  type="text"
                  placeholder= {bazaar.description}
                  className="input input-bordered w-full mb-3"
                  value={BazaarDesc}
                  onCreate = {() => setBazaarDesc(bazaar.description)}
                  onChange={(e) => setBazaarDesc(e.target.value)}
                />
                </div>
    
                
    
                {/* Image controls moved into modal so edit UI mirrors create form */}
                <div className="mb-4">
                  <label className="label">
                    <span className="label-text">Image</span>
                    <span className="label-text-alt">Optional</span>
                  </label>
    
                  <div className="inline-flex rounded-full bg-gray-200 p-1">
                    <button
                      type="button"
                      onClick={() => setBazaarImageSource('file')}
                      className={`px-3 py-1 rounded-full text-sm transition ${BazaarImageSource === 'file' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                      Upload
                    </button>
                    <button
                      type="button"
                      onClick={() => setBazaarImageSource('url')}
                      className={`ml-1 px-3 py-1 rounded-full text-sm transition ${BazaarImageSource === 'url' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                      Use image URL
                    </button>
                  </div>
    
                  {BazaarImageSource === 'file' ? (
                    <>
                      <input
                        //ref={BazaarFileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={e => setBazaarImageFile(e.target.files[0])}
                        className="file-input file-input-bordered w-full max-w-xs mt-3"
                      />
                      <p className="text-xs text-gray-500">Allowed: jpg, png, webp, gif. Max: 5 MB.</p>
                    </>
                  ) : (
                    <input
                      type="url"
                      placeholder="https://..."
                      className="input input-bordered w-full mt-3 max-w-xs"
                      value={BazaarImageUrl}
                      onChange={(e) => setBazaarImageUrl(e.target.value)}
                    />
                  )}
                </div>
    
                <div className="flex justify-center gap-4 mt-4">
                  <button
                    className="btn btn-success"
                    onClick={handleEditBazaar}
                  >
                    Update Group Set
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setEditBazaar(false);
                      // reset editing state like the existing reset logic
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
          
    {confirmDeleteBazaar && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-base-100 p-6 rounded-xl shadow-lg w-[90%] max-w-sm">
            <h2 className="text-lg font-semibold mb-4 text-center">Delete Bazaar</h2>
            <p className="text-sm text-center">
              Are you sure you want to delete the Bazaar <strong>{confirmDeleteBazaar.name}</strong>?
              <br />
              This will also delete all its items.
            </p>
            <div className="mt-6 flex justify-center gap-4">
              <button
                onClick={() => setConfirmDeleteBazaar(null)}
                className="btn btn-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteBazaar}
                className="btn btn-sm btn-error"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
    )}
      <Footer />
    </div>
  );
};

export default Bazaar;
