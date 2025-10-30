import { useEffect, useState, useRef } from 'react';
import BazaarSearch from "../components/BazaarSearch.jsx";
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
import apiDiscount from '../API/apiDiscount.js';
import InventorySection from '../components/InventorySection';
import toast from 'react-hot-toast';
import Footer from '../components/Footer';
import { resolveBannerSrc } from '../utils/image';
import { useBazaarTemplates } from '../hooks/useBazaarTemplates';

const Bazaar = () => {
  const { classroomId } = useParams();
  const { user } = useAuth();
  const [bazaar, setBazaar] = useState(null);
  const [classroom, setClassroom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInventory, setShowInventory] = useState(false);
  const [showDiscounts, setShowDiscounts] = useState(false);
  const [Discounts, setDiscounts] = useState([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [nextExpireInDHMS, setNextExpireDHMS] = useState([]); // Days, hours, minutes, seconds
  

  const [confirmDeleteBazaar, setConfirmDeleteBazaar] = useState(null);
  const [EditBazaar, setEditBazaar] = useState(false);
  const [BazaarImage, setBazaarImage] = useState('');
  const [BazaarImageSource, setBazaarImageSource] = useState('url');
  const [BazaarImageFile, setBazaarImageFile] = useState('placeholder.jpg');
  const [BazaarImageUrl, setBazaarImageUrl] = useState('');
  const [BazaarImageRemoved, setBazaarImageRemoved] = useState(false);
  const BazaarFileInputRef = useRef(null);

  const [BazaarName, setBazaarName] = useState('');
  const [BazaarDesc, setBazaarDesc] = useState('');

  const {
    loading: templateLoading,
    templates,
    showViewer,
    setShowViewer,
    fetchTemplates,
    saveBazaarTemplate,
    applyTemplate,
    deleteTemplate,
  } = useBazaarTemplates();

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [templateActionMode, setTemplateActionMode] = useState('apply-delete');

  // delete bazaar
  const handleDeleteBazaar = async () => {
    if (!confirmDeleteBazaar) return;
    try {
      await apiBazaar.delete(`classroom/${classroomId}/bazaar/delete`);
      toast.success('Bazaar deleted');
      setConfirmDeleteBazaar(null);
      setBazaar(null);
    } catch (error) {
      console.error(error);
      toast.error(`Failed to delete bazaar: ${error.response?.data?.error || error.message}`);
      setConfirmDeleteBazaar(null);
    }
  };
  
  const [filteredItems, setFilteredItems] = useState([]);
  const [filters, setFilters] = useState({ category: undefined, q: "" });
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const PAGE_SIZE = 9;
  const [page, setPage] = useState(1);
  const fetchingRef = useRef(false);

  // Fetch classroom details
  const fetchClassroom = async () => {
    try {
      const response = await apiClassroom.get(`/${classroomId}`);
      setClassroom(response.data);
      return response.data;
    } catch (err) {
      console.error('Failed to fetch classroom:', err);
      return null;
    }
  };

  // this will fetch the bazaar from the classroom
  const fetchBazaar = async () => {
    try {
      const res = await apiBazaar.get(`classroom/${classroomId}/bazaar`);
      setBazaar(res.data.bazaar);
      return res.data.bazaar;
    } catch (error){
        console.error(error);
        //toast.error(`Failed to fetch bazaar: ${error.response?.data?.error || error.message}`);
      setBazaar(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  /// load the templates when a teacher opens this page
  useEffect(() => {
    if (user?.role === 'teacher' && classroomId) {
      fetchTemplates();
    }
  }, [user?.role, classroomId, fetchTemplates]);

  const fetchFilteredItems = async (filters = {}) => {
    if (!bazaar?._id) return; // need bazaarId for this route

    try {
      setSearchLoading(true);
      setSearchError("");

      const params = new URLSearchParams();
      if (
        filters.category &&
        ["Attack", "Defend", "Utility", "Passive", "Mystery"].includes(filters.category)
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
 
      //jake helped me with this part, to stop duplications. 
      
      // const raw = Array.isArray(res.data?.items)
      //   ? res.data.items
      //   : Array.isArray(res.data)
      //   ? res.data
      //   : [];
 
      // const toKeyPart = (v) =>
      //   typeof v === 'string' ? v.trim().toLowerCase() : String(v ?? '').trim().toLowerCase();
 
      // collapse visually-identical items even if _id differs
      
      // const sig = (it) => [
      //   toKeyPart(it?.name),
      //   toKeyPart(it?.price),
      //   toKeyPart(it?.image),    
      //   toKeyPart(it?.category),
      // ].join('|');
 
    // const sig = (it) => String(it?._id || '').trim();

    //   const seen = new Set();
    //   const unique = [];
    //   for (const it of raw) {
    //     const key = sig(it);
    //     if (!seen.has(key)) {
    //       seen.add(key);
    //       unique.push(it);
    //     }
    //   }
    //   setFilteredItems(unique); 


      // trying to figure out why duplication is still hapening. uncokmnet this later if doesnt work 
  
        //top block is all new for testing pruposes. 
        

    } catch (err) {
      console.error("[fetchFilteredItems] error:", err);
      setSearchError("Failed to load items");
      setFilteredItems([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // this will get the current page of items
  const totalPages = Math.max(1, Math.ceil((filteredItems.length || 0) / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const currentPageItems = (filteredItems || []).slice(start, start + PAGE_SIZE);


  
  useEffect(() => {
    const tp = Math.max(1, Math.ceil((filteredItems.length || 0) / PAGE_SIZE));
    if (page > tp) setPage(tp);
  }, [filteredItems, PAGE_SIZE, page]);

 // useEffect(() => {
   // fetchClassroom();
    //fetchBazaar();
  //}, [classroomId]);

  // reset the Bazaar Form
  const resetBazaarForm = () => {
    setBazaarName('');
    setBazaarDesc('');
    setBazaarImage('');
    setBazaarImageFile('placeholder.jpg');
    setBazaarImageSource('url');
    setBazaarImageUrl('');
    if (BazaarFileInputRef.current) BazaarFileInputRef.current.value = '';
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
        });
      }

      toast.success('Bazaar updated successfully');
      setBazaarImageRemoved(false);
      resetBazaarForm();
      fetchBazaar();
    } catch (err) {
      if (err.response?.data?.message === 'No changes were made') {
        toast.error('No changes were made');
      } else {
        toast.error('Failed to edit Bazaar');
      }
    }
  };



useEffect(() => {
  let cancelled = false; 
  const loadAll = async () => {
    if (fetchingRef.current) return; // already fetching
    fetchingRef.current = true;
    try {
      //loading classroom and bazaar in parallel
      const[, baz] = await Promise.all([fetchClassroom(), fetchBazaar()]);
      //once bazaar id is loaded, load item ONLY ONCE
      if(!cancelled && baz?._id) {
        await fetchFilteredItems(filters);
        setPage(1);
      }
    } finally {
      fetchingRef.current = false;
    }
  };
  loadAll();
  return () => { cancelled = true; };
}, [classroomId]); //depends only on classroomID



  // this will keep the bazaar.items in sync after an update
  const handleItemUpdated = (updatedItem) => {
    setBazaar(prev => ({
      ...prev,
      items: prev?.items?.map(it =>
        String(it._id) === String(updatedItem._id) ? updatedItem : it
      ) || []
    }));

    setFilteredItems(prev =>
      Array.isArray(prev)
        ? prev.map(it =>
            String(it._id) === String(updatedItem._id) ? updatedItem : it
          )
        : prev
    );
  };

  // Remove an item from bazaar.items after delete
  const handleItemDeleted = (itemId) => {
    setBazaar(prev => ({ 
      ...prev,
      items: prev?.items?.filter(it => String(it._id) !== String(itemId)) || []
    }));

    setFilteredItems(prev =>
      Array.isArray(prev)
        ? prev.filter(it => String(it._id) !== String(itemId))
        : prev
    );
  };

  // added to automatically get discounts
useEffect(() => {
  if (user?._id && classroomId) {
    getDiscounts();
  }
  //console.log("Discounts loaded:", discounts);
}, [user?._id, classroomId]);

  // Gets the discounts for the student in the bazaar
  const getDiscounts = async () => {
    try {
        const res = await apiDiscount.get(`/classroom/${classroomId}/user/${user._id}`);
        const discountData = res.data || [];
        
        setDiscounts(discountData);


        let percent = 0;
        let timeLeft = 0;
        let days = 0;
        let hours = 0;
        let minutes = 0;
        let timeLeftInDHMS = [];
        
        if (discountData.length)
        {
            const combined = discountData.reduce(
                (acc, d) => acc * (1 - (d.discountPercent || 0) / 100), 1
            );
            percent = (1 - combined) * 100;
            const nextGone = discountData.reduce(
                (min, d) => { return (d.expiresAt < min.expiresAt) ? d : min, null}
            );
            // determines time left in days, hours, minutes, seconds

            console.log("Time left variable: ", nextGone.expiresAt);
            timeLeft = Math.abs(new Date(nextGone.expiresAt) - Date.now()) / 1000;
            console.log("Time left variable: ", timeLeft);

            days = Math.floor(timeLeft / 86400);
            timeLeft -= days * 86400;
            console.log("Time left variable: ", timeLeft);

            hours = Math.floor(timeLeft / 3600);
            timeLeft -= hours * 3600;
            console.log("Time left variable: ", timeLeft);

            minutes = Math.floor(timeLeft / 60);
            timeLeft -= minutes * 60;
            console.log("Time left variable: ", timeLeft);

        }
        timeLeftInDHMS = [days, hours, minutes, Math.floor(timeLeft)];
        setDiscountPercent(percent);
        setNextExpireDHMS(timeLeftInDHMS);
        console.log("Time left variable: ", timeLeft);
        //console.log("Discount applied: ", percent)

    } catch (err) {
        console.error("Failed to load discounts:", err);
    }
};

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-base-200">
    <span className="loading loading-ring loading-lg"></span>
  </div>;

  // Case: Bazaar not yet created
  if (!bazaar) { // edited to use card grid
    return user?.role === "teacher" ? (
      <div className="flex flex-col min-h-screen bg-base-200">
        <div className="flex-grow p-6 space-y-6">
          {/* this would apply the Template Panel (when no bazaar yet) */}
          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body">
              <h2 className="text-xl font-semibold">Apply Template</h2>
              <p className="text-sm opacity-70">
                You can easily set your bazaar up with an already made template:
              </p>

              {templateLoading ? (
                <div className="text-sm opacity-70 mt-3">Loading…</div>
              ) : templates?.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                  {templates.map((t) => (
                    <div
                      key={t._id}
                      className="card card-compact bg-base-100 border border-base-300 shadow-sm"
                    >
                      <div className="card-body">
                        <div className="min-w-0">
                          <h3 className="card-title text-base truncate">{t.name}</h3>
                         <p className="text-xs text-black">
                            From: {t.sourceClassroom?.name || "Classroom"}<br />
                            Class Code: {t.sourceClassroom?.code ? ` (${t.sourceClassroom.code})` : ""}<br />
                            Items: {t.countItem ?? 0} item{(t.countItem ?? 0) === 1 ? "" : "s"}<br />
                            Template Saved: {new Date(t.createdAt).toLocaleDateString()}
                        </p>
                        </div>
                        <div className="card-actions justify-end mt-2">
                          <button
                            className="btn btn-sm btn-success"
                            onClick={async () => {
                              const created = await applyTemplate(t._id, classroomId);
                              if (created) {
                                setBazaar(created);
                                toast.success("Template applied");
                              }
                            }}
                          >
                            Apply
                          </button>
                          {confirmDeleteId === t._id ? (
                            <>
                              <button
                                className="btn btn-sm btn-error"
                                onClick={async () => {
                                  await deleteTemplate(t._id);
                                  setConfirmDeleteId(null);
                                  await fetchTemplates();
                                  toast.success('Template deleted');
                                }}
                              >
                                Confirm
                              </button>
                              <button
                                className="btn btn-sm btn-ghost"
                                onClick={() => setConfirmDeleteId(null)}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              className="btn btn-sm btn-outline btn-error"
                              onClick={() => setConfirmDeleteId(t._id)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm opacity-70 mt-3">
                  There are no templates yet, create a bazaar and click “Save as Template” to have one.
                </div>
              )}
            </div>
          </div>

          {/* this is the divider thats between Apply Template and Create Bazaar */}
          <div className="divider my-4">OR</div>

          <CreateBazaar classroomId={classroomId} onCreate={setBazaar} />
        </div>
        <Footer />
      </div>
    ) : (
      <div className="flex flex-col min-h-screen bg-base-200">
        <div className="flex-grow p-6 text-center text-lg font-semibold text-base-content/70">
          The bazaar is not open yet.
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
        {(user?.role === "teacher" || user?.role === "admin") && (
          <div className="flex flex-col gap-2 items-end">
            <div className="flex gap-2">
              <button
                className="btn btn-sm btn-info"
                onClick={() => handleEditBazaar(bazaar)}
              >
                Edit
              </button>
              <button
                className="btn btn-sm btn-error"
                onClick={() => setConfirmDeleteBazaar(bazaar)}
              >
                Delete
              </button>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                className="btn btn-sm"
                onClick={async () => {
                  const created = await saveBazaarTemplate(bazaar._id);
                  if (created) {
                    await fetchTemplates();
                    setTemplateActionMode('none'); 
                    setShowViewer(true);
                  }
                }}
                title="Save current bazaar (with items) as a reusable template"
              >
                Save as Template
              </button>
              <button
                className="btn btn-sm btn-outline"
                onClick={async () => {
                  await fetchTemplates();
                  setTemplateActionMode('delete');
                  setShowViewer(true);
                }}
                title="View/apply/delete your templates"
              >
                View Templates
              </button>
            </div>
          </div>
        )}
      </div>

      {/* This will search & filter the controls for the Bazaar items */}
      <BazaarSearch
        onFiltersChange={(f) => {
          setPage(1);
          setFilters(f);
          fetchFilteredItems(f);   
        }}
      />
      {/* Discount Section*/}
      {Discounts.length > 0 && (
        <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold text-success flex items-center gap-2">
            {discountPercent}% Discounts : Next expires in {nextExpireInDHMS[0]} days, {nextExpireInDHMS[1]} hours, {nextExpireInDHMS[2]} minutes, {nextExpireInDHMS[3]} seconds
          </h3>
          <div className="flex items-center justify-between mb-2">
            <button
                onClick={() => setShowDiscounts(!showDiscounts)}
                className={`btn btn-sm transition-all duration-200 ${showDiscounts ? 'btn-outline btn-error' : 'btn-success'}`}
              >
                {showDiscounts ? 'Hide' : 'Show'} Discounts
            </button>
           </div>
            {/* Discount Section */}
            {showDiscounts && (
              <div className="mt-4">
                {discountPercent}
                <InventorySection userId={user._id} classroomId={classroomId} />
              </div>
            )}
        </div>
       </div>
      )}

      {/* Filtered results section */}
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
                  role={user?.role}
                  classroomId={classroomId}
                  teacherId={classroom?.teacher?._id || classroom?.teacher}
                  bazaarIdProp={bazaar?._id}
                  onUpdated={handleItemUpdated}
                  onDeleted={handleItemDeleted}
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
        {user?.role === 'teacher' && (
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

        {/* Inventory Section with Button in Header */}
        <div className="card bg-base-200 shadow-inner border border-base-300">
          <div className="card-body p-4">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setShowInventory(!showInventory)}
                className={`btn btn-sm transition-all duration-200 ${showInventory ? 'btn-outline btn-error' : 'btn-success'}`}
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

        

        {/* This is for editing the Bazaar */}
        {EditBazaar && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-base-100 p-6 rounded-xl shadow-lg w-[90%] max-w-lg">
              <h2 className="text-lg font-semibold mb-4 text-center">Edit Bazaar</h2>

              {/* This is for modifying the bazaar name & description */}
              <div className="mb-4">
                <label className="label">
                  <span className="label-text">Bazaar Name</span>
                </label>
                <input
                  type="text"
                  placeholder={bazaar.name}
                  className="input input-bordered w-full mb-3"
                  value={BazaarName}
                  onChange={(e) => setBazaarName(e.target.value)}
                />
              </div>
              <div className="mb-4">
                <label className="label">
                  <span className="label-text">Bazaar Description</span>
                </label>
                <input
                  type="text"
                  placeholder={bazaar.description}
                  className="input input-bordered w-full mb-3"
                  value={BazaarDesc}
                  onChange={(e) => setBazaarDesc(e.target.value)}
                />
              </div>

              {/* Image controls */}
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
                      ref={BazaarFileInputRef}
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
                This will also delete the items.
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

        {showViewer && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
            <div className="bg-base-100 w-[95%] max-w-3xl rounded-xl shadow-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Your Bazaar Templates</h3>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => { setConfirmDeleteId(null); setShowViewer(false); }}
                >
                  Close
                </button>
              </div>

              {/* this is for the bazaar templates so that they can be in card form */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Saved Templates</h4>
                  <button
                    className="btn btn-xs"
                    onClick={async () => {
                      await fetchTemplates();
                    }}
                  >
                    Refresh
                  </button>
                </div>

                {templateLoading ? (
                  <div className="text-sm opacity-70">Loading…</div>
                ) : (templates?.length ?? 0) > 0 ? (
                  <div className="max-h-60 overflow-auto pr-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {templates.map((t) => (
                        <div
                          key={t._id}
                          className="card card-compact bg-base-100 border border-base-300 shadow-sm"
                        >
                          <div className="card-body">
                            <div className="min-w-0">
                              <div className="card-title text-sm truncate">{t.name}</div>
                              <div className="text-xs opacity-70 truncate">
                                From: {t.sourceClassroom?.name || 'Classroom'}
                                {t.sourceClassroom?.code ? ` (${t.sourceClassroom.code})` : ''}
                                {" • "}
                                {t.countItem ?? 0} item{(t.countItem ?? 0) === 1 ? '' : 's'} •{' '}
                                {new Date(t.createdAt).toLocaleDateString()}
                              </div>
                            </div>

                            <div className="card-actions justify-end mt-2">
                              {templateActionMode === 'none' ? (
                                // there are actions for "Save as Template" viewer, only you can view
                                null
                              ) : templateActionMode === 'delete' ? (
                                // this is the Delete button (with confirm)
                                <>
                                  {confirmDeleteId === t._id ? (
                                    <>
                                      <button
                                        className="btn btn-xs btn-error"
                                        onClick={async () => {
                                          await deleteTemplate(t._id);
                                          setConfirmDeleteId(null);
                                          await fetchTemplates();
                                          toast.success('Template deleted');
                                        }}
                                      >
                                        Confirm
                                      </button>
                                      <button
                                        className="btn btn-xs btn-ghost"
                                        onClick={() => setConfirmDeleteId(null)}
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      className="btn btn-xs btn-outline btn-error"
                                      onClick={() => setConfirmDeleteId(t._id)}
                                    >
                                      Delete
                                    </button>
                                  )}
                                </>
                              ) : (
                                <>
                                  <button
                                    className="btn btn-xs btn-success"
                                    onClick={async () => {
                                      const created = await applyTemplate(t._id, classroomId);
                                      if (created) {
                                        setBazaar(created);
                                        setShowViewer(false);
                                        toast.success('Template applied');
                                      }
                                    }}
                                  >
                                    Apply
                                  </button>
                                  {confirmDeleteId === t._id ? (
                                    <>
                                      <button
                                        className="btn btn-xs btn-error"
                                        onClick={async () => {
                                          await deleteTemplate(t._id);
                                          setConfirmDeleteId(null);
                                          await fetchTemplates();
                                          toast.success('Template deleted');
                                        }}
                                      >
                                        Confirm
                                      </button>
                                      <button
                                        className="btn btn-xs btn-ghost"
                                        onClick={() => setConfirmDeleteId(null)}
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      className="btn btn-xs btn-outline btn-error"
                                      onClick={() => setConfirmDeleteId(t._id)}
                                    >
                                      Delete
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm opacity-70">There are no that saved templates yet.</div>
                )}
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
