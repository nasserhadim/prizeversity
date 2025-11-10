// frontend/src/components/XPSettingsSection.jsx
import React from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function XPSettingsSection({ classroomId }) {
  const defaults = {
    isXPEnabled: true,
    xpFormulaType: "exponential",
    baseXPLevel2: 100,
    bitToXpCountMode: "final",
    xpRewards: {
      xpPerBitEarned: 1,
      xpPerBitSpent: 0.5,
      xpPerStatsBoost: 10,
      dailyCheckInXP: 5,
      dailyCheckInLimit: 1,
      groupJoinXP: 10,
      challengeXP: 25,
      mysteryBoxUseXP: 0,
    },
  };

  const [form, setForm] = React.useState(defaults);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  const getPath = (obj, path) => path.split(".").reduce((o, k) => o?.[k], obj);
  const setPath = (path, value) => {
    setForm((prev) => {
      const next = structuredClone(prev);
      const keys = path.split(".");
      let cur = next;
      for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
      cur[keys.at(-1)] = value;
      return next;
    });
  };
  const onField = (path) => (e) => {
    const v =
      e.target.type === "checkbox"
        ? e.target.checked
        : e.target.type === "number"
        ? Number(e.target.value)
        : e.target.value;
    setPath(path, v);
  };

  React.useEffect(() => {
    if (!classroomId) return;
    (async () => {
      try {
        const r = await axios.get(`/api/xpSettings/${classroomId}`);
        const data = r.status === 200 ? r.data : {};
        setForm({
          ...defaults,
          ...data,
          xpRewards: { ...defaults.xpRewards, ...(data.xpRewards || {}) },
        });
      } catch {
        setMsg("Failed to load XP settings.");
      }
    })();
  }, [classroomId]);

  const onSave = async () => {
    setSaving(true);
    setMsg("");
    try {
      const r = await axios.post(`/api/xpSettings/${classroomId}`, form);
      if (r.status === 200) {
        setMsg("Saved ✓");
        toast.success("XP settings saved");
      } else {
        setMsg("Save failed");
        toast.error("Save failed");
      }
    } catch (e) {
      setMsg("Save failed");
      toast.error(e?.response?.data?.error || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="xp-settings" className="card bg-base-100 shadow-md p-4 w-full mt-4">
      <h3 className="text-lg font-semibold mb-3">XP &amp; Leveling Settings</h3>

      <label className="flex items-center gap-2 mb-3">
        <input
          type="checkbox"
          className="checkbox"
          checked={form.isXPEnabled}
          onChange={onField("isXPEnabled")}
        />
        <span>Enable XP System</span>
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col">
          <span className="mb-1">Leveling Formula</span>
          <select
            className="select select-bordered"
            value={form.xpFormulaType}
            onChange={onField("xpFormulaType")}
          >
            <option value="exponential">Exponential (recommended)</option>
            <option value="linear">Linear</option>
            <option value="logarithmic">Logarithmic</option>
          </select>
        </label>

        <label className="flex flex-col">
          <span className="mb-1">Base XP for Level 2</span>
          <input
            className="input input-bordered"
            type="number"
            min={1}
            value={form.baseXPLevel2}
            onChange={onField("baseXPLevel2")}
          />
          <small className="opacity-70">
            Minimum XP to reach Level 2 (default 100)
          </small>
        </label>

        <label className="flex flex-col">
          <span className="mb-1">Bits → XP Count Mode</span>
          <select
            className="select select-bordered"
            value={form.bitToXpCountMode}
            onChange={onField("bitToXpCountMode")}
          >
            <option value="final">Final (include multipliers)</option>
            <option value="base">Base (ignore multipliers)</option>
          </select>
        </label>
      </div>

      <div className="mt-5">
        <h4 className="font-semibold mb-2">XP Gain Rates</h4>
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ["xpRewards.xpPerBitEarned", "XP per Bit Earned"],
            ["xpRewards.xpPerBitSpent", "XP per Bit Spent (purchases only)"],
            ["xpRewards.xpPerStatsBoost", "XP per Stats Boost"],
            ["xpRewards.dailyCheckInXP", "XP per Daily Check-in"],
            ["xpRewards.dailyCheckInLimit", "Daily Check-in Limit"],
            ["xpRewards.groupJoinXP", "XP for Group Join (one-time)"],
            ["xpRewards.challengeXP", "XP per Challenge Completion"],
            ["xpRewards.mysteryBoxUseXP", "XP per Mystery Box Use (0 = off)"],
          ].map(([path, label]) => (
            <label key={path} className="flex flex-col">
              <span className="mb-1">{label}</span>
              <input
                className="input input-bordered"
                type="number"
                value={getPath(form, path)}
                onChange={onField(path)}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button onClick={onSave} disabled={saving} className="btn btn-primary">
          {saving ? "Saving…" : "Save Settings"}
        </button>
        {msg && <span className="text-sm">{msg}</span>}
      </div>
    </section>
  );
}
