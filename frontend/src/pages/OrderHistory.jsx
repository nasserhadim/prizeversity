import { useEffect, useState, useContext, useMemo, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import Footer from '../components/Footer';
import toast from 'react-hot-toast';

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

    // lazy load state
    const [displayCount, setDisplayCount] = useState(10);
    const sentinelRef = useRef(null);

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

    // helper to extract classroom label from an order
    const classroomLabel = (o) => {
        const c = o.items?.[0]?.bazaar?.classroom;
        if (!c) return '—';
        return `${c.name} (${c.code || ''})`.trim();
    };

    // build distinct classroom list for filter dropdown
    const classroomOptions = useMemo(() => {
        const set = new Map();
        orders.forEach(o => {
            const c = o.items?.[0]?.bazaar?.classroom;
            if (c && c._id) set.set(c._id, `${c.name} (${c.code || ''})`);
        });
        return Array.from(set.entries()).map(([id, label]) => ({ id, label }));
    }, [orders]);

    // combined filter + sort
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

    // Reset displayCount when filters change
    useEffect(() => setDisplayCount(10), [search, classroomFilter, sortField, sortDirection, orders.length]);

    // Infinite-scroll via IntersectionObserver
    useEffect(() => {
        if (!sentinelRef.current) return;
        const observer = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && displayCount < visibleOrders.length) {
                setDisplayCount(prev => Math.min(prev + 10, visibleOrders.length));
            }
        }, { rootMargin: '200px' });
        observer.observe(sentinelRef.current);
        return () => observer.disconnect();
    }, [sentinelRef, visibleOrders.length, displayCount]);

    // slice for lazy rendering
    const displayedOrders = useMemo(() => visibleOrders.slice(0, displayCount), [visibleOrders, displayCount]);

    // helpers: short id and copy
    // show first 6 + last 6 with ellipsis in the middle; hover shows full id via title
    const shortId = (id) => {
        if (!id) return '';
        if (id.length <= 14) return id;
        return `${id.slice(0, 6)}...${id.slice(-6)}`;
    };

    const copyToClipboard = async (text) => {
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                ta.remove();
            }
            toast.success('Order ID copied');
        } catch (err) {
            toast.error('Copy failed');
        }
    };

    // Export visibleOrders (not just displayed) to CSV / JSON
    const exportCSV = () => {
        if (!visibleOrders.length) {
            toast('No orders to export');
            return;
        }
        const header = ['orderId', 'date', 'total', 'classroom', 'items'];
        const rows = visibleOrders.map(o => {
            const items = (o.items || []).map(i => i.name).join('|');
            return [
                `"${o._id}"`,
                `"${new Date(o.createdAt).toISOString()}"`,
                o.total,
                `"${classroomLabel(o).replace(/"/g, '""')}"`,
                `"${items.replace(/"/g, '""')}"`
            ].join(',');
        });
        const csv = [header.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `orders_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    const exportJSON = () => {
        if (!visibleOrders.length) {
            toast('No orders to export');
            return;
        }
        const data = visibleOrders.map(o => ({
            _id: o._id,
            createdAt: o.createdAt,
            total: o.total,
            classroom: (() => {
                const c = o.items?.[0]?.bazaar?.classroom;
                return c ? { _id: c._id, name: c.name, code: c.code } : null;
            })(),
            items: (o.items || []).map(i => ({ _id: i._id, name: i.name }))
        }));
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `orders_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    if (loading) return <p>Loading your purchase history…</p>;
    if (error) return <p className="text-red-500">{error}</p>;

    return (
        <div className="flex flex-col min-h-screen">
            <main className="flex-grow p-4 container mx-auto">
                <h1 className="text-2xl mb-4">Your Order History</h1>

                {/* Filter / Sort bar */}
                <div className="flex flex-wrap gap-2 items-center mb-4">
                    <input
                        type="search"
                        placeholder="Search by order id, item, classroom or total..."
                        className="input input-bordered flex-1 min-w-[220px]"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />

                    <select
                        className="select select-bordered"
                        value={classroomFilter}
                        onChange={(e) => setClassroomFilter(e.target.value)}
                    >
                        <option value="all">All Classrooms</option>
                        {classroomOptions.map(c => (
                            <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                    </select>

                    <select
                        className="select select-bordered"
                        value={sortField}
                        onChange={(e) => setSortField(e.target.value)}
                    >
                        <option value="date">Sort: Date</option>
                        <option value="total">Sort: Total</option>
                    </select>

                    <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                    >
                        {sortDirection === 'asc' ? 'Asc' : 'Desc'}
                    </button>

                    {/* Export buttons with icons */}
                    <div className="ml-auto flex gap-2">
                        <button
                            className="btn btn-sm btn-ghost flex items-center"
                            onClick={exportCSV}
                            title="Export CSV"
                            aria-label="Export CSV"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 11h6M9 14h6M9 17h6" />
                            </svg>
                            Export to CSV
                        </button>

                        <button
                            className="btn btn-sm btn-ghost flex items-center"
                            onClick={exportJSON}
                            title="Export JSON"
                            aria-label="Export JSON"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 8c-2 1.5-2 6 0 7" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8c2 1.5 2 6 0 7" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 4h4M10 20h4" />
                            </svg>
                            Export to JSON
                        </button>
                    </div>
                </div>

                {visibleOrders.length === 0 ? (
                    <p>No orders match your filters.</p>
                ) : (
                    <>
                        {displayedOrders.map(o => (
                            <div key={o._id} className="border rounded p-4 mb-4 bg-base-100 shadow">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p><strong>Date:</strong> {new Date(o.createdAt).toLocaleString()}</p>
                                        <p><strong>Total:</strong> {o.total} ₿</p>
                                        <p><strong>Classroom:</strong> {classroomLabel(o)}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="mt-2 flex gap-2 justify-end items-center">
                                            <span
                                                className="text-xs font-mono"
                                                title={o._id}
                                                aria-label="Full order id"
                                            >
                                                {shortId(o._id)}
                                            </span>

                                            <button
                                                className="btn btn-xs btn-ghost p-1"
                                                onClick={() => copyToClipboard(o._id)}
                                                title="Copy order ID"
                                                aria-label="Copy order ID"
                                            >
                                                {/* larger clipboard icon */}
                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2m-6 4h6m-6 4h6M8 7h8a2 2 0 012 2v8a2 2 0 01-2 2H8a2 2 0 01-2-2V9a2 2 0 012-2z" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {o.items && o.items.length > 0 && (
                                    <ul className="list-disc list-inside mt-2">
                                        {o.items.map(i => <li key={i._id}>{i.name}</li>)}
                                    </ul>
                                )}
                            </div>
                        ))}

                        {/* Sentinel div for lazy loading */}
                        {displayCount < visibleOrders.length && (
                            <div ref={sentinelRef} className="h-10" />
                        )}
                    </>
                )}
            </main>
            <Footer />
        </div>
    );
}