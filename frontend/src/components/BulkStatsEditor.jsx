import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const BulkStatsEditor = ({ onSuccess }) => {
  const { id: classroomId } = useParams();
  const { user } = useAuth();
  
  const [students, setStudents] = useState([]);
  const [selectedIds, setSelected] = useState(new Set());
  const [step, setStep] = useState('select'); // 'select' | 'adjust'
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all'); // 'all' | 'inGroup' | 'solo'
  
  // Stats adjustment values (delta mode - add/subtract from current)
  const [multiplierDelta, setMultiplierDelta] = useState('');
  const [luckDelta, setLuckDelta] = useState('');
  const [discountDelta, setDiscountDelta] = useState('');
  const [shieldDelta, setShieldDelta] = useState('');
  const [xpDelta, setXPDelta] = useState('');
  
  // XP settings
  const [xpEnabled, setXPEnabled] = useState(true);
  const [awardStatBoostXP, setAwardStatBoostXP] = useState(true);
  
  // Note/reason
  const [note, setNote] = useState('');
  
  // Policy check
  const [taStatsPolicy, setTaStatsPolicy] = useState('none');
  const [loading, setLoading] = useState(false);
  
  // Group membership for filtering
  const [groupMembership, setGroupMembership] = useState(new Set());

  const fullName = (s) =>
    `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.email || 'Unknown';

  // Filter to only show students (exclude teachers and admin-only accounts)
  const studentList = useMemo(() => {
    return students.filter(s => {
      // Include if role is 'student' OR if they don't have a role specified (default to student)
      const role = (s.role || '').toLowerCase();
      return role === 'student' || role === '';
    });
  }, [students]);

  // Filter students based on search and group filter
  const filteredStudents = useMemo(() => {
    const q = (search || '').toLowerCase().trim();
    let base = !q
      ? studentList
      : studentList.filter(s =>
          fullName(s).toLowerCase().includes(q) ||
          (s.email || '').toLowerCase().includes(q)
        );

    if (groupFilter === 'inGroup') {
      return base.filter(s => groupMembership.has(String(s._id)));
    }
    if (groupFilter === 'solo') {
      return base.filter(s => !groupMembership.has(String(s._id)));
    }
    return base;
  }, [studentList, search, groupFilter, groupMembership]);

  // Check if user can adjust stats
  const canAdjustStats = useMemo(() => {
    if (!user) return false;
    if (user.role === 'teacher') return true;
    // Admin/TA needs policy permission
    return taStatsPolicy === 'full';
  }, [user, taStatsPolicy]);

  // Fetch students and policies
  useEffect(() => {
    if (!classroomId) return;

    // Fetch students
    axios
      .get(`/api/classroom/${classroomId}/students`, { withCredentials: true })
      .then(r => setStudents(r.data || []))
      .catch(() => setStudents([]));

    // Fetch TA stats policy
    axios
      .get(`/api/classroom/${classroomId}/ta-stats-policy`, { withCredentials: true })
      .then(r => setTaStatsPolicy(r.data.taStatsPolicy || 'none'))
      .catch(() => setTaStatsPolicy('none'));

    // Fetch XP settings
    axios
      .get(`/api/xp/classroom/${classroomId}/settings`, { withCredentials: true })
      .then(r => setXPEnabled(r.data?.enabled !== false))
      .catch(() => setXPEnabled(true));

    // Fetch group membership - FIXED: use correct endpoint
    axios
      .get(`/api/group/groupset/classroom/${classroomId}`, { withCredentials: true })
      .then(r => {
        const memberIds = new Set();
        (r.data || []).forEach(gs => {
          (gs.groups || []).forEach(g => {
            (g.members || []).forEach(m => {
              // Skip if not approved
              if (m.status && m.status !== 'approved') return;
              
              let memberId = null;
              
              if (typeof m === 'string') {
                memberId = m;
              } else if (m && m._id) {
                // m._id could be the user ID directly or a populated user object
                if (typeof m._id === 'string') {
                  memberId = m._id;
                } else if (m._id && m._id._id) {
                  // Populated: m._id is the user object, m._id._id is the actual ID
                  memberId = String(m._id._id);
                } else if (typeof m._id === 'object' && m._id) {
                  // ObjectId - convert to string
                  memberId = String(m._id);
                }
              }
              
              if (memberId) {
                memberIds.add(String(memberId));
              }
            });
          });
        });
        console.log('[BulkStatsEditor] Group membership IDs:', Array.from(memberIds));
        console.log('[BulkStatsEditor] Students:', students.map(s => ({ id: s._id, name: fullName(s) })));
        setGroupMembership(memberIds);
      })
      .catch((err) => {
        console.error('[BulkStatsEditor] Failed to fetch group sets:', err);
        setGroupMembership(new Set());
      });
  }, [classroomId]);

  const selectedStudents = useMemo(
    () => studentList.filter(s => selectedIds.has(s._id)),
    [studentList, selectedIds]
  );

  const toggleStudent = (id) =>
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  const selectAll = () => {
    const ids = filteredStudents.map(s => s._id);
    setSelected(new Set(ids));
  };

  const clearSelection = () => setSelected(new Set());

  const next = () => {
    if (!canAdjustStats) return;
    if (selectedIds.size === 0) {
      toast.error('Select at least one student');
      return;
    }
    setStep('adjust');
  };

  const back = () => {
    setMultiplierDelta('');
    setLuckDelta('');
    setDiscountDelta('');
    setShieldDelta('');
    setXPDelta('');
    setNote('');
    setStep('select');
  };

  const hasAnyChange = () => {
    return (
      (multiplierDelta && Number(multiplierDelta) !== 0) ||
      (luckDelta && Number(luckDelta) !== 0) ||
      (discountDelta && Number(discountDelta) !== 0) ||
      (shieldDelta && Number(shieldDelta) !== 0) ||
      (xpEnabled && xpDelta && Number(xpDelta) !== 0)
    );
  };

  const apply = async () => {
    if (!hasAnyChange()) {
      toast.error('Enter at least one stat change');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(
        `/api/classroom/${classroomId}/stats/bulk`,
        {
          studentIds: Array.from(selectedIds),
          deltas: {
            multiplier: Number(multiplierDelta) || 0,
            luck: Number(luckDelta) || 0,
            discount: Number(discountDelta) || 0,
            shield: Number(shieldDelta) || 0,
            xp: xpEnabled ? (Number(xpDelta) || 0) : 0,
          },
          note: (note || '').trim() || undefined,
          awardStatBoostXP,
        },
        { withCredentials: true }
      );

      const { updated, skipped } = res.data;
      toast.success(`Stats updated for ${updated} student(s)${skipped?.length ? `, ${skipped.length} skipped` : ''}`);

      if (onSuccess) await onSuccess();

      // Reset form
      setSelected(new Set());
      setMultiplierDelta('');
      setLuckDelta('');
      setDiscountDelta('');
      setShieldDelta('');
      setXPDelta('');
      setNote('');
      setStep('select');

      // Refresh students
      const r = await axios.get(`/api/classroom/${classroomId}/students`, { withCredentials: true });
      setStudents(r.data || []);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Bulk stats update failed');
    } finally {
      setLoading(false);
    }
  };

  const renderDelta = (value, { decimals = 1, suffix = '' } = {}) => {
    const d = Number(value) || 0;
    if (d === 0) return null;
    const formatted = decimals > 0 ? d.toFixed(decimals) : String(Math.trunc(d));
    const sign = d > 0 ? '+' : '';
    const cls = d > 0 ? 'text-success' : 'text-error';
    return (
      <span className={`text-xs ${cls}`}>
        ({sign}{formatted}{suffix})
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {!canAdjustStats && (
        <div className="alert alert-info">
          You don't have permission to adjust stats in this classroom.
        </div>
      )}

      {step === 'select' && (
        <>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="text"
              placeholder="Search students..."
              className="input input-bordered flex-1 min-w-[200px]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="select select-bordered"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
            >
              <option value="all">All Students</option>
              <option value="inGroup">In a Group</option>
              <option value="solo">Not in Group</option>
            </select>
          </div>

          <div className="flex gap-2 mb-2">
            <button className="btn btn-xs btn-outline" onClick={selectAll}>
              Select All ({filteredStudents.length})
            </button>
            <button className="btn btn-xs btn-outline" onClick={clearSelection}>
              Clear
            </button>
            <span className="text-sm text-base-content/70 ml-auto">
              {selectedIds.size} selected
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto border border-base-300 rounded p-2 space-y-1">
            {filteredStudents.length === 0 ? (
              <div className="text-sm text-base-content/60 text-center py-4">
                {groupFilter === 'inGroup' 
                  ? 'No students found in groups' 
                  : groupFilter === 'solo'
                    ? 'All students are in groups'
                    : 'No students found'}
              </div>
            ) : (
              filteredStudents.map((s) => (
                <label
                  key={s._id}
                  className="flex items-center gap-2 p-2 hover:bg-base-200 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={selectedIds.has(s._id)}
                    onChange={() => toggleStudent(s._id)}
                    disabled={!canAdjustStats}
                  />
                  <span className="flex-1">{fullName(s)}</span>
                  <span className="text-xs text-base-content/60">{s.email}</span>
                  {groupMembership.has(String(s._id)) && (
                    <span className="badge badge-sm badge-success">In Group</span>
                  )}
                </label>
              ))
            )}
          </div>

          <button
            className="btn btn-primary w-full"
            onClick={next}
            disabled={!canAdjustStats || selectedIds.size === 0}
          >
            Next: Set Stat Changes →
          </button>
        </>
      )}

      {step === 'adjust' && (
        <>
          <div className="text-sm text-base-content/70 mb-2">
            Adjusting stats for <strong>{selectedIds.size}</strong> student(s)
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Multiplier */}
            <label className="flex flex-col">
              <span className="text-sm font-medium mb-1">
                Multiplier Change {renderDelta(multiplierDelta)}
              </span>
              <input
                type="number"
                step="0.1"
                className="input input-bordered"
                placeholder="e.g. +0.5 or -0.2"
                value={multiplierDelta}
                onChange={(e) => setMultiplierDelta(e.target.value)}
              />
              <span className="text-xs text-base-content/60 mt-1">
                Added to current multiplier
              </span>
            </label>

            {/* Luck */}
            <label className="flex flex-col">
              <span className="text-sm font-medium mb-1">
                Luck Change {renderDelta(luckDelta)}
              </span>
              <input
                type="number"
                step="0.1"
                className="input input-bordered"
                placeholder="e.g. +0.5 or -0.2"
                value={luckDelta}
                onChange={(e) => setLuckDelta(e.target.value)}
              />
              <span className="text-xs text-base-content/60 mt-1">
                Added to current luck
              </span>
            </label>

            {/* Discount */}
            <label className="flex flex-col">
              <span className="text-sm font-medium mb-1">
                Discount Change {renderDelta(discountDelta, { decimals: 0, suffix: '%' })}
              </span>
              <input
                type="number"
                step="1"
                className="input input-bordered"
                placeholder="e.g. +10 or -5"
                value={discountDelta}
                onChange={(e) => setDiscountDelta(e.target.value)}
              />
              <span className="text-xs text-base-content/60 mt-1">
                Added to current discount %
              </span>
            </label>

            {/* Shield */}
            <label className="flex flex-col">
              <span className="text-sm font-medium mb-1">
                Shield Change {renderDelta(shieldDelta, { decimals: 0 })}
              </span>
              <input
                type="number"
                step="1"
                className="input input-bordered"
                placeholder="e.g. +2 or -1"
                value={shieldDelta}
                onChange={(e) => setShieldDelta(e.target.value)}
              />
              <span className="text-xs text-base-content/60 mt-1">
                Added to current shield count
              </span>
            </label>

            {/* XP */}
            <label className="flex flex-col">
              <span className="text-sm font-medium mb-1">
                XP Change {renderDelta(xpDelta, { decimals: 0, suffix: ' XP' })}
              </span>
              <input
                type="number"
                step="1"
                className="input input-bordered"
                placeholder="e.g. +100 or -50"
                value={xpDelta}
                onChange={(e) => setXPDelta(e.target.value)}
                disabled={!xpEnabled}
              />
              {!xpEnabled && (
                <span className="text-xs text-warning mt-1">
                  XP is disabled for this classroom
                </span>
              )}
            </label>
          </div>

          {/* Options */}
          <div className="space-y-2 mt-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                className="checkbox checkbox-primary checkbox-sm"
                checked={awardStatBoostXP}
                onChange={(e) => setAwardStatBoostXP(e.target.checked)}
                disabled={!xpEnabled}
              />
              <span className="text-sm">Count stat increases toward "Stat Increase" XP</span>
            </label>
          </div>

          {/* Note */}
          <label className="flex flex-col mt-4">
            <span className="text-sm font-medium mb-1">Reason / Note (optional)</span>
            <textarea
              className="textarea textarea-bordered"
              rows={2}
              maxLength={500}
              placeholder="e.g. Bonus for project completion"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>

          {/* Preview */}
          <div className="bg-base-200 rounded p-3 mt-4">
            <div className="text-sm font-medium mb-2">Preview Changes:</div>
            <div className="text-xs space-y-1">
              {Number(multiplierDelta) !== 0 && (
                <div>Multiplier: {Number(multiplierDelta) > 0 ? '+' : ''}{Number(multiplierDelta).toFixed(1)}</div>
              )}
              {Number(luckDelta) !== 0 && (
                <div>Luck: {Number(luckDelta) > 0 ? '+' : ''}{Number(luckDelta).toFixed(1)}</div>
              )}
              {Number(discountDelta) !== 0 && (
                <div>Discount: {Number(discountDelta) > 0 ? '+' : ''}{Math.round(Number(discountDelta))}%</div>
              )}
              {Number(shieldDelta) !== 0 && (
                <div>Shield: {Number(shieldDelta) > 0 ? '+' : ''}{Math.round(Number(shieldDelta))}</div>
              )}
              {xpEnabled && Number(xpDelta) !== 0 && (
                <div>XP: {Number(xpDelta) > 0 ? '+' : ''}{Math.round(Number(xpDelta))} XP</div>
              )}
              {!hasAnyChange() && (
                <div className="text-base-content/60 italic">No changes specified</div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-4">
            <button className="btn btn-ghost flex-1" onClick={back} disabled={loading}>
              ← Back
            </button>
            <button
              className="btn btn-primary flex-1"
              onClick={apply}
              disabled={loading || !hasAnyChange()}
            >
              {loading ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                `Apply to ${selectedIds.size} Student(s)`
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default BulkStatsEditor;