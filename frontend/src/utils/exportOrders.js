/**
 * Helpers to export orders to CSV or JSON.
 * - orders: array of order objects (will tolerate missing fields)
 * - filename: optional base filename (date will be appended)
 */
export function getClassroomLabel(order) {
  if (!order) return '—';
  const c = order.classroom || order.items?.[0]?.bazaar?.classroom;
  if (!c) return '—';
  return c.name ? `${c.name}${c.code ? ` (${c.code})` : ''}` : '—';
}

function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

export function exportOrdersToCSV(orders = [], filenameBase = 'orders') {
  const header = ['orderId', 'date', 'total', 'classroom', 'items'];
  const rows = (orders || []).map(o => {
    const items = (o.items || []).map(i => i.name || i._id || '').join('|');
    return [
      escapeCsvCell(o._id || ''),
      escapeCsvCell(new Date(o.createdAt || '').toISOString() || ''),
      escapeCsvCell(o.total ?? ''),
      escapeCsvCell(getClassroomLabel(o)),
      escapeCsvCell(items)
    ].join(',');
  });
  const csv = [header.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  // Use provided base (already contains timestamp when called via formatExportFilename)
  a.download = `${filenameBase}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportOrdersToJSON(orders = [], filenameBase = 'orders') {
  const data = (orders || []).map(o => ({
    _id: o._id,
    createdAt: o.createdAt,
    total: o.total,
    classroom: (() => {
      const c = o.items?.[0]?.bazaar?.classroom || o.classroom;
      return c ? { _id: c._id, name: c.name, code: c.code } : null;
    })(),
    items: (o.items || []).map(i => ({ _id: i._id, name: i.name }))
  }));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenameBase}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default { exportOrdersToCSV, exportOrdersToJSON };