import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const BulkBalanceEditor = () => {
  const { id: classroomId } = useParams();
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [selectedIds, setSelected] = useState(new Set());
  const [step, setStep] = useState('select'); 
  const [amount, setAmount] = useState('');
  const [taBitPolicy, setTaBitPolicy] = useState('full');
  const [search, setSearch] = useState('');
  const userIsTeacher = (user?.role || '').toLowerCase() === 'teacher';
  const userIsTA = (user?.role || '').toLowerCase() === 'admin';
  const taMayAssign = userIsTeacher || (userIsTA && taBitPolicy === 'full');
  
  const fullName = (u) =>
  (u.firstName || u.lastName)
    ? `${u.firstName || ''} ${u.lastName || ''}`.trim()
    : u.email;

  const visibleStudents = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter(s =>
      fullName(s).toLowerCase().includes(q) ||
  (s.email || '').toLowerCase().includes(q)
    );
  }, [students, search]);

  useEffect(() => {
    const url = classroomId
      ? `/api/classroom/${classroomId}/students`
      : `/api/users/students`;

    axios
      .get(url, { withCredentials: true })
      .then(r => setStudents(r.data))
      .catch(() => setStudents([]));

      
    if (classroomId) {
      axios
        .get(`/api/classroom/${classroomId}/ta-bit-policy`, {
          withCredentials: true,
        })
        .then((r) => setTaBitPolicy(r.data.taBitPolicy))
        .catch(() => setTaBitPolicy('full')); 
    }
  }, [classroomId]);

 
  const toggle = id =>
    setSelected(p => {
      const s = new Set(p);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  const next  = () => {if (!taMayAssign) return;if (selectedIds.size) setStep('amount');else alert('Select at least one student');};
  const back  = () => { setAmount(''); setStep('select'); };

  const apply = async () => {
    const num = Number(amount);
    if (isNaN(num) || num === 0) {
      alert('Enter a non-zero number');
      return;
    }

    const updates = Array.from(selectedIds).map(id => ({ studentId: id, amount: num }));

    try {
      // Add classroomId to the request payload
      await axios.post('/api/wallet/assign/bulk', { 
        updates,
        description: "Balance adjustment", 
        classroomId: classroomId 
      }, { 
        withCredentials: true 
      });

      alert('Balances updated');
      const url = classroomId
        ? `/api/classroom/${classroomId}/students`
        : `/api/users/students`;
      const r = await axios.get(url, { withCredentials: true });
      setStudents(r.data);
      setSelected(new Set());
      setAmount('');
      setStep('select');
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 
          err.response?.data?.message || 
          'Bulk update failed. Please check console for details.');
    }
  };

 
  return (
    <div className="mt-10">

      {!taMayAssign && (
  <div className="alert alert-info mb-4">
    You don’t have permission to assign bits in this classroom.
  </div>
)}


      <h2 className="font-bold text-lg mb-2">Bulk Adjust Student Balances</h2>

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
            {visibleStudents.map(s => (
              <div key={s._id} className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={selectedIds.has(s._id)}
                  onChange={() => toggle(s._id)}
                />
                <span className="flex-1 truncate">{fullName(s)}</span>
                <span className="w-16 text-right">{s.balance} B</span>
              </div>
            ))}
            {visibleStudents.length === 0 && <p className="text-gray-500">No matching students.</p>}
          </div>

          +<button
  className={`btn w-full ${taMayAssign ? 'btn-primary' : 'btn-disabled'}`}
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
