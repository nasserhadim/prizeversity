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
      //dailyCheckInXP: 5,
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

  const onSave = async (e) => {
    e?.preventDefault(); // Prevent default form submit behavior
    setSaving(true);
    setMsg("");
    try {
      console.log("[XP] Saving payload:", form); // Optional debug
      const r = await axios.post(
        `/api/xpSettings/${classroomId}`,
        form,
        { withCredentials: true } // Ensure credentials/cookies are sent
      );

      if (r.status === 200) {
        setMsg("Saved ✓");
        toast.success("XP settings saved");
      } else {
        setMsg("Save failed");
        toast.error(`Save failed (status ${r.status})`);
      }
    } catch (e) {
      const apiErr = e?.response?.data?.error || e?.message || "Save failed";
      setMsg("Save failed");
      toast.error(apiErr);
      console.error("[XP] Save failed:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="xp-settings" className="card bg-base-100 shadow-md p-4 w-full mt-4">
      <h3 className="text-lg font-semibold mb-3">XP &amp; Leveling Settings</h3>

      <label className="flex items-center gap-3 mb-4">
        <span className="font-medium">Enable XP System</span>
        <input
          type="checkbox"
          role="switch"
          aria-label="Enable XP System"
          className="toggle toggle-success"
          checked={form.isXPEnabled}
          onChange={onField("isXPEnabled")}
        />
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
          {form.xpFormulaType === "exponential" && (
            <small className="opacity-70 mt-1">
              Each level requires 1.5x more XP
            </small>
          )}
          {form.xpFormulaType === "linear" && (
            <small className="opacity-70 mt-1">
              Each level requires same amount of XP
            </small>
          )}
          {form.xpFormulaType === "logarithmic" && (
            <small className="opacity-70 mt-1">
              Later levels require progressively less XP
            </small>
          )}
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

        <div className="mt-5">
          <h4 className="font-semibold mb-2">XP Gain Rates</h4>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              {
                path: "xpRewards.xpPerBitEarned",
                label: "Bit Earned",
                desc: "XP per bit earned",
              },
              {
                path: "xpRewards.xpPerBitSpent",
                label: "Bit Spent",
                desc: "XP per bit spent",
              },
              {
                path: "xpRewards.xpPerStatsBoost",
                label: "Stat Increase",
                desc: "XP per stat boost",
              },
              // {
              //   path: "xpRewards.dailyCheckInXP",
              //   label: "Daily Check-in",
              //   desc: "XP per daily limit",
              // },
              {
                path: "xpRewards.dailyCheckInLimit",
                label: "Daily Check-in Limit",
                desc: "XP per daily limit",
              },
              {
                path: "xpRewards.groupJoinXP",
                label: "Group Join",
                desc: "XP for joining groups (one-time)",
              },
              {
                path: "xpRewards.challengeXP",
                label: "Challenge Completion",
                desc: "XP per challenge",
              },
              {
                path: "xpRewards.mysteryBoxUseXP",
                label: "Mystery Box Use",
                desc: "XP per mystery box",
              },
            ].map(({ path, label, desc }) => (
              <label key={path} className="flex flex-col">
                <span className="mb-1">{label}</span>
                <input
                  className="input input-bordered"
                  type="number"
                  value={getPath(form, path)}
                  onChange={onField(path)}
                />
                <small className="opacity-70 mt-1">{desc}</small>
              </label>
            ))}

            {/* moved XP from Bits bases, next to Mystery Box Use */}
            <label className="flex flex-col">
              <span className="mb-1">XP from Bits bases</span>
              <select
                className="select select-bordered"
                value={form.bitToXpCountMode}
                onChange={onField("bitToXpCountMode")}
              >
                <option value="base">Base (before multipliers)</option>
                <option value="final">Final (after multipliers)</option>
              </select>
              <small className="opacity-70 mt-1">
                {form.bitToXpCountMode === "final"
                  ? "Current behavior"
                  : "Ignores group/personal multipliers when converting bits → XP"}
              </small>
            </label>
          </div>
        </div>

        <div className="flex items-start gap-2 bg-[#1E56FF] text-white border border-[#1E56FF] rounded-md p-2 shadow-sm w-[3in] h-[1.5in] overflow-hidden">
          <div className="flex items-center justify-center bg-white text-[#1E56FF] rounded-full w-4 h-4 text-[15px] font-bold mt-1 flex-shrink-0">
            i
          </div>
          <div className="text-[18px] leading-tight">
            <p className="font-semibold mb-1">Recommended Balance:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Keep earning Bits</li>
              <li>Reward check-ins</li>
              <li>Avoid grindy XP</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="btn btn-primary"
        >
          {saving ? "Saving…" : "Save Settings"}
        </button>
        {msg && <span className="ml-3 text-sm">{msg}</span>}
      </div>
    </section>
  );
}
