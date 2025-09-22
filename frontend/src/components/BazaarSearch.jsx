import { useState, useEffect, useMemo } from "react";

const CATEGORIES = ["All", "Attack", "Defend", "Utility", "Passive"];

// Using a debounced function to limit how often we trigger searches
function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function BazaarSearch({ onFiltersChange }) {
  // Parse query string once
  const params = useMemo(() => {
    try { return new URLSearchParams(window.location.search); }
    catch { return new URLSearchParams(); }
  }, []);

  // Initialize state from query string
  const [category, setCategory] = useState(params.get("category") || "All");
  const [q, setQ] = useState(params.get("q") || "");
  const qDebounced = useDebounced(q, 350);

  useEffect(() => {
    //notify parent of filter changes
    const filters = { category, q: qDebounced };
    onFiltersChange?.(filters);
  }, [category, qDebounced]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
      <div className="md:col-span-3">
        <label className="text-sm mb-1 block">Category</label>
        <select
          className="border rounded-xl p-2 h-12 w-full"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
      >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
      </select>
    </div>

    <div className="md:col-span-9">
      <label className="text-sm mb-1 block">Search</label>
      <input
        className="border rounded-xl p-2 h-12 w-full"
        placeholder="Search items…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
    </div>
  </div>
  );
}
