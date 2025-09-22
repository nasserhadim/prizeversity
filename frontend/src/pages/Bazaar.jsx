import BazaarSearch from "../components/BazaarSearch.jsx";
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Store, HandCoins } from 'lucide-react';
import { Image as ImageIcon } from 'lucide-react';
// import axios from 'axios'
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
    } catch {
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

      setFilteredItems(res.data.items || []);
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

  useEffect(() => {
    if (bazaar?._id) {
      fetchFilteredItems(filters);
      setPage(1);
    }
  }, [bazaar?._id]);

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
        <Footer />
      </div>
    </div>
    );
    };

      export default Bazaar;
