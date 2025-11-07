// prizeversity/frontend/src/pages/ClassroomSettings.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { LoaderIcon } from 'lucide-react';
import Footer from '../components/Footer';



//xp leveling systems 
function XPSettingsSection({ classroomId }) {
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

  //helpers

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


  // loading existing settings

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
      } catch (err) {
        setMsg("Failed to load XP settings.");
      }
    })();
  }, [classroomId]);

    // saving
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
    <section className="card bg-base-100 shadow-md p-4 w-full mt-4">
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
        <button
          onClick={onSave}
          disabled={saving}
          className="btn btn-primary"
        >
          {saving ? "Saving…" : "Save Settings"}
        </button>
        {msg && <span className="text-sm">{msg}</span>}
      </div>
    </section>
  );
}







export default function ClassroomSettings() {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [classroom, setClassroom] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editingClassroom, setEditingClassroom] = useState(false);
    const [updateClassroomName, setUpdateClassroomName] = useState('');
    const [updateColor, setUpdateColor] = useState('#ffffff');
    const [updateBackgroundFile, setUpdateBackgroundFile] = useState(null);
    // New: keep same UX as "Create Classroom" (file vs url)
    const [updateBackgroundImageSource, setUpdateBackgroundImageSource] = useState('file'); // 'file' | 'url'
    const [updateBackgroundImageUrl, setUpdateBackgroundImageUrl] = useState('');
    const [archived, setArchived] = useState(false);

    // Fetch classroom details
    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const res = await axios.get(`/api/classroom/${id}`);
                const cls = res.data;
                setArchived(cls.archived);
                // Only teacher/admin can access
                // Normalize teacher id (handle populated object or raw id)
                const teacherId = cls.teacher && (typeof cls.teacher === 'string'
                  ? cls.teacher
                  : (cls.teacher._id || cls.teacher).toString());
                const hasAccess =
                    user.role === 'admin' ||
                    (user.role === 'teacher' && String(teacherId) === String(user._id));
                if (!hasAccess) {
                    toast.error('You do not have access to this classroom');
                    navigate('/');
                    return;
                }
                setClassroom(cls);
            } catch (err) {
                console.error('Error fetching classroom:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [id, user, navigate]);

    // Initialize edit fields when entering edit mode
    useEffect(() => {
        if (editingClassroom && classroom) {
            setUpdateClassroomName(classroom.name);
            setUpdateColor(classroom.color || '#ffffff');
            setUpdateBackgroundFile(null);
        }
    }, [editingClassroom, classroom]);

    // Leave classroom with toast confirmation
    const handleLeave = () => {
        toast((t) => (
            <div className="flex flex-col">
                <span>Leave "{classroom.name}"?</span>
                <div className="flex justify-end gap-2 mt-2">
                    <button
                        className="btn btn-warning btn-sm"
                        onClick={async () => {
                            toast.dismiss(t.id);
                            try {
                                await axios.post(`/api/classroom/${id}/leave`);
                                navigate('/classrooms');
                                const toastId = toast.success('Left classroom!');
                                // Force dismiss after 3 seconds
                                setTimeout(() => toast.dismiss(toastId), 3000);
                            } catch (err) {
                                console.error(err);
                                const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to leave classroom';
                                toast.error(msg);
                            }
                        }}
                    >
                        Leave
                    </button>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => toast.dismiss(t.id)}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        ));
    };

    // Delete classroom with toast confirmation
    const handleDelete = () => {
        toast((t) => (
            <div className="flex flex-col">
                <span>Delete "{classroom.name}"? All data will be lost!</span>
                <div className="flex justify-end gap-2 mt-2">
                    <button
                        className="btn btn-error btn-sm"
                        onClick={async () => {
                            toast.dismiss(t.id);
                            try {
                                await axios.delete(`/api/classroom/${id}`);
                                navigate('/');
                                const toastId = toast.success('Classroom deleted!');
                                // Force dismiss after 3 seconds
                                setTimeout(() => toast.dismiss(toastId), 3000);
                            } catch (err) {
                                console.error(err);
                                toast.error('Failed to delete classroom');
                            }
                        }}
                    >
                        Delete
                    </button>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => toast.dismiss(t.id)}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        ));
    };

    // Toggle archive status
    const handleToggleArchive = async () => {
        try {
            // send JSON instead of FormData
            const res = await axios.put(
                `/api/classroom/${id}`,
                { archived: !archived }
            );
            toast.success(`Classroom ${archived ? 'restored' : 'archived'}!`);
            setArchived(!archived);
            setClassroom(res.data);
        } catch (err) {
            console.error('Toggle-archive error:', err.response || err);
            toast.error(err.response?.data?.error || 'Failed to update archive status');
        }
    };

    // Update classroom (name, color, background image)
    const handleUpdateClassroom = async () => {
        try {
            const formData = new FormData();
            formData.append('name', updateClassroomName || classroom.name);
            formData.append('color', updateColor);
            // If user chose a file, append the file. If they chose URL, append the URL string.
            if (updateBackgroundImageSource === 'file' && updateBackgroundFile) {
                formData.append('backgroundImage', updateBackgroundFile);
            } else if (updateBackgroundImageSource === 'url' && updateBackgroundImageUrl.trim()) {
                formData.append('backgroundImage', updateBackgroundImageUrl.trim());
            }

            const res = await axios.put(`/api/classroom/${id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            toast.success('Classroom updated!');
            setEditingClassroom(false);
            setUpdateClassroomName('');
            setUpdateColor('#ffffff');
            setUpdateBackgroundFile(null);
            setClassroom(res.data);
        } catch (err) {
            const msg = err.response?.data?.error || 'Update failed';
            toast.error(msg);
        }
    };

    // Cancel edit mode
    const handleCancelUpdate = () => {
        setEditingClassroom(false);
        setUpdateClassroomName('');
        setUpdateColor('#ffffff');
        setUpdateBackgroundFile(null);
    };

    if (loading || !classroom) {
        return (
            <div className="min-h-screen bg-base-200 flex flex-col justify-between items-center p-4">
                <LoaderIcon className="animate-spin size-10" />
            </div>
        );
    }

    return (
        <div className="h-screen bg-base-200 flex flex-col justify-between items-center p-4">
            <div className="w-full max-w-3xl space-y-4 flex flex-col items-center">
                <Link to={`/classroom/${id}`} className="link text-accent self-start">
                    ← Back to Classroom
                </Link>
                <h1 className="text-3xl font-bold text-center">
                    {classroom.name}{classroom.code ? ` (${classroom.code})` : ''}
                </h1>
                <p className="text-sm text-gray-500 text-center">Class Code: {classroom.code}</p>

                {editingClassroom ? (
                    <div className="card bg-base-100 shadow-md p-4 w-full">
                        <h4 className="text-lg font-semibold">Update Classroom</h4>
                        <input
                            className="input input-bordered w-full mt-2"
                            type="text"
                            placeholder="New Classroom Name"
                            value={updateClassroomName}
                            onChange={(e) => setUpdateClassroomName(e.target.value)}
                        />
                        <input
                            type="color"
                            value={updateColor}
                            onChange={(e) => setUpdateColor(e.target.value)}
                            className="input w-full h-10 p-0 border mt-2"
                        />
                        <div className="mb-4">
                          <label className="label">
                            <span className="label-text">Background Image</span>
                            <span className="label-text-alt">Optional</span>
                          </label>

                          <div className="inline-flex rounded-full bg-gray-200 p-1 mb-2">
                            <button
                              type="button"
                              onClick={() => setUpdateBackgroundImageSource('file')}
                              className={`px-3 py-1 rounded-full text-sm transition ${updateBackgroundImageSource === 'file' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}
                            >
                              Upload
                            </button>
                            <button
                              type="button"
                              onClick={() => setUpdateBackgroundImageSource('url')}
                              className={`ml-1 px-3 py-1 rounded-full text-sm transition ${updateBackgroundImageSource === 'url' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}
                            >
                              Use image URL
                            </button>
                          </div>

                          {updateBackgroundImageSource === 'file' ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="file"
                                name="backgroundImage"
                                accept="image/png,image/jpeg,image/webp,image/gif"
                                onChange={e => {
                                  setUpdateBackgroundFile(e.target.files[0]);
                                  // keep URL empty when choosing file
                                  setUpdateBackgroundImageUrl('');
                                }}
                                className="file-input file-input-bordered flex-1"
                              />
                              {updateBackgroundFile && (
                                <img
                                  src={URL.createObjectURL(updateBackgroundFile)}
                                  alt="Preview"
                                  className="w-16 h-16 object-cover rounded border"
                                />
                              )}
                            </div>
                          ) : (
                            <input
                              type="url"
                              placeholder="https://example.com/background.jpg"
                              value={updateBackgroundImageUrl}
                              onChange={e => {
                                setUpdateBackgroundImageUrl(e.target.value);
                                // clear file when entering URL
                                setUpdateBackgroundFile(null);
                              }}
                              className="input input-bordered w-full"
                            />
                          )}
                          <p className="text-xs text-gray-500 mt-2">Allowed: jpg, png, webp, gif. Max: 5 MB.</p>
                        </div>
                        <div className="mt-4 flex gap-2">
                            <button className="btn btn-primary" onClick={handleUpdateClassroom}>
                                Update
                            </button>
                            <button className="btn btn-ghost" onClick={handleCancelUpdate}>
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        className="btn btn-outline btn-info"
                        onClick={() => setEditingClassroom(true)}
                    >
                        Edit Classroom
                    </button>
                )}

                <div className="flex flex-wrap gap-2 justify-center w-full">
                    {user.role !== 'teacher' && (
                        <button className="btn btn-warning" onClick={handleLeave}>
                            Leave Classroom
                        </button>
                    )}
                    {user.role === 'teacher' && (
                        <>
                            <button className="btn btn-error" onClick={handleDelete}>
                                Delete Classroom
                            </button>
                            <button
                                className={`btn ${archived ? 'btn-success' : 'btn-outline'} `}
                                onClick={handleToggleArchive}
                            >
                                {archived ? 'Unarchive Classroom' : 'Archive Classroom'}
                            </button>
                        </>
                    )}
                </div>
                <XPSettingsSection classroomId={id} />   

            </div>
            <Footer />
                     
        </div>
    );
}