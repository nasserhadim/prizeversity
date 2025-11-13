/**
 * Helpers to export orders to CSV or JSON.
 */
export function getClassroomLabel(order) {
  if (!order) return '—';
  
  // Try multiple paths to find classroom info
  const c = order.classroom || 
            order.metadata?.classroomName || // From mystery box metadata
            order.items?.[0]?.bazaar?.classroom;
  
  if (!c) return '—';
  
  // Handle both populated and metadata classroom info
  if (typeof c === 'string') {
    // If it's just a string (metadata classroomName)
    const code = order.metadata?.classroomCode;
    return code ? `${c} (${code})` : c;
  }
  
  // If it's a populated object
  return c.name ? `${c.name}${c.code ? ` (${c.code})` : ''}` : '—';
}

function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  // Escape quotes and wrap in quotes
  return `"${s.replace(/"/g, '""')}"`;
}

export function exportOrdersToCSV(orders = [], filenameBase = 'orders') {
  const header = ['orderId', 'type', 'date', 'total', 'classroom', 'description', 'items'];
  const rows = (orders || []).map(o => {
    // CHANGED: Use metadata.itemDetails if items are deleted
    const displayItems = (o.items && o.items.length > 0) 
      ? o.items 
      : (o.metadata?.itemDetails || []);
    
    const items = displayItems.map(i => i?.name || i?._id || '').join('|');
    const orderType = o.type || 'purchase';
    const description = o.description || '';
    
    return [
      escapeCsvCell(o._id || ''),
      escapeCsvCell(orderType),
      escapeCsvCell(new Date(o.createdAt || '').toLocaleString() || ''),
      escapeCsvCell(o.total ?? ''),
      escapeCsvCell(getClassroomLabel(o)),
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
    // CHANGED: Use metadata.itemDetails if items are deleted
    const displayItems = (o.items && o.items.length > 0) 
      ? o.items 
      : (o.metadata?.itemDetails || []);
    
    return {
      _id: o._id,
      type: o.type || 'purchase',
      createdAt: o.createdAt,
      total: o.total,
      description: o.description,
      classroom: (() => {
        const label = getClassroomLabel(o);
        if (label === '—') return null;
        
        // Try to extract structured data
        const c = o.classroom || o.items?.[0]?.bazaar?.classroom;
        if (c && typeof c === 'object') {
          return { _id: c._id, name: c.name, code: c.code };
        }
        
        // Fallback to metadata
        if (o.metadata?.classroomName) {
          return {
            name: o.metadata.classroomName,
            code: o.metadata.classroomCode || null
          };
        }
        
        return label;
      })(),
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