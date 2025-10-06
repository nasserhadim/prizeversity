import BazaarSearch from "../components/BazaarSearch.jsx";
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Store, HandCoins } from 'lucide-react';
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
  const [BazaarImage, setBazaarImage] = useState('');
  const [BazaarImageSource, setBazaarImageSource] = useState('url');
  const [BazaarImageFile, setBazaarImageFile] = useState('placeholder.jpg');
  const [BazaarImageUrl, setBazaarImageUrl] = useState('');
  const [BazaarImageRemoved, setBazaarImageRemoved] = useState(false);
  const BazaarFileInputRef = useState(null);

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

    
    /*
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
        
    };*/


  const [filteredItems, setFilteredItems] = useState([]);
  const [filters, setFilters] = useState({ category: undefined, q: "" });
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const PAGE_SIZE = 9;
  const [page, setPage] = useState(1);

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

  const fetchFilteredItems = async (filters = {}) => {
    if (!bazaar?._id) return; // need bazaarId for this route

    try {
      setSearchLoading(true);
      setSearchError("");

      const params = new URLSearchParams();
      if (
        filters.category &&
        ["Attack", "Defend", "Utility", "Passive"].includes(filters.category)
      ) {
        params.append("category", filters.category);
      }
      if (filters.q) {
        params.append("q", filters.q);
      }

      // GET /classroom/:classroomId/bazaar/:bazaarId/items
      const res = await apiBazaar.get(
        `classroom/${classroomId}/bazaar/${bazaar._id}/items?${params.toString()}`
      );

      //setFilteredItems(res.data.items || []);
      const raw = Array.isArray(res.data?.items)
        ? res.data.items
        : Array.isArray(res.data)
        ? res.data
        : [];

      const toKeyPart = (v) =>
        typeof v === 'string' ? v.trim().toLowerCase() : String(v ?? '').trim().toLowerCase();
 
      // collapse visually-identical items even if _id differs
      const sig = (it) => [
        toKeyPart(it?.name),
        toKeyPart(it?.price),
        toKeyPart(it?.image),    
        toKeyPart(it?.category),
      ].join('|');
 
      const seen = new Set();
      const unique = [];
      for (const it of raw) {
        const key = sig(it);
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(it);
        }
      }
      setFilteredItems(unique);

    } catch (err) {
      console.error("[fetchFilteredItems] error:", err);
      setSearchError("Failed to load items");
      setFilteredItems([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // Derive current page of items
  const totalPages = Math.max(1, Math.ceil((filteredItems.length || 0) / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const currentPageItems = (filteredItems || []).slice(start, start + PAGE_SIZE);

  useEffect(() => {
    const tp = Math.max(1, Math.ceil((filteredItems.length || 0) / PAGE_SIZE));
    if (page > tp) setPage(tp);
  }, [filteredItems, PAGE_SIZE, page]);

  useEffect(() => {
    fetchClassroom();
    fetchBazaar();
  }, [classroomId]);

  // reset the Bazaar Form
const resetBazaarForm = () => {
    setBazaarName('');
    setBazaarDesc('');
    setBazaarImage('');
    setBazaarImageFile('placeholder.jpg'); // ADD
    setBazaarImageSource('url'); // ADD
    setBazaarImageUrl(''); // ADD
    if (BazaarFileInputRef.current) BazaarFileInputRef.current.value = ''; // clear native file input on reset
};

// Editing the Bazaar
const handleEditBazaar = (bazaar) => {
    setBazaarName(bazaar.name);
    setBazaarDesc(bazaar.description);
    setBazaarImage(bazaar.image);
    setBazaarImageFile(null);
    setBazaarImageSource('url');
    setBazaarImageUrl('');
    setEditBazaar(true);
};

// Update Bazaar (modified to handle file uploads + remove flag)
const handleUpdateBazaar = async () => {
    if (!BazaarName.trim()) return toast.error('Bazaar name is required');

    try {
        // If a new file was chosen, send multipart/form-data with the file
        if (BazaarImageSource === 'file' && BazaarImageFile) {
            const fd = new FormData();
            fd.append('name', BazaarName);
            fd.append('description', BazaarDesc);
            fd.append('image', BazaarImageFile);
            await apiBazaar.put(`classroom/bazaar/edit/${bazaar._id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' }});
        } else {
            await apiBazaar.put(`classroom/bazaar/edit/${bazaar._id}`, {
            name: BazaarName,
            description: BazaarDesc,
            //image: BazaarImageRemoved ? 'placeholder.jpg' : (BazaarImageSource === 'url' ? BazaarImageUrl : undefined),
            });
        }

        toast.success('Bazaar updated successfully');
        // reset remove flag after successful update
        setBazaarImageRemoved(false);
        resetBazaarForm();
        fetchBazaar();
    } catch (err) {
        if (err.response?.data?.message === 'No changes were made') {
            toast.error('No changes were made');
        } else {
            toast.error('Failed to update group set');
        }
    }
  };



  useEffect(() => {
    if (bazaar?._id) {
      fetchFilteredItems(filters);
      setPage(1);
    }
  }, [bazaar?._id]);


// Keep bazaar.items in sync after an update
const handleItemUpdated = (updatedItem) => {
  // Update bazaar
  setBazaar(prev => ({
    ...prev, //keeps all other prev fields
    items: prev?.items?.map(it =>
    // if the current item id matches the updated one, replace it
      String(it._id) === String(updatedItem._id) ? updatedItem : it
    ) || [] // fallback to empty array if items was undefined
  }));

  // Update filteredItems (what your grid actually maps over/show)
  setFilteredItems(prev =>
    Array.isArray(prev)
      ? prev.map(it => //replaces the matching item with the new updated one 
          String(it._id) === String(updatedItem._id) ? updatedItem : it
        )
      : prev //make susre it wasnt an array, if its not, it returns unchanged 
  );
};

// Remove an item from bazaar.items after delete
const handleItemDeleted = (itemId) => { // itemId is the _id of the deleted item
  // Update bazaar
  setBazaar(prev => ({ 
    ...prev,
    items: prev?.items?.filter(it => String(it._id) !== String(itemId)) || [] // in case items was undefined (shouldn't happen
  }));

  // Update filteredItems (what your grid actually maps over)
  setFilteredItems(prev =>
    Array.isArray(prev) //removes teh item from filtered items if it exists with id 
      ? prev.filter(it => String(it._id) !== String(itemId))
      : prev
  );
};


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
                <button className="btn btn-sm btn-info" onClick={() => handleEditBazaar(bazaar)}>Edit</button>
                <button className="btn btn-sm btn-error" onClick={() => setConfirmDeleteBazaar(bazaar)}>Delete</button>
            </div>
        )}

      </div>

      {/* (JA) Search & filter controls for the Bazaar items */}
      <BazaarSearch
        onFiltersChange={(f) => {
          setPage(1);
          setFilters(f);
          fetchFilteredItems(f);   
        }}
      />

      {/* (JA) Filtered results section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold text-success flex items-center gap-2">
            <HandCoins />
            Items for Sale
          </h3>
          <span className="badge badge-outline text-sm hidden md:inline">
            {filteredItems.length} item{filteredItems.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="divider my-0"></div>

        {searchLoading && (
          <div className="min-h-[80px] flex items-center text-sm opacity-70">
            Loading items…
          </div>
        )}

        {searchError && (
          <div className="text-red-600 text-sm">
            {searchError}
          </div>
        )}

        {!searchLoading && !searchError && filteredItems.length === 0 && (
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
            <p className="italic">No items match your filters.</p>
          </div>
        )}

        {!searchLoading && !searchError && currentPageItems.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {currentPageItems.map((item) => (
                <ItemCard
                  key={item._id}
                  item={item}
                  role={user.role}
                  classroomId={classroomId}
                  teacherId={classroom?.teacher?._id || classroom?.teacher} 
                  bazaarIdProp={bazaar?._id}//always pass teacher ID, if classroom.teacher is populated object use _id else use as is
                  onUpdated={handleItemUpdated} // pass down to update cart items if price/name changed
                  onDeleted={handleItemDeleted} // pass down to remove from cart if item deleted
                />
              ))}
            </div>

            {/* Pagination controls */}
            <div className="flex items-center justify-between mt-4">
              <button
                className="btn btn-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </button>
              <div className="text-sm opacity-70">Page {page} of {totalPages}</div>
              <button
                className="btn btn-sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </button>
            </div>
          </>
        )}

        {/* Teacher Create Item */}
        {user.role === 'teacher' && (
          <div className="card card-compact bg-base-100 shadow p-4 border border-base-200">
            <CreateItem
              bazaarId={bazaar._id}
              classroomId={classroomId}
              //trying to fix this item duplication issue when student purchases/. 
              onAdd={(newItem) => {
                setBazaar(prev => ({ ...prev, items: [...(prev.items || []), newItem] }));
                fetchFilteredItems(filters);
              }}
            />
          </div>
        )}

        {/* Items for Sale Section
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
        */}


        {/* Inventory Section with Button in Header */}
        <div className="card bg-base-200 shadow-inner border border-base-300">
          <div className="card-body p-4">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setShowInventory(!showInventory)}
                className={`btn btn-sm transition-all duration-200 ${showInventory ? 'btn-outline btn-error' : 'btn-success'
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
                    onClick={handleUpdateBazaar}
                  >
                    Update Bazaar
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
    </div>
    );
    };

      export default Bazaar;
