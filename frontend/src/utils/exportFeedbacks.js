/**
 * exportFeedbacksToCSV(feedbacks, filenameBase)
 * - feedbacks: array of feedback objects
 * - filenameBase: string base for filename (no extension)
 *
 * Returns the generated filename (string).
 */
export function exportFeedbacksToCSV(feedbacks = [], filenameBase = 'feedbacks') {
  function escapeCsvCell(value) {
    if (value === null || value === undefined) return '';
    const s = String(value);
    return `"${s.replace(/"/g, '""')}"`;
  }

  const header = ['id', 'rating', 'comment', 'anonymous', 'hidden', 'createdAt', 'userId', 'userName', 'userEmail', 'classroomId'];
  const rows = (feedbacks || []).map(f => {
    const userId = f.userId && (typeof f.userId === 'object' ? f.userId._id : f.userId) || '';
    const userName = f.userId && (typeof f.userId === 'object' ? `${f.userId.firstName || ''} ${f.userId.lastName || ''}`.trim() : '') || '';
    const userEmail = f.userId && (typeof f.userId === 'object' ? f.userId.email : '') || '';
    return [
      escapeCsvCell(f._id || ''),
      escapeCsvCell(f.rating ?? ''),
      escapeCsvCell(f.comment ?? ''),
      escapeCsvCell(f.anonymous ? 'true' : 'false'),
      escapeCsvCell(f.hidden ? 'true' : 'false'),
      escapeCsvCell(new Date(f.createdAt || '').toISOString() || ''),
      escapeCsvCell(userId),
      escapeCsvCell(userName),
      escapeCsvCell(userEmail),
      escapeCsvCell(f.classroom || '')
    ].join(',');
  });

  const csv = [header.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${filenameBase}_${ts}.csv`;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return filename;
}

export function exportFeedbacksToJSON(feedbacks = [], filenameBase = 'feedbacks') {
  const data = (feedbacks || []).map(f => ({
    _id: f._id,
    rating: f.rating,
    comment: f.comment,
    anonymous: !!f.anonymous,
    hidden: !!f.hidden,
    createdAt: f.createdAt,
    user: (f.userId && typeof f.userId === 'object') ? {
      _id: f.userId._id,
      firstName: f.userId.firstName,
      lastName: f.userId.lastName,
      email: f.userId.email
    } : (f.userId || null),
    classroom: f.classroom || null
  }));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${filenameBase}_${ts}.json`;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return filename;
}

export default { exportFeedbacksToCSV };