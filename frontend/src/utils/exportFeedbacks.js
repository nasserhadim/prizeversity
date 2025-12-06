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

  const hasClassroom = (feedbacks || []).some(f => f.classroom);
  const header = ['index','id','rating','comment','anonymous','hidden','createdAt','userId','userName','userEmail'];
  if (hasClassroom) header.push('classroomId','classroomName','classroomCode');

  const rows = (feedbacks || []).map((f, idx) => {
    const isAnon = !!f.anonymous;
    const userObj = f.userId && typeof f.userId === 'object' ? f.userId : null;
    const userId = isAnon ? '' : (userObj ? userObj._id : (f.userId || ''));
    const userName = isAnon ? '' : (userObj ? `${userObj.firstName || ''} ${userObj.lastName || ''}`.trim() : '');
    const userEmail = isAnon ? '' : (userObj ? userObj.email : '');
    const cells = [
      escapeCsvCell(idx + 1),
      escapeCsvCell(f._id || ''),
      escapeCsvCell(f.rating ?? ''),
      escapeCsvCell(f.comment ?? ''),
      escapeCsvCell(isAnon ? 'true' : 'false'),
      escapeCsvCell(f.hidden ? 'true' : 'false'),
      escapeCsvCell(new Date(f.createdAt || '').toISOString() || ''),
      escapeCsvCell(userId),
      escapeCsvCell(userName),
      escapeCsvCell(userEmail)
    ];
    if (hasClassroom) {
      const classroomName = f.classroom?.name || f.classroomName || '';
      const classroomCode = f.classroom?.code || f.classroomCode || '';
      cells.push(
        escapeCsvCell(f.classroom || ''),
        escapeCsvCell(classroomName),
        escapeCsvCell(classroomCode)
      );
    }
    return cells.join(',');
  });

  const csv = [header.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  a.download = `${filenameBase}_${ts}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return a.download;
}

export function exportFeedbacksToJSON(feedbacks = [], filenameBase = 'feedbacks') {
  const hasClassroom = (feedbacks || []).some(f => f.classroom);
  const data = (feedbacks || []).map((f, idx) => {
    const isAnon = !!f.anonymous;
    const userObj = f.userId && typeof f.userId === 'object' ? f.userId : null;
    const base = {
      index: idx + 1,
      id: f._id || null,
      rating: f.rating ?? null,
      comment: f.comment ?? '',
      anonymous: isAnon,
      hidden: !!f.hidden,
      createdAt: f.createdAt || null,
      userId: isAnon ? null : (userObj ? userObj._id : (f.userId || null)),
      userName: isAnon ? '' : (userObj ? `${userObj.firstName || ''} ${userObj.lastName || ''}`.trim() : ''),
      userEmail: isAnon ? '' : (userObj ? userObj.email : '')
    };
    if (hasClassroom) {
      base.classroomId = f.classroom || null;
      base.classroomName = f.classroom?.name || f.classroomName || null;
      base.classroomCode = f.classroom?.code || f.classroomCode || null;
    }
    return base;
  });

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  a.download = `${filenameBase}_${ts}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return a.download;
}

export default { exportFeedbacksToCSV };