import { useState, useEffect, useMemo } from "react";

// Categories available for filtering
const CATEGORIES = ["All", "Attack", "Utility", "Passive", "Cosmetic", "Other"];

// Debounce hook: delay updates until typing pauses for the given delay
function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function BazaarSearch({ onFiltersChange }) {
  // Initialize filters from URL if present
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const [category, setCategory] = useState(params.get("category") || "All");
  const [q, setQ] = useState(params.get("q") || "");

  // Debounced version of the search query
  const qDebounced = useDebounced(q, 350);

  // Notify parent (if provided) and log whenever filters change
  useEffect(() => {
    const filters = { category, q: qDebounced };
    console.log("BazaarSearch filters:", filters);
    if (onFiltersChange) onFiltersChange(filters);
  }, [category, qDebounced, onFiltersChange]);

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Bazaar – Browse Items</h1>

      {/* Filter controls: category dropdown + search input */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        {/* Category dropdown */}
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

        {/* Search input */}
        <div className="md:col-span-2 flex flex-col">
          <label className="text-sm mb-1">Search</label>
          <input
            className="border rounded-xl p-2"
            placeholder="Search items…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <span className="text-xs opacity-60 mt-1">
            Search is debounced by 350ms
          </span>
        </div>
      </div>

      {/* Current filters for quick verification */}
      <div className="text-sm opacity-70">
        Current filters → Category: {category}, Query: “{qDebounced}”
      </div>

      {/* Placeholder for results area; data rendering will be added later */}
      <div className="text-sm opacity-60">
        Results will be displayed here after integration
      </div>
    </div>
  );
}