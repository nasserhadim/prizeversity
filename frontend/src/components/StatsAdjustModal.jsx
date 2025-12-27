import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../config/api';
const BACKEND_URL = `${API_BASE}`;

const StatsAdjustModal = ({ isOpen, onClose, student, classroomId, onUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [multiplier, setMultiplier] = useState('1.0');
  const [luck, setLuck] = useState('1.0');
  const [discount, setDiscount] = useState('0');

  // NEW: XP state
  const [xp, setXP] = useState('');
  const [xpEnabled, setXPEnabled] = useState(true);
  const [xpLoading, setXPLoading] = useState(false);

  // NEW: only send xp if teacher actually modified it
  const [xpInitial, setXPInitial] = useState(null);
  const [xpDirty, setXPDirty] = useState(false);

  // NEW: Shield state (numeric count)
  const [shield, setShield] = useState('0');

  // NEW: optional note/reason for audit trail
  const [note, setNote] = useState('');

  // NEW: whether this adjustment should also award "statIncrease" XP
  const [awardStatBoostXP, setAwardStatBoostXP] = useState(true);

  // NEW: baseline values for delta display
  const [baseline, setBaseline] = useState({
    multiplier: 1.0,
    luck: 1.0,
    discount: 0,
    shield: 0
  });

  const safeNum = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const safeInt = (v, fallback = 0) => {
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) ? n : fallback;
  };

  const renderDelta = (delta, { decimals = 0, suffix = '' } = {}) => {
    const d = Number(delta);
    if (!Number.isFinite(d) || d === 0) {
      return <div className="text-xs text-base-content/50 mt-1">Change: —</div>;
    }
    const formatted =
      decimals > 0
        ? d.toFixed(decimals)
        : String(Math.trunc(d));

    const sign = d > 0 ? '+' : '';
    const cls = d > 0 ? 'text-success' : 'text-error';
    return (
      <div className={`text-xs mt-1 ${cls}`}>
        Change: {sign}{formatted}{suffix}
      </div>
    );
  };

  // load current stats when modal opens / student changes
  useEffect(() => {
    if (!isOpen || !student) return;
    let mounted = true;
    (async () => {
      try {
        const res = await axios.get(`/api/stats/student/${student._id}?classroomId=${classroomId}`, { withCredentials: true });
        if (!mounted) return;
        const s = res.data || {};

        const m0 = safeNum(s.multiplier ?? 1, 1);
        const l0 = safeNum(s.luck ?? 1, 1);
        const d0 = safeInt(s.discount ?? s.discountShop ?? 0, 0);
        const sh0 = safeInt(s.shieldCount ?? 0, 0);

        // baseline snapshot for delta indicators
        setBaseline({ multiplier: m0, luck: l0, discount: d0, shield: sh0 });

        // current inputs
        setMultiplier(m0.toFixed(1));
        setLuck(l0.toFixed(1));
        setDiscount(String(d0));
        setShield(String(sh0));
      } catch (err) {
        console.debug('[StatsAdjustModal] failed to load stats', err?.message || err);
      }

      // Fetch XP and XP settings (teacher-only endpoint)
      if (classroomId) {
        setXPLoading(true);
        try {
          const xpRes = await axios.get(`/api/xp/classroom/${classroomId}/user/${student._id}`, { withCredentials: true });
          if (!mounted) return;
          setXP(String(xpRes.data.xp ?? 0));
          setXPInitial(Number(xpRes.data.xp ?? 0));
        } catch (e) {
          console.debug('[StatsAdjustModal] failed to fetch xp', e?.message || e);
          setXP('0');
          setXPInitial(0);
        } finally {
          try {
            const sres = await axios.get(`/api/xp/classroom/${classroomId}/settings`, { withCredentials: true });
            if (!mounted) return;
            setXPEnabled(Boolean(sres.data?.enabled ?? true));
          } catch (_e) {
            setXPEnabled(true);
          }
          setXPLoading(false);
        }
      }
    })();
    return () => { mounted = false; };
  }, [isOpen, student, classroomId]);

  useEffect(() => {
    setNote('');
    setAwardStatBoostXP(true);
  }, [isOpen, student?._id]);

  useEffect(() => {
    if (!isOpen) return;
    setXPDirty(false);
  }, [isOpen, student?._id]);

  if (!isOpen || !student) return null;

  const fullName = `${(student.firstName || '').trim()} ${(student.lastName || '').trim()}`.trim() || student.email;

  const handleSave = async () => {
    setLoading(true);
    try {
      const xpNum = Number(xp || 0);
      const includeXP = xpEnabled && !xpLoading && xpDirty && Number.isFinite(xpNum);

      const res = await axios.patch(
        `/api/classroom/${classroomId}/users/${student._id}/stats`,
        {
          multiplier: Number(multiplier) || 1,
          luck: Number(luck) || 1,
          discount: Number(discount) || 0,
          shield: Number(shield || 0),
          note: (note || '').trim() || undefined,
          awardStatBoostXP: Boolean(awardStatBoostXP),
          ...(includeXP ? { xp: xpNum } : {})
        },
        { withCredentials: true }
      );

      const noChange =
        !!res.data?.noChange ||
        (Array.isArray(res.data?.changes) && res.data.changes.length === 0);

      if (noChange) {
        toast('No stats were adjusted');
        return;
      }

      toast.success('Stats updated');
      if (onUpdated) onUpdated();
      onClose && onClose();
    } catch (err) {
      console.error('[StatsAdjustModal] save error', err);
      toast.error(err.response?.data?.error || 'Failed to update stats');
    } finally {
      setLoading(false);
    }
  };

  // computed deltas for display
  const deltaMultiplier = safeNum(multiplier, baseline.multiplier) - baseline.multiplier;
  const deltaLuck = safeNum(luck, baseline.luck) - baseline.luck;
  const deltaDiscount = safeInt(discount, baseline.discount) - baseline.discount;
  const deltaShield = safeInt(shield, baseline.shield) - baseline.shield;
  const deltaXP = (xpInitial == null) ? 0 : (safeInt(xp, safeInt(xpInitial, 0)) - safeInt(xpInitial, 0));

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-sm">
        <h3 className="font-bold text-lg">Adjust stats — {fullName}</h3>

        <div className="mt-4 space-y-3">
          <label className="flex flex-col">
            <span className="text-sm">Multiplier (e.g. 1.0)</span>
            <input
              type="number"
              step="0.1"
              min="0.1"
              className="input input-bordered mt-2"
              value={multiplier}
              onChange={(e) => setMultiplier(e.target.value)}
            />
            {renderDelta(deltaMultiplier, { decimals: 1 })}
          </label>

          <label className="flex flex-col">
            <span className="text-sm">Luck (e.g. 1.0)</span>
            <input
              type="number"
              step="0.1"
              min="1.0"
              className="input input-bordered mt-2"
              value={luck}
              onChange={(e) => setLuck(e.target.value)}
            />
            {renderDelta(deltaLuck, { decimals: 1 })}
          </label>

          <label className="flex flex-col">
            <span className="text-sm">Discount % (0 to clear)</span>
            <input
              type="number"
              step="1"
              min="0"
              max="100"
              className="input input-bordered mt-2"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
            {renderDelta(deltaDiscount, { decimals: 0, suffix: '%' })}
          </label>

          <label className="flex flex-col">
            <span className="text-sm">Shield Count (0 to clear)</span>
            <input
              type="number"
              step="1"
              min="0"
              className="input input-bordered mt-2"
              value={shield}
              onChange={(e) => setShield(e.target.value)}
            />
            {renderDelta(deltaShield, { decimals: 0 })}
          </label>

          <label className="flex flex-col">
            <span className="text-sm">Manual XP (absolute total)</span>
            <input
              type="number"
              step="1"
              min="0"
              className="input input-bordered mt-2"
              value={xp}
              onChange={(e) => {
                setXP(e.target.value);
                setXPDirty(true);
              }}
              disabled={!xpEnabled || xpLoading}
            />
            {xpEnabled ? renderDelta(deltaXP, { decimals: 0, suffix: ' XP' }) : null}
            {!xpEnabled && (
              <span className="text-xs text-gray-500 mt-1">
                XP is disabled for this classroom. Enable XP in People → XP & Leveling Settings to adjust.
              </span>
            )}
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              className="checkbox checkbox-primary"
              checked={awardStatBoostXP}
              onChange={(e) => setAwardStatBoostXP(e.target.checked)}
              disabled={!xpEnabled || xpLoading}
            />
            <span className="text-sm">Count stat increases toward “Stat Increase” XP</span>
          </label>
          <div className="text-xs text-base-content/60 -mt-2">
            Uses the classroom’s <strong>Stat Increase</strong> rate from XP settings.
          </div>

          <label className="flex flex-col">
            <span className="text-sm">Reason / note (optional)</span>
            <textarea
              className="textarea textarea-bordered mt-2"
              rows={3}
              maxLength={500}
              placeholder="e.g. Bonus for leadership in project week"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <span className="text-xs text-base-content/60 mt-1">
              Included in the student’s stat-change notification/log.
            </span>
          </label>
        </div>

        <div className="modal-action">
          <button className="btn" onClick={() => { onClose && onClose(); }}>
            Cancel
          </button>
          <button className={`btn btn-primary ${loading ? 'loading' : ''}`} onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatsAdjustModal;