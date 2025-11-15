/**
 * Helpers to export orders to CSV or JSON.
 */
export function getClassroomLabel(order) {
  if (!order) return '—';

  // 1) Prefer populated classroom from first item (most reliable)
  const itemCls = order.items?.[0]?.bazaar?.classroom;
  if (itemCls && typeof itemCls === 'object' && itemCls.name) {
    return `${itemCls.name}${itemCls.code ? ` (${itemCls.code})` : ''}`;
  }

  // 2) If order.classroom is populated, use it
  const orderCls = order.classroom;
  if (orderCls && typeof orderCls === 'object' && orderCls.name) {
    return `${orderCls.name}${orderCls.code ? ` (${orderCls.code})` : ''}`;
  }

  // 3) Fallback to metadata (used by mystery box orders)
  if (order.metadata?.classroomName) {
    return order.metadata.classroomCode
      ? `${order.metadata.classroomName} (${order.metadata.classroomCode})`
      : order.metadata.classroomName;
  }

  // 4) Never show raw ObjectId/string
  return '—';
}

function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  // Escape quotes and wrap in quotes
  return `"${s.replace(/"/g, '""')}"`;
}

export function exportOrdersToCSV(orders = [], filenameBase = 'orders') {
  const header = ['orderId', 'type', 'date', 'total', 'classroom', 'classroomId', 'description', 'items']; // ADDED classroomId
  const rows = (orders || []).map(o => {
    // CHANGED: Use metadata.itemDetails if items are deleted
    const displayItems = (o.items && o.items.length > 0)
      ? o.items
      : (o.metadata?.itemDetails || []);

    // Derive classroom object (same logic as JSON export)
    const itemCls = o.items?.[0]?.bazaar?.classroom;
    const orderCls = o.classroom;
    const classroomObj =
      (itemCls && typeof itemCls === 'object' && itemCls.name ? itemCls :
        (orderCls && typeof orderCls === 'object' && orderCls.name ? orderCls : null));

    // Label (existing helper)
    const classroomLabel = getClassroomLabel(o);
    // Id (only if we have an object or a raw string ObjectId)
    const classroomId = classroomObj?._id
      || (typeof orderCls === 'string' ? orderCls : '');

    const items = displayItems.map(i => i?.name || i?._id || '').join('|');
    const orderType = o.type || 'purchase';
    const description = o.description || '';

    return [
      escapeCsvCell(o._id || ''),
      escapeCsvCell(orderType),
      escapeCsvCell(new Date(o.createdAt || '').toLocaleString() || ''),
      escapeCsvCell(o.total ?? ''),
      escapeCsvCell(classroomLabel),
      escapeCsvCell(classroomId || ''),
      escapeCsvCell(description),
      escapeCsvCell(items)
    ].join(',');
  });

  const csv = [header.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenameBase}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportOrdersToJSON(orders = [], filenameBase = 'orders') {
  const data = (orders || []).map(o => {
    // CHANGED: prefer populated classroom from items, then populated order.classroom, then metadata
    const displayItems = (o.items && o.items.length > 0) ? o.items : (o.metadata?.itemDetails || []);

    const itemCls = o.items?.[0]?.bazaar?.classroom;
    const orderCls = o.classroom;
    const classroomObj =
      (itemCls && typeof itemCls === 'object' && itemCls.name ? itemCls :
        (orderCls && typeof orderCls === 'object' && orderCls.name ? orderCls : null));

    const classroom = classroomObj
      ? { _id: classroomObj._id, name: classroomObj.name, code: classroomObj.code }
      : (o.metadata?.classroomName
          ? { name: o.metadata.classroomName, code: o.metadata.classroomCode || null }
          : null);

    // NEW: explicit classroomId field (only when available)
    const classroomId =
      classroomObj?._id ||
      (typeof orderCls === 'string' ? orderCls : null);

    return {
      _id: o._id,
      type: o.type || 'purchase',
      createdAt: o.createdAt,
      total: o.total,
      description: o.description,
      classroom,          // existing structured classroom info
      classroomId,        // ADDED explicit id
      items: displayItems.map(i => ({
        _id: i?._id,
        name: i?.name,
        category: i?.category,
        price: i?.price
      })),
      metadata: o.metadata || null
    };
  });

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