import React from 'react';
import ExportButtons from './ExportButtons';
import { ArrowUp, ArrowDown } from 'lucide-react';

export default function OrderFilterBar({
  search,
  setSearch,
  classroomFilter,
  setClassroomFilter,
  classroomOptions = [],
  sortField,
  setSortField,
  sortDirection,
  setSortDirection,
  onExportCSV,
  onExportJSON,
  userName,
  exportLabel,
  className = ''
}) {
  return (
    <div className={`flex flex-wrap gap-2 items-center mb-4 ${className}`}>
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
        className="btn btn-outline btn-sm flex items-center gap-2"
        onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
        aria-label="Toggle sort direction"
        title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
      >
        {sortDirection === 'asc' ? (
          <>
            <ArrowUp size={14} />
            <span className="hidden sm:inline">Asc</span>
          </>
        ) : (
          <>
            <ArrowDown size={14} />
            <span className="hidden sm:inline">Desc</span>
          </>
        )}
      </button>

      {/* Render export buttons inline so they sit on same row as filters */}
      {(onExportCSV || onExportJSON) && (
        <ExportButtons
          onExportCSV={onExportCSV}
          onExportJSON={onExportJSON}
          userName={userName}
          exportLabel={exportLabel}
        />
      )}
    </div>
  );
}