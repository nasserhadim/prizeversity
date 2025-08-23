import { useEffect, useState, useContext, useMemo, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import Footer from '../components/Footer';
import toast from 'react-hot-toast';
import { Image as ImageIcon, Copy as CopyIcon } from 'lucide-react';
import { getEffectDescription, splitDescriptionEffect } from '../utils/itemHelpers';
import OrderCard from '../components/OrderCard';
import usePaginatedList from '../hooks/usePaginatedList';
import OrderFilterBar from '../components/OrderFilterBar';
import ExportButtons from '../components/ExportButtons';
import { exportOrdersToCSV, exportOrdersToJSON } from '../utils/exportOrders';
import formatExportFilename from '../utils/formatExportFilename';

// helper: compute classroom label for an order (moved to module scope to avoid TDZ)
function classroomLabel(o) {
  if (!o) return '—';
  // prefer an explicit classroom on the order, otherwise fall back to the first item's bazaar classroom
  const c = o.classroom || o.items?.[0]?.bazaar?.classroom;
  if (!c) return '—';
  // include code if present
  return c.name ? `${c.name}${c.code ? ` (${c.code})` : ''}` : '—';
}

export default function OrderHistory() {
    const { user } = useContext(AuthContext);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // UI state for filtering/sorting
    const [search, setSearch] = useState('');
    const [classroomFilter, setClassroomFilter] = useState('all');
    const [sortField, setSortField] = useState('date');
    const [sortDirection, setSortDirection] = useState('desc'); // 'asc' | 'desc'

    // compute filtered + sorted list (visibleOrders)
    const visibleOrders = useMemo(() => {
        const q = search.trim().toLowerCase();
        let list = orders.slice();

        if (classroomFilter !== 'all') {
            list = list.filter(o => o.items?.[0]?.bazaar?.classroom?._id === classroomFilter);
        }

        if (q) {
            list = list.filter(o => {
                // match order id
                if ((o._id || '').toString().toLowerCase().includes(q)) return true;
                // match classroom name/code
                if ((classroomLabel(o) || '').toLowerCase().includes(q)) return true;
                // match any item name
                if ((o.items || []).some(i => (i.name || '').toLowerCase().includes(q))) return true;
                // match total
                if ((o.total || '').toString().toLowerCase().includes(q)) return true;
                return false;
            });
        }

        // sort
        list.sort((a, b) => {
            if (sortField === 'date') {
                const da = new Date(a.createdAt).getTime();
                const db = new Date(b.createdAt).getTime();
                return sortDirection === 'asc' ? da - db : db - da;
            }
            if (sortField === 'total') {
                const ta = Number(a.total || 0);
                const tb = Number(b.total || 0);
                return sortDirection === 'asc' ? ta - tb : tb - ta;
            }
            return 0;
        });

        return list;
    }, [orders, search, classroomFilter, sortField, sortDirection]);

    // use shared pagination hook (consumes the filtered list)
    const {
      displayed: displayedOrders,
      visible,
      page,
      setPage,
      displayCount,
      setDisplayCount,
      sentinelRef,
      perPage,
      totalPages
    } = usePaginatedList(visibleOrders, {
      perPage: 10,
      resetDeps: [search, classroomFilter, sortField, sortDirection, visibleOrders.length]
    });

    useEffect(() => {
        axios
            .get(`/api/bazaar/orders/user/${user._id}`)
            .then(res => {
                setOrders(res.data || []);
                setLoading(false);
            })
            .catch(err => {
                setError(err.response?.data?.error || 'Failed to load orders');
                setLoading(false);
            });
    }, [user._id]);

    // build distinct classroom list for filter dropdown
    const classroomOptions = useMemo(() => {
        const set = new Map();
        orders.forEach(o => {
            const c = o.items?.[0]?.bazaar?.classroom;
            if (c && c._id) set.set(c._id, `${c.name} (${c.code || ''})`);
        });
        return Array.from(set.entries()).map(([id, label]) => ({ id, label }));
    }, [orders]);

    // Reset displayCount when filters change
    useEffect(() => {
        setDisplayCount(perPage);
        setPage(1);
    }, [search, classroomFilter, sortField, sortDirection, orders.length]);

    // Infinite-scroll via IntersectionObserver
    useEffect(() => {
        const el = sentinelRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && displayCount < visible.length) {
                setDisplayCount(prev => {
                    const next = Math.min(prev + perPage, visible.length);
                    setPage(Math.min(Math.ceil(next / perPage), Math.max(1, Math.ceil(visible.length / perPage))));
                    return next;
                });
            }
        }, { rootMargin: '200px' });
        observer.observe(el);
        return () => observer.disconnect();
    }, [sentinelRef, visible.length, displayCount]);

    // Export wrapper that builds a descriptive filename and returns it (ExportButtons will show toast)
    const buildBaseFilename = (displayName, label) => {
        const name = (displayName || 'user').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        return `${name}_${label}_${ts}`;
    };

    const exportCSV = async () => {
        if (!visibleOrders.length) {
            throw new Error('No orders to export');
        }
        const displayName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'user';
        const base = formatExportFilename(displayName, 'order_history');
        exportOrdersToCSV(visibleOrders, base);
        return `${base}.csv`;
    };

    const exportJSON = async () => {
        if (!visibleOrders.length) {
            throw new Error('No orders to export');
        }
        const displayName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'user';
        const base = formatExportFilename(displayName, 'order_history');
        exportOrdersToJSON(visibleOrders, base);
        return `${base}.json`;
    };

    if (loading) return <p>Loading your purchase history…</p>;
    if (error) return <p className="text-red-500">{error}</p>;

    return (
        <div className="flex flex-col min-h-screen">
            <main className="flex-grow p-4 container mx-auto">
                <h1 className="text-2xl mb-4">Your Order History</h1>

                <OrderFilterBar
                  search={search}
                  setSearch={setSearch}
                  classroomFilter={classroomFilter}
                  setClassroomFilter={setClassroomFilter}
                  classroomOptions={classroomOptions}
                  sortField={sortField}
                  setSortField={setSortField}
                  sortDirection={sortDirection}
                  setSortDirection={setSortDirection}
                  onExportCSV={exportCSV}
                  onExportJSON={exportJSON}
                  userName={`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email}
                  exportLabel="order_history"
                />

                {visibleOrders.length === 0 ? (
                    <p>No orders match your filters.</p>
                ) : (
                    <>
                        {displayedOrders.map(o => (
                            <OrderCard key={o._id} order={o} />
                        ))}

                        {/* Sentinel + simple Prev/More pagination */}
                        {displayCount < visible.length && (
                            <div ref={sentinelRef} className="h-10" />
                        )}

                        <div className="flex justify-center items-center gap-3 mt-4">
                            <button
                                className="btn btn-sm"
                                onClick={() => setDisplayCount(prev => Math.max(perPage, prev - perPage))}
                                disabled={displayCount <= perPage}
                            >
                                Prev
                            </button>
                            <div>Showing {Math.min(displayCount, visible.length)} of {visible.length}</div>
                            <button
                                className="btn btn-sm"
                                onClick={() => setDisplayCount(prev => Math.min(prev + perPage, visible.length))}
                                disabled={displayCount >= visible.length}
                            >
                                More
                            </button>
                        </div>
                     </>
                 )}
             </main>
             <Footer />
         </div>
     );
 }