import { useState, useEffect, useMemo } from "react";

// Categories available for filtering
const CATEGORIES = ["All", "Attack", "Utility", "Passive", "Cosmetic", "Other"];

export default function BazaarSearch() {
  // Initialize category from URL if present; otherwise default to "All"
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const [category, setCategory] = useState(params.get("category") || "All");

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Bazaar – Browse Items</h1>

      {/* Filter controls: category dropdown */}
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
      </div>

      {/* Temporary dev output for visual confirmation */}
      <div className="text-sm opacity-70">
        Current category: {category}
      </div>
    </div>
  );
}