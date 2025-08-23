import React from 'react';
import toast from 'react-hot-toast';
import { DownloadCloud, FileText } from 'lucide-react';

/**
 * ExportButtons - renders CSV/JSON export buttons with icons and success/error toasts.
 * onExportCSV/onExportJSON should be async functions that return the generated filename (string)
 */
export default function ExportButtons({
  onExportCSV,
  onExportJSON,
  userName = '',
  exportLabel = 'orders',
  className = ''
}) {
  const handleExport = async (fn, kind) => {
    if (!fn) return;
    try {
      const result = await fn(); // expected to return filename (string)
      const filename = typeof result === 'string' && result ? result : `${userName || 'export'}_${exportLabel}`;
      toast.success(`Exported ${kind} as ${filename}`);
    } catch (err) {
      console.error('Export failed', err);
      toast.error(err?.message || 'Export failed');
    }
  };

  return (
    <div className={`ml-auto flex gap-2 ${className}`}>
      {onExportCSV && (
        <button
          className="btn btn-sm btn-ghost flex items-center gap-2"
          onClick={() => handleExport(onExportCSV, 'CSV')}
          title={`Export ${exportLabel} as CSV`}
        >
          <DownloadCloud size={16} />
          <span>Export CSV</span>
        </button>
      )}

      {onExportJSON && (
        <button
          className="btn btn-sm btn-ghost flex items-center gap-2"
          onClick={() => handleExport(onExportJSON, 'JSON')}
          title={`Export ${exportLabel} as JSON`}
        >
          <FileText size={16} />
          <span>Export JSON</span>
        </button>
      )}
    </div>
  );
}