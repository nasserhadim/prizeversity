// Helper: infer the "assigner role" in a classroom-scoped way.
// This avoids relying on assignedBy.role, since classroom Admin/TAs keep global role 'student'.
export function inferAssignerRole(tx, studentList) {
  const desc = String(tx?.description || '').toLowerCase();

  // Prefer explicit description tags (most reliable across endpoints)
  if (desc.includes('adjustment by admin/ta') || desc.includes(' by admin/ta')) return 'admin';
  if (desc.includes('bulk adjustment by teacher') || desc.includes('manual adjustment by teacher') || desc.includes(' by teacher')) return 'teacher';

  // Next: populated assignedBy.role (works for real teachers/site-admins)
  const ab = tx?.assignedBy;
  if (ab && typeof ab === 'object' && ab.role) {
    const r = String(ab.role).toLowerCase();
    if (r === 'teacher' || r === 'admin' || r === 'student') return r;
  }

  // Next: classroom roster (works for classroom-scoped Admin/TA)
  const assignerId =
    (ab && typeof ab === 'object' ? (ab._id || ab.id) : ab) ||
    tx?.assignedById ||
    tx?.assignerId;

  if (assignerId && Array.isArray(studentList)) {
    const u = studentList.find(s => String(s._id) === String(assignerId));
    if (u) {
      if (String(u.role).toLowerCase() === 'teacher') return 'teacher';
      if (u.isClassroomAdmin) return 'admin';
      if (u.role) return String(u.role).toLowerCase();
    }
  }

  return 'student';
}