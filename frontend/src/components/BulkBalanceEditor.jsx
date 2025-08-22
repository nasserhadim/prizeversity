import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const BulkBalanceEditor = ({onSuccess}) => {
  // Attributes that will be used for all the functions that will be created below
  const { id: classroomId } = useParams();
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [selectedIds, setSelected] = useState(new Set());
  const [step, setStep] = useState('select'); 
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [taBitPolicy, setTaBitPolicy] = useState('full');
  const [search, setSearch] = useState('');
  const userIsTeacher = (user?.role || '').toLowerCase() === 'teacher';
  const userIsTA = (user?.role || '').toLowerCase() === 'admin';
  const taMayAssign = userIsTeacher || (userIsTA && taBitPolicy === 'full');
  
  const fullName = (u) =>
  (u.firstName || u.lastName)
    ? `${u.firstName || ''} ${u.lastName || ''}`.trim() // combining first and last name
    : u.email; // Fallback to emali if there is no names

  const visibleStudents = useMemo(() => {
    if (!search.trim()) return students; // There is no filter applied
    const q = search.toLowerCase();
    return students.filter(s =>
      fullName(s).toLowerCase().includes(q) ||
  (s.email || '').toLowerCase().includes(q) // Filers by name or email
    );
  }, [students, search]);

  useEffect(() => {
    const url = classroomId
      ? `/api/classroom/${classroomId}/students` // Classroom-specific list
      : `/api/users/students`; // Global student list

    axios
      .get(url, { withCredentials: true })
      .then(r => setStudents(r.data)) // This will set the studnet list
      .catch(() => setStudents([]));

      
    if (classroomId) {
      axios
        .get(`/api/classroom/${classroomId}/ta-bit-policy`, {
          withCredentials: true,
        })
        .then((r) => setTaBitPolicy(r.data.taBitPolicy)) // Will set the Admin/TA policy
        .catch(() => setTaBitPolicy('full')); // The default will be to full if the fetch fails
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
      description
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
                <span className="flex-1 truncate">{fullName(s)}</span>
                <span className="w-16 text-right">{s.balance} Ƀ</span>
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
            type="number"
            className="input input-bordered w-full mb-4"
            placeholder="+ / –"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
          <input
            type="text"
            className="input input-bordered w-full mb-4"
            placeholder="Optional: Description (e.g. 'Bonus for participation')"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
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
