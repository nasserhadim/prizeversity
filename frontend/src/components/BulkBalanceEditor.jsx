import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const BulkBalanceEditor = ({onSuccess}) => {
  // Attributes that will be used for all the functions that will be created below
  const { id: classroomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [selectedIds, setSelected] = useState(new Set());
  const [step, setStep] = useState('select'); 
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [applyGroupMultipliers, setApplyGroupMultipliers] = useState(true); // Separate group multipliers
  const [applyPersonalMultipliers, setApplyPersonalMultipliers] = useState(true); // Separate personal multipliers
  const [taBitPolicy, setTaBitPolicy] = useState('full');
  const [search, setSearch] = useState('');

  // NEW: group membership tracking + filter
  const [groupMembership, setGroupMembership] = useState(new Set());
  const [groupFilter, setGroupFilter] = useState('all'); // 'all' | 'inGroup' | 'solo'

  // NEW: classroom meta (to detect banned students / banLog)
  const [classroom, setClassroom] = useState(null);

  // NEW: track siphoned user IDs from groupSets data
  const [siphonedUserIds, setSiphonedUserIds] = useState(new Set());

  useEffect(() => {
    if (!classroomId) return;
    let mounted = true;
    (async () => {
      try {
        const res = await axios.get(`/api/classroom/${classroomId}`, { withCredentials: true });
        if (!mounted) return;
        setClassroom(res.data);
      } catch (err) {
        console.error('Failed to load classroom meta for badges', err);
        setClassroom(null);
      }
    })();
    return () => { mounted = false; };
  }, [classroomId]);

  // helper: detect banned per-classroom (handles older shapes)
  const isBannedInClassroom = (student) => {
    if (!classroom) return false;
    const bannedStudents = Array.isArray(classroom?.bannedStudents) ? classroom.bannedStudents : [];
    const bannedIds = bannedStudents.map(b => (b && b._id) ? String(b._id) : String(b));
    if (bannedIds.includes(String(student._id))) return true;

    const banLog = Array.isArray(classroom?.banLog) && classroom.banLog.length
      ? classroom.banLog
      : (Array.isArray(classroom?.bannedRecords) ? classroom.bannedRecords : []);
    const banRecord = (banLog || []).find(br => String(br.user?._id || br.user) === String(student._id));
    return Boolean(banRecord);
  };

  // helper: detect siphoned/frozen for this classroom (uses groupSets data)
  const isSiphonedInClassroom = (student) => {
    if (!student) return false;
    return siphonedUserIds.has(String(student._id));
  };

  const userIsTeacher = (user?.role || '').toLowerCase() === 'teacher';
  // Classroom-scoped Admin/TA: derive from annotated student list
  const userIsTAInClass = useMemo(() => {
    if (!user || !Array.isArray(students)) return false;
    const me = students.find(s => String(s._id) === String(user._id));
    return Boolean(me && me.isClassroomAdmin);
  }, [user?._id, students]);
  const taMayAssign = userIsTeacher || (userIsTAInClass && taBitPolicy === 'full');
  
  const fullName = (u) =>
  (u.firstName || u.lastName)
    ? `${u.firstName || ''} ${u.lastName || ''}`.trim() // combining first and last name
    : u.email; // Fallback to emali if there is no names

  const visibleStudents = useMemo(() => {
    // apply search first (same behaviour as before)
    const qRaw = (search || '').trim();
    const q = qRaw.toLowerCase();
    const base = q === ''
      ? students.slice()
      : students.filter(s =>
          fullName(s).toLowerCase().includes(q) ||
          (s.email || '').toLowerCase().includes(q)
        );

    // apply group filter
    if (groupFilter === 'inGroup') {
      return base.filter(s => groupMembership.has(String(s._id)));
    }
    if (groupFilter === 'solo') {
      return base.filter(s => !groupMembership.has(String(s._id)));
    }
    return base;
  }, [students, search, groupFilter, groupMembership]);

  useEffect(() => {
    const url = classroomId
      ? `/api/classroom/${classroomId}/students`
      : `/api/users/students`;
    axios
      .get(url, { withCredentials: true })
      .then(r => setStudents(r.data)) // Now includes per-classroom balance
      .catch(() => setStudents([]));

      
    if (classroomId) {
      axios
        .get(`/api/classroom/${classroomId}/ta-bit-policy`, {
          withCredentials: true,
        })
        .then((r) => setTaBitPolicy(r.data.taBitPolicy)) // Will set the Admin/TA policy
        .catch(() => setTaBitPolicy('full')); // The default will be to full if the fetch fails

      // NEW: fetch groupSets for this classroom to determine who is in any group
      axios
        .get(`/api/group/groupset/classroom/${classroomId}`, { withCredentials: true })
        .then(res => {
          const ids = new Set();
          const siphonedIds = new Set(); // NEW: track siphoned users
          (res.data || []).forEach(gs => {
            (gs.groups || []).forEach(g => {
              (g.members || []).forEach(m => {
                const mid = m && (m._id? (m._id._id || m._id) : m);
                if (mid) ids.add(String(mid));
                
                // NEW: check if member is frozen in this classroom
                const memberData = m._id && typeof m._id === 'object' ? m._id : null;
                if (memberData?.classroomFrozen?.some(cf => String(cf.classroom) === String(classroomId))) {
                  siphonedIds.add(String(mid));
                }
              });
            });
          });
          setGroupMembership(ids);
          setSiphonedUserIds(siphonedIds); // NEW
        })
        .catch(() => {
          setGroupMembership(new Set());
          setSiphonedUserIds(new Set()); // NEW
        });
    }
  }, [classroomId]);

 
  const toggle = id =>
    setSelected(p => {
      const s = new Set(p); // Clone current set
      s.has(id) ? s.delete(id) : s.add(id); // Toggle selection
      return s;
    });

  const next  = () => {if (!taMayAssign) return;if (selectedIds.size) setStep('amount');else toast.error('Select at least one student');};
  const back  = () => { setAmount(''); setStep('select'); }; // Go back to selection

  const apply = async () => {
    const num = Number(amount);
    if (isNaN(num) || num === 0) {
      toast.error('Enter a non‑zero number');
      return;
    }

    const updates = Array.from(selectedIds).map(id => ({ studentId: id, amount: num }));

    try {
    // send the bulk-assign or queue request
    const res = await axios.post('/api/wallet/assign/bulk', {
      classroomId,                     
      updates,
      description,
      applyGroupMultipliers, // Add separate parameter
      applyPersonalMultipliers // Add separate parameter
    }, { withCredentials: true });

    // if Admin/TA policy = approval, server responds 202
    if (res.status === 202) {
      toast.success('Request submitted for teacher approval');
    } else {
      toast.success('Balances updated');
      if (onSuccess) {
        await onSuccess();
      }
    }

    // refresh the student list
    const url = classroomId
      ? `/api/classroom/${classroomId}/students`
      : `/api/users/students`;
    const r = await axios.get(url, { withCredentials: true });
    setStudents(r.data);
    setSelected(new Set());
    setAmount('');
    setDescription('');
    setStep('select');
  } catch (err) {
    console.error(err);
    toast.error(err.response?.data?.error || 'Bulk update failed');
  }
};

 
  return (
    <div className="mt-10">

      {!taMayAssign && (
  <div className="alert alert-info mb-4">
    You don’t have permission to assign bits in this classroom.
  </div>
)}


      <h2 className="font-bold text-lg mb-2">Adjust Balances</h2>

      {step === 'select' && (
        <>
         {/* search bar */}
          <input
            type="text"
            placeholder="Search by name or email…"
            className="input input-bordered w-full mb-3"
            value={search}
            onChange={e => setSearch(e.target.value)}
         />

         {/* NEW: group membership filter */}
         {classroomId && (
           <div className="mb-3">
             <select
               className="select select-bordered max-w-xs"
               value={groupFilter}
               onChange={(e) => setGroupFilter(e.target.value)}
             >
               <option value="all">All students</option>
               <option value="inGroup">In groups</option>
               <option value="solo">Solo (no groups)</option>
             </select>
           </div>
         )}
          <div className="h-72 overflow-y-auto border rounded p-2 mb-4">
  <div className="flex items-center gap-2 py-1 border-b mb-2">
    <input
      type="checkbox"
      className="checkbox checkbox-sm"
      checked={
        visibleStudents.length > 0 &&
        visibleStudents.every(s => selectedIds.has(s._id))
      }
      onChange={(e) => {
        const allSelected = visibleStudents.every(s => selectedIds.has(s._id));
        const newSet = new Set(selectedIds);
        if (allSelected) {
          visibleStudents.forEach(s => newSet.delete(s._id));
        } else {
          visibleStudents.forEach(s => newSet.add(s._id));
        }
        setSelected(newSet);
      }}
    />
    <span>Select All ({visibleStudents.length})</span>
  </div>

            {visibleStudents.map(s => (
              <div key={s._id} className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={selectedIds.has(s._id)}
                  onChange={() => toggle(s._id)}
                />
                <div>
                  <div className="font-medium">
                    {s.firstName || s.lastName ? `${s.firstName || ''} ${s.lastName || ''}`.trim() : s.email}
                    {isBannedInClassroom(s) && (
                      <span className="badge badge-error ml-2">BANNED</span>
                    )}
                    {isSiphonedInClassroom(s) && (
                      <span className="badge badge-warning ml-2">SIPHONED</span>
                    )}
                  </div>
                  <div className="text-sm">
                    <button
                      className="btn btn-ghost btn-xs mt-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        const path = classroomId
                          ? `/classroom/${classroomId}/profile/${s._id}`
                          : `/profile/${s._id}`;
                        // Mark origin as 'wallet' so Profile shows "Back to Wallet"
                        navigate(path, { state: { from: 'wallet', classroomId } });
                      }}
                    >
                      View Profile
                    </button>
                  </div>
                </div>
                <span className="ml-auto w-16 text-right">{s.balance} Ƀ</span>
              </div>
            ))}
            {visibleStudents.length === 0 && <p className="text-gray-500">No matching students.</p>}
          </div>

            <button
              className={`btn w-full ${taMayAssign ? 'btn-success' : 'btn-disabled'}`}
              onClick={next}
            >
            Next
          </button>
        </>
      )}

      {step === 'amount' && (
        <>
          <p className="mb-2">
            Updating&nbsp;
            <strong>{selectedIds.size}</strong>&nbsp;
            {selectedIds.size === 1 ? 'student' : 'students'}
          </p>
          <input
            type="text"
            inputMode="numeric"
            pattern="-?[0-9]*"
            className="input input-bordered w-full mb-4"
            placeholder="+ / –"
            value={amount}
            onChange={e => {
              const v = e.target.value;
              // allow optional leading +/-, digits only
              if (/^[+-]?\d*$/.test(v)) setAmount(v);
            }}
            onBlur={() => {
              if (!amount) return;
              const n = parseInt(amount.replace('+',''), 10);
              setAmount(Number.isNaN(n) ? '' : String(n));
            }}
          />
          <input
            type="text"
            className="input input-bordered w-full mb-4"
            placeholder="Optional: Description (e.g. 'Bonus for participation')"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
          
          {/* Updated multiplier toggles - separate controls */}
          <div className="space-y-3 mb-4">
            <div className="form-control">
              <label className="label cursor-pointer">
                <span className="label-text">Apply group multipliers</span>
                <input 
                  type="checkbox" 
                  className="toggle toggle-primary" 
                  checked={applyGroupMultipliers}
                  onChange={(e) => setApplyGroupMultipliers(e.target.checked)}
                  disabled={Number(amount) < 0}
                />
              </label>
              <div className="label">
                <span className="label-text-alt text-gray-500">
                  {Number(amount) < 0
                    ? "Disabled for debit adjustments"
                    : (applyGroupMultipliers 
                        ? "Group multipliers will be applied to positive amounts" 
                        : "Group multipliers will be ignored")
                  }
                </span>
              </div>
            </div>
            
            <div className="form-control">
              <label className="label cursor-pointer">
                <span className="label-text">Apply personal multipliers</span>
                <input 
                  type="checkbox" 
                  className="toggle toggle-primary" 
                  checked={applyPersonalMultipliers}
                  onChange={(e) => setApplyPersonalMultipliers(e.target.checked)}
                  disabled={Number(amount) < 0}
                />
              </label>
              <div className="label">
                <span className="label-text-alt text-gray-500">
                  {Number(amount) < 0
                    ? "Disabled for debit adjustments"
                    : (applyPersonalMultipliers 
                        ? "Personal multipliers will be applied to positive amounts" 
                        : "Personal multipliers will be ignored")
                  }
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button className="btn btn-outline flex-1" onClick={back}>Back</button>
            <button
              className={`btn flex-1 ${taMayAssign ? 'btn-warning' : 'btn-disabled'}`}
              onClick={apply}
            >
              Apply
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default BulkBalanceEditor;
