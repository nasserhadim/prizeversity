import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import {
  getIntegrationApps,
  createIntegrationApp,
  updateIntegrationApp,
  deactivateIntegrationApp,
  regenerateApiKey,
  createWebhook,
  deleteWebhook,
  AVAILABLE_SCOPES,
  WEBHOOK_EVENTS,
  WEBHOOKS_BETA_LABEL,
} from '../API/apiIntegrations';
import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import {
  Plus,
  Trash2,
  RefreshCw,
  Copy,
  Eye,
  EyeOff,
  Shield,
  Activity,
  AlertTriangle,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Plug,
  Key,
  Bell,
  Search,
  Clock,
} from 'lucide-react';

export default function IntegrationSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // State
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedApp, setExpandedApp] = useState(null);
  const [classrooms, setClassrooms] = useState([]);

  // Search & sort state
  const [appSearch, setAppSearch] = useState('');
  const [appSort, setAppSort] = useState('createdDesc'); // createdDesc|createdAsc|nameAsc|nameDesc|requestsDesc|statusAsc
  const [appStatusFilter, setAppStatusFilter] = useState('all'); // all|active|inactive

  // Create form state
  const [newApp, setNewApp] = useState({
    name: '',
    description: '',
    icon: '🔌',
    scopes: [],
    classrooms: [],
  });
  const [classroomSearch, setClassroomSearch] = useState('');

  // One-time secret display
  const [revealedSecret, setRevealedSecret] = useState(null);

  // Filtered + sorted apps
  const filteredApps = useMemo(() => {
    let list = [...apps];

    // Status filter
    if (appStatusFilter === 'active') list = list.filter((a) => a.active);
    if (appStatusFilter === 'inactive') list = list.filter((a) => !a.active);

    // Search
    const q = appSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((a) => {
        const parts = [
          a.name || '',
          a.description || '',
          a.clientId || '',
          ...(a.classrooms || []).map((c) => `${c.name || ''} ${c.code || ''}`),
          ...(a.scopes || []),
        ]
          .join(' ')
          .toLowerCase();
        return parts.includes(q);
      });
    }

    // Sort
    list.sort((a, b) => {
      switch (appSort) {
        case 'createdDesc':
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        case 'createdAsc':
          return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        case 'nameAsc':
          return (a.name || '').localeCompare(b.name || '');
        case 'nameDesc':
          return (b.name || '').localeCompare(a.name || '');
        case 'requestsDesc':
          return (b.requestCount || 0) - (a.requestCount || 0);
        case 'requestsAsc':
          return (a.requestCount || 0) - (b.requestCount || 0);
        default:
          return 0;
      }
    });

    return list;
  }, [apps, appSearch, appSort, appStatusFilter]);

  // Fetch data
  const fetchApps = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getIntegrationApps();
      setApps(data);
    } catch (err) {
      if (err.response?.status === 403) {
        toast.error('Only teachers can manage integrations');
        navigate('/');
      } else {
        toast.error('Failed to load integrations');
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const fetchClassrooms = useCallback(async () => {
    try {
      const res = await axios.get('/api/classroom', { withCredentials: true });
      setClassrooms(res.data || []);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    if (user?.role !== 'teacher') {
      toast.error('Only teachers can manage integrations');
      navigate('/');
      return;
    }
    fetchApps();
    fetchClassrooms();
  }, [user, navigate, fetchApps, fetchClassrooms]);

  // ── Handlers ──

  const handleCreate = async () => {
    if (!newApp.name.trim()) {
      toast.error('App name is required');
      return;
    }
    if (newApp.scopes.length === 0) {
      toast.error('Select at least one permission scope');
      return;
    }
    if (newApp.classrooms.length === 0) {
      toast.error('Select at least one classroom to scope this integration to');
      return;
    }

    try {
      const result = await createIntegrationApp(newApp);
      toast.success('Integration app created!');
      setRevealedSecret({ type: 'apiKey', appId: result._id, value: result.apiKey });
      setNewApp({ name: '', description: '', icon: '🔌', scopes: [], classrooms: [] });
      setClassroomSearch('');
      setShowCreateForm(false);
      fetchApps();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create integration app');
    }
  };

  const handleDeactivate = async (appId, appName) => {
    toast((t) => (
      <div className="max-w-sm">
        <p className="font-semibold break-words [overflow-wrap:anywhere]">Deactivate "{appName}"?</p>
        <p className="text-sm opacity-70 mt-1">
          This will immediately revoke API access. External apps using this key will stop working.
        </p>
        <div className="flex gap-2 mt-3">
          <button
            className="btn btn-error btn-sm"
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                await deactivateIntegrationApp(appId);
                toast.success('Integration deactivated');
                fetchApps();
              } catch {
                toast.error('Failed to deactivate');
              }
            }}
          >
            Deactivate
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => toast.dismiss(t.id)}>
            Cancel
          </button>
        </div>
      </div>
    ), { duration: 10000, style: { maxWidth: '420px' } });
  };

  const handleRegenerateKey = async (appId, appName) => {
    toast((t) => (
      <div className="max-w-sm">
        <p className="font-semibold break-words [overflow-wrap:anywhere]">Regenerate API key for "{appName}"?</p>
        <p className="text-sm opacity-70 mt-1">
          The old key will stop working immediately. You'll need to update the key in any external apps.
        </p>
        <div className="flex gap-2 mt-3">
          <button
            className="btn btn-warning btn-sm"
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                const result = await regenerateApiKey(appId);
                setRevealedSecret({ type: 'apiKey', appId, value: result.apiKey });
                toast.success('New API key generated');
              } catch {
                toast.error('Failed to regenerate key');
              }
            }}
          >
            Regenerate
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => toast.dismiss(t.id)}>
            Cancel
          </button>
        </div>
      </div>
    ), { duration: 10000, style: { maxWidth: '420px' } });
  };

  const handleToggleActive = async (app) => {
    try {
      await updateIntegrationApp(app._id, { active: !app.active });
      toast.success(app.active ? 'Integration paused' : 'Integration resumed');
      fetchApps();
    } catch {
      toast.error('Failed to update');
    }
  };

  const handleScopeToggle = (scope) => {
    setNewApp((prev) => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter((s) => s !== scope)
        : [...prev.scopes, scope],
    }));
  };

  const handleClassroomToggle = (classroomId) => {
    setNewApp((prev) => ({
      ...prev,
      classrooms: prev.classrooms.includes(classroomId)
        ? prev.classrooms.filter((c) => c !== classroomId)
        : [...prev.classrooms, classroomId],
    }));
  };

  const copyToClipboard = (text, label = 'Copied') => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${label} to clipboard`);
    }).catch(() => {
      toast.error('Failed to copy');
    });
  };

  // ── Render ──

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-24">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Plug size={24} /> Integrations
            </h1>
            <p className="text-sm opacity-60 mt-1">
              Connect external apps to Prizeversity with scoped API keys.
              <Link to="/support#faq-integrations" className="link link-primary">
                Learn more
              </Link>
              {' · '}
              <Link to="/integrations/docs" className="link link-primary">
                API Docs →
              </Link>
            </p>
          </div>
          <button
            className="btn btn-primary btn-sm gap-1"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            <Plus size={16} />
            New Integration
          </button>
        </div>

        {/* ── One-time API Key reveal banner ── */}
        {revealedSecret?.type === 'apiKey' && (
          <div className="alert alert-warning mb-6 shadow-lg">
            <div className="flex flex-col gap-2 w-full">
              <div className="flex items-center gap-2">
                <AlertTriangle size={20} />
                <span className="font-bold">Save your API key now — it won't be shown again!</span>
              </div>
              <div className="flex items-center gap-2 bg-base-100 rounded-lg p-3 font-mono text-sm break-all">
                <code className="flex-1">{revealedSecret.value}</code>
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => copyToClipboard(revealedSecret.value, 'API Key copied')}
                >
                  <Copy size={14} />
                </button>
              </div>
              <button
                className="btn btn-ghost btn-xs self-end"
                onClick={() => setRevealedSecret(null)}
              >
                I've saved it — dismiss
              </button>
            </div>
          </div>
        )}

        {/* ── One-time Webhook secret reveal banner ── */}
        {revealedSecret?.type === 'webhookSecret' && (
          <div className="alert alert-info mb-6 shadow-lg">
            <div className="flex flex-col gap-2 w-full">
              <div className="flex items-center gap-2">
                <Bell size={20} />
                <span className="font-bold">Save your webhook signing secret — it won't be shown again!</span>
                <span className="badge badge-warning badge-sm">{WEBHOOKS_BETA_LABEL}</span>
              </div>
              <p className="text-xs opacity-70">
                Webhooks are currently in beta. Delivery and payload format may change. Please report any issues.
              </p>
              <div className="flex items-center gap-2 bg-base-100 rounded-lg p-3 font-mono text-sm break-all">
                <code className="flex-1">{revealedSecret.value}</code>
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => copyToClipboard(revealedSecret.value, 'Secret copied')}
                >
                  <Copy size={14} />
                </button>
              </div>
              <button
                className="btn btn-ghost btn-xs self-end"
                onClick={() => setRevealedSecret(null)}
              >
                I've saved it — dismiss
              </button>
            </div>
          </div>
        )}

        {/* ── Create Form ── */}
        {showCreateForm && (
          <div className="card bg-base-100 shadow-lg mb-6">
            <div className="card-body">
              <h2 className="card-title text-lg">Create Integration App</h2>

              {/* Name */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">App Name *</span>
                </label>
                <input
                  type="text"
                  placeholder='e.g. "ExtRewardTool"'
                  className="input input-bordered"
                  value={newApp.name}
                  onChange={(e) => setNewApp({ ...newApp, name: e.target.value })}
                />
              </div>

              {/* Description */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Description</span>
                </label>
                <input
                  type="text"
                  placeholder="What does this integration do?"
                  className="input input-bordered"
                  value={newApp.description}
                  onChange={(e) => setNewApp({ ...newApp, description: e.target.value })}
                />
              </div>

              {/* Classroom Scope */}
              <div className="form-control mt-2">
                <label className="label">
                  <span className="label-text font-semibold">Classroom Scope *</span>
                </label>
                <p className="text-xs opacity-60 mb-2">
                  Select which classrooms this integration can access. This cannot be changed later (create a new integration for other classrooms).
                </p>
                <input
                  type="search"
                  placeholder="Search classrooms by name or code..."
                  className="input input-bordered input-sm mb-2"
                  value={classroomSearch}
                  onChange={(e) => setClassroomSearch(e.target.value)}
                />
                {classrooms.length > 0 && (
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary checkbox-sm"
                      checked={
                        classrooms.length > 0 &&
                        classrooms
                          .filter((c) => {
                            const q = classroomSearch.trim().toLowerCase();
                            if (!q) return true;
                            return (
                              (c.name || '').toLowerCase().includes(q) ||
                              (c.code || '').toLowerCase().includes(q)
                            );
                          })
                          .every((c) => newApp.classrooms.includes(c._id))
                      }
                      onChange={() => {
                        const filtered = classrooms.filter((c) => {
                          const q = classroomSearch.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            (c.name || '').toLowerCase().includes(q) ||
                            (c.code || '').toLowerCase().includes(q)
                          );
                        });
                        const allSelected = filtered.every((c) => newApp.classrooms.includes(c._id));
                        if (allSelected) {
                          const filteredIds = new Set(filtered.map((c) => c._id));
                          setNewApp((prev) => ({
                            ...prev,
                            classrooms: prev.classrooms.filter((id) => !filteredIds.has(id)),
                          }));
                        } else {
                          const merged = new Set([...newApp.classrooms, ...filtered.map((c) => c._id)]);
                          setNewApp((prev) => ({
                            ...prev,
                            classrooms: [...merged],
                          }));
                        }
                      }}
                    />
                    <span className="text-sm">
                      Select All
                      {classroomSearch.trim()
                        ? ` (${classrooms.filter((c) => {
                            const q = classroomSearch.trim().toLowerCase();
                            return (c.name || '').toLowerCase().includes(q) || (c.code || '').toLowerCase().includes(q);
                          }).length} matching)`
                        : ` (${classrooms.length})`}
                    </span>
                    {newApp.classrooms.length > 0 && (
                      <span className="text-xs opacity-50 ml-auto">
                        {newApp.classrooms.length} selected
                      </span>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {classrooms.length === 0 ? (
                    <p className="text-sm opacity-50">No classrooms found. Create a classroom first.</p>
                  ) : (
                    classrooms
                      .filter((c) => {
                        const q = classroomSearch.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          (c.name || '').toLowerCase().includes(q) ||
                          (c.code || '').toLowerCase().includes(q)
                        );
                      })
                      .map((c) => (
                      <label
                        key={c._id}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-colors ${
                          newApp.classrooms.includes(c._id)
                            ? 'border-primary bg-primary/10'
                            : 'border-base-300 hover:border-base-content/30'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="checkbox checkbox-primary checkbox-sm"
                          checked={newApp.classrooms.includes(c._id)}
                          onChange={() => handleClassroomToggle(c._id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.name}</p>
                          <p className="text-xs opacity-50">{c.code}</p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Scopes */}
              <div className="form-control mt-2">
                <label className="label">
                  <span className="label-text font-semibold">Permissions *</span>
                </label>
                <p className="text-xs opacity-60 mb-2">
                  Only grant the permissions this integration actually needs.
                </p>
                <div className="space-y-2">
                  {AVAILABLE_SCOPES.map((scope) => (
                    <label
                      key={scope.value}
                      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${
                        newApp.scopes.includes(scope.value)
                          ? 'border-primary bg-primary/10'
                          : 'border-base-300 hover:border-base-content/30'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="checkbox checkbox-primary checkbox-sm mt-0.5"
                        checked={newApp.scopes.includes(scope.value)}
                        onChange={() => handleScopeToggle(scope.value)}
                      />
                      <div>
                        <p className="text-sm font-medium">{scope.label}</p>
                        <p className="text-xs opacity-60">{scope.description}</p>
                        <code className="text-xs opacity-40">{scope.value}</code>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="card-actions justify-end mt-4">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewApp({ name: '', description: '', icon: '🔌', scopes: [], classrooms: [] });
                    setClassroomSearch('');
                  }}
                >
                  Cancel
                </button>
                <button className="btn btn-primary btn-sm" onClick={handleCreate}>
                  Create Integration
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Search / Sort / Filter Bar ── */}
        {apps.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
              <input
                type="search"
                placeholder="Search integrations by name, description, classroom, scope..."
                className="input input-bordered w-full pl-9 input-sm"
                value={appSearch}
                onChange={(e) => setAppSearch(e.target.value)}
              />
            </div>
            <select
              className="select select-bordered select-sm"
              value={appStatusFilter}
              onChange={(e) => setAppStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <select
              className="select select-bordered select-sm"
              value={appSort}
              onChange={(e) => setAppSort(e.target.value)}
            >
              <option value="createdDesc">Created: Newest</option>
              <option value="createdAsc">Created: Oldest</option>
              <option value="nameAsc">Name: A → Z</option>
              <option value="nameDesc">Name: Z → A</option>
              <option value="requestsDesc">Requests: Most</option>
              <option value="requestsAsc">Requests: Least</option>
            </select>
            <span className="text-xs opacity-50">
              {filteredApps.length} of {apps.length}
            </span>
          </div>
        )}

        {/* ── App List ── */}
        {apps.length === 0 && !showCreateForm ? (
          <div className="text-center py-16 opacity-50">
            <Plug size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No integrations yet</p>
            <p className="text-sm mt-1">Create one to connect external apps like ExtRewardTool</p>
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="text-center py-8 opacity-50">
            <Search size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No integrations match your search</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredApps.map((app) => (
              <IntegrationAppCard
                key={app._id}
                app={app}
                expanded={expandedApp === app._id}
                onToggleExpand={() => setExpandedApp(expandedApp === app._id ? null : app._id)}
                onDeactivate={() => handleDeactivate(app._id, app.name)}
                onRegenerateKey={() => handleRegenerateKey(app._id, app.name)}
                onToggleActive={() => handleToggleActive(app)}
                onWebhookCreated={(secret) => setRevealedSecret(secret)}
                onRefresh={fetchApps}
                copyToClipboard={copyToClipboard}
              />
            ))}
          </div>
        )}
      </div>
      <Footer />
    </>
  );
}

// ── Helper: relative time ──
function timeAgo(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ── Sub-component: Integration App Card ──

function IntegrationAppCard({
  app,
  expanded,
  onToggleExpand,
  onDeactivate,
  onRegenerateKey,
  onToggleActive,
  onWebhookCreated,
  onRefresh,
  copyToClipboard,
}) {
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [webhookEvent, setWebhookEvent] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');

  const handleCreateWebhook = async () => {
    if (!webhookEvent || !webhookUrl.trim()) {
      toast.error('Event and URL are required');
      return;
    }
    try {
      const result = await createWebhook(app._id, { event: webhookEvent, url: webhookUrl });
      toast.success('Webhook created!');
      onWebhookCreated({
        type: 'webhookSecret',
        appId: app._id,
        hookId: result._id,
        value: result.secret,
      });
      setShowWebhookForm(false);
      setWebhookEvent('');
      setWebhookUrl('');
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create webhook');
    }
  };

  const handleDeleteWebhook = async (hookId) => {
    try {
      await deleteWebhook(app._id, hookId);
      toast.success('Webhook removed');
      onRefresh();
    } catch {
      toast.error('Failed to remove webhook');
    }
  };

  const scopeLabels = AVAILABLE_SCOPES.reduce((acc, s) => {
    acc[s.value] = s.label;
    return acc;
  }, {});

  return (
    <div
      className={`card bg-base-100 shadow border transition-colors ${
        app.active ? 'border-base-300' : 'border-error/30 opacity-60'
      }`}
    >
      <div className="card-body p-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer flex-1 min-w-0" onClick={onToggleExpand}>
            <span className="text-2xl shrink-0">{app.icon || '🔌'}</span>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold flex items-center gap-2 flex-wrap break-words [overflow-wrap:anywhere]">
                <span className="break-all [overflow-wrap:anywhere]">{app.name}</span>
                {!app.active && (
                  <span className="badge badge-error badge-xs shrink-0">Inactive</span>
                )}
              </h3>
              {app.description && (
                <p className="text-xs opacity-60 mt-0.5 break-words [overflow-wrap:anywhere] whitespace-pre-wrap">
                  {app.description}
                </p>
              )}
              <p className="text-xs opacity-50 mt-0.5">
                {app.clientId} · {app.requestCount || 0} requests
                {app.lastUsedAt && ` · Last used ${timeAgo(app.lastUsedAt)}`}
              </p>
              {/* Timestamps row */}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                {app.createdAt && (
                  <span className="text-xs opacity-40 flex items-center gap-1" title={new Date(app.createdAt).toLocaleString()}>
                    <Clock size={10} /> Created {timeAgo(app.createdAt)}
                  </span>
                )}
                {app.keyRegeneratedAt && (
                  <span className="text-xs opacity-40 flex items-center gap-1" title={new Date(app.keyRegeneratedAt).toLocaleString()}>
                    <RefreshCw size={10} /> Key regenerated {timeAgo(app.keyRegeneratedAt)}
                  </span>
                )}
                {!app.active && app.deactivatedAt && (
                  <span className="text-xs text-error opacity-60 flex items-center gap-1" title={new Date(app.deactivatedAt).toLocaleString()}>
                    <X size={10} /> Deactivated {timeAgo(app.deactivatedAt)}
                  </span>
                )}
                {!app.active && app.pausedAt && !app.deactivatedAt && (
                  <span className="text-xs text-warning opacity-60 flex items-center gap-1" title={new Date(app.pausedAt).toLocaleString()}>
                    <EyeOff size={10} /> Paused {timeAgo(app.pausedAt)}
                  </span>
                )}
                {app.active && app.resumedAt && (
                  <span className="text-xs text-success opacity-60 flex items-center gap-1" title={new Date(app.resumedAt).toLocaleString()}>
                    <Eye size={10} /> Resumed {timeAgo(app.resumedAt)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              className="btn btn-ghost btn-xs"
              onClick={onToggleExpand}
              title={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* Classroom scope badges */}
        {app.classrooms && app.classrooms.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {app.classrooms.map((c) => (
              <span key={c._id || c} className="badge badge-outline badge-sm" title={c._id ? `ID: ${c._id}` : ''}>
                {c.name || c.code || String(c._id || c).slice(-6)}
                {c.code ? ` (${c.code})` : ''}
              </span>
            ))}
          </div>
        )}

        {/* Scope badges */}
        <div className="flex flex-wrap gap-1 mt-1">
          {(app.scopes || []).map((s) => (
            <span key={s} className="badge badge-primary badge-outline badge-xs">
              {scopeLabels[s] || s}
            </span>
          ))}
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-4 space-y-4">
            {/* Timestamps detail */}
            <div>
              <p className="text-xs font-semibold opacity-60 mb-1">Activity Timeline</p>
              <div className="bg-base-200 rounded-lg p-3 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="opacity-60">Created</span>
                  <span>{app.createdAt ? new Date(app.createdAt).toLocaleString() : '—'}</span>
                </div>
                {app.keyRegeneratedAt && (
                  <div className="flex justify-between">
                    <span className="opacity-60">Key Regenerated</span>
                    <span>{new Date(app.keyRegeneratedAt).toLocaleString()}</span>
                  </div>
                )}
                {app.pausedAt && (
                  <div className="flex justify-between">
                    <span className="opacity-60">Last Paused</span>
                    <span>{new Date(app.pausedAt).toLocaleString()}</span>
                  </div>
                )}
                {app.resumedAt && (
                  <div className="flex justify-between">
                    <span className="opacity-60">Last Resumed</span>
                    <span>{new Date(app.resumedAt).toLocaleString()}</span>
                  </div>
                )}
                {app.deactivatedAt && (
                  <div className="flex justify-between text-error">
                    <span className="opacity-60">Deactivated</span>
                    <span>{new Date(app.deactivatedAt).toLocaleString()}</span>
                  </div>
                )}
                {app.lastUsedAt && (
                  <div className="flex justify-between">
                    <span className="opacity-60">Last API Call</span>
                    <span>{new Date(app.lastUsedAt).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Client ID (copyable) */}
            <div>
              <p className="text-xs font-semibold opacity-60 mb-1">Client ID</p>
              <div className="flex items-center gap-2 bg-base-200 rounded-lg p-2">
                <code className="text-sm flex-1 break-all">{app.clientId}</code>
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => copyToClipboard(app.clientId, 'Client ID copied')}
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>

            {/* Rate limits */}
            <div>
              <p className="text-xs font-semibold opacity-60 mb-1">Rate Limits</p>
              <p className="text-sm">
                {app.rateLimit?.maxPerMinute || 60}/min · {app.rateLimit?.maxPerHour || 1000}/hr
              </p>
            </div>

            {/* Webhooks */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold opacity-60">
                  Webhooks ({(app.webhooks || []).filter((w) => w.active).length} active)
                  <span className="badge badge-warning badge-xs ml-1">{WEBHOOKS_BETA_LABEL}</span>
                </p>
                <button
                  className="btn btn-ghost btn-xs gap-1"
                  onClick={() => setShowWebhookForm(!showWebhookForm)}
                >
                  <Plus size={14} /> Add
                </button>
              </div>

              {showWebhookForm && (
                <div className="bg-base-200 rounded-lg p-3 mb-3 space-y-2">
                  <p className="text-xs font-medium opacity-70 flex items-center gap-1">
                    New Webhook <span className="badge badge-warning badge-xs">{WEBHOOKS_BETA_LABEL}</span>
                  </p>
                  <select
                    className="select select-bordered select-sm w-full"
                    value={webhookEvent}
                    onChange={(e) => setWebhookEvent(e.target.value)}
                  >
                    <option value="">Select event...</option>
                    {WEBHOOK_EVENTS.map((ev) => (
                      <option key={ev.value} value={ev.value}>
                        {ev.label} — {ev.description}
                      </option>
                    ))}
                  </select>
                  <input
                    type="url"
                    placeholder="https://your-app.com/webhook"
                    className="input input-bordered input-sm w-full"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                  />
                  <div className="flex gap-2 justify-end">
                    <button className="btn btn-ghost btn-xs" onClick={() => setShowWebhookForm(false)}>
                      Cancel
                    </button>
                    <button className="btn btn-primary btn-xs" onClick={handleCreateWebhook}>
                      Create Webhook
                    </button>
                  </div>
                </div>
              )}

              {(app.webhooks || []).length > 0 && (
                <div className="space-y-2">
                  {app.webhooks.map((hook) => (
                    <div
                      key={hook._id}
                      className={`flex items-center justify-between bg-base-200 rounded-lg p-2 text-sm ${
                        !hook.active ? 'opacity-40' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="badge badge-sm badge-outline mr-2">{hook.event}</span>
                        <span className="text-xs opacity-60 break-all">{hook.url}</span>
                        {hook.failCount > 0 && (
                          <span className="badge badge-error badge-xs ml-2">
                            {hook.failCount} failures
                          </span>
                        )}
                        {!hook.active && (
                          <span className="badge badge-error badge-xs ml-2">disabled</span>
                        )}
                      </div>
                      <button
                        className="btn btn-ghost btn-xs text-error"
                        onClick={() => handleDeleteWebhook(hook._id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="divider my-2" />
            <div className="flex flex-wrap gap-2">
              <button
                className="btn btn-warning btn-sm btn-outline gap-1"
                onClick={onRegenerateKey}
              >
                <RefreshCw size={14} />
                Regenerate Key
              </button>
              <button
                className={`btn btn-sm btn-outline gap-1 ${app.active ? 'btn-ghost' : 'btn-success'}`}
                onClick={onToggleActive}
              >
                {app.active ? <EyeOff size={14} /> : <Eye size={14} />}
                {app.active ? 'Pause' : 'Resume'}
              </button>
              <button className="btn btn-error btn-sm btn-outline gap-1" onClick={onDeactivate}>
                <Trash2 size={14} />
                Deactivate
              </button>
            </div>

            {/* Usage hint */}
            <div className="bg-base-200 rounded-lg p-3 mt-2">
              <p className="text-xs font-semibold mb-1">📋 Quick Start</p>
              <p className="text-xs opacity-70">
                Use the API key in the <code className="bg-base-300 px-1 rounded">X-API-Key</code> header
                when calling Prizeversity endpoints from your external app.
                <Link to="/integrations/docs" className="link link-primary">
                  Full API reference →
                </Link>
              </p>
              <pre className="text-xs mt-2 bg-base-300 p-2 rounded overflow-x-auto">
{`fetch('/api/integrations/wallet/adjust', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'pvk_your_key_here'
  },
  body: JSON.stringify({
    classroomId: '${app.classrooms?.[0]?._id || app.classrooms?.[0] || '<classroom_id>'}',
    updates: [{ userId: '<id>', amount: 10 }],
    description: 'Reward from ${app.name}',
    applyGroupMultipliers: true,
    applyPersonalMultipliers: true
  })
})`}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}