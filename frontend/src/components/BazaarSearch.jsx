import { useState, useEffect, useMemo } from "react";

const CATEGORIES = ["All", "Attack", "Defend", "Utility", "Passive"];

function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function BazaarSearch({ onFiltersChange }) {
  // Guard window in case of SSR; fine on client
  const params = useMemo(() => {
    try { return new URLSearchParams(window.location.search); }
    catch { return new URLSearchParams(); }
  }, []);

  const [category, setCategory] = useState(params.get("category") || "All");
  const [q, setQ] = useState(params.get("q") || "");
  const qDebounced = useDebounced(q, 350);

  useEffect(() => {
    // Map "All" to no category for the parent/API
    const cat = category === "All" ? undefined : category;
    onFiltersChange?.({ category: cat, q: qDebounced });
  }, [category, qDebounced, onFiltersChange]);

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <div className="flex flex-col">
          <label className="text-sm mb-1">Category</label>
          <select
            className="border rounded-xl p-2"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2 flex flex-col">
          <label className="text-sm mb-1">Search</label>
          <input
            className="border rounded-xl p-2"
            placeholder="Search items…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <span className="text-xs opacity-60 mt-1">Search is debounced by 350ms</span>
        </div>
      </div>
    </div>
  );
}
