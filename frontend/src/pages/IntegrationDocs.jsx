import React, { useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { ThemeContext } from '../context/ThemeContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import {
  Code,
  Key,
  Shield,
  Zap,
  Users,
  Wallet,
  Bell,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  BookOpen,
  Server,
  Lock,
  Clock,
  Plug,
  Package,
  Search,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE_URL = 'https://www.prizeversity.com';

// ── Helpers ──

function CopyBlock({ code, language = 'bash' }) {
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => toast.success('Copied!'));
  };
  return (
    <div className="relative group">
      <pre className="bg-base-300 rounded-lg p-4 overflow-x-auto text-sm font-mono whitespace-pre">
        {code}
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 btn btn-ghost btn-xs opacity-0 group-hover:opacity-100 transition-opacity"
        title="Copy"
      >
        <Copy size={14} />
      </button>
    </div>
  );
}

function EndpointCard({ method, path, scope, description, requestBody, responseBody, notes, children }) {
  const [open, setOpen] = useState(false);
  const methodColors = {
    GET: 'badge-success',
    POST: 'badge-primary',
    PATCH: 'badge-warning',
    DELETE: 'badge-error',
  };

  return (
    <div className="card bg-base-100 shadow border border-base-300 mb-4">
      <div
        className="card-body p-4 cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`badge ${methodColors[method] || 'badge-ghost'} badge-sm font-mono font-bold`}>
            {method}
          </span>
          <code className="text-sm font-mono flex-1">{path}</code>
          {scope && (
            <span className="badge badge-outline badge-xs font-mono">{scope}</span>
          )}
          <button className="btn btn-ghost btn-xs">
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
        <p className="text-sm opacity-70 mt-1">{description}</p>
      </div>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {requestBody && (
            <div>
              <p className="text-xs font-semibold opacity-60 mb-1">Request Body</p>
              <CopyBlock code={requestBody} language="json" />
            </div>
          )}
          {responseBody && (
            <div>
              <p className="text-xs font-semibold opacity-60 mb-1">Response</p>
              <CopyBlock code={responseBody} language="json" />
            </div>
          )}
          {notes && (
            <div className="alert alert-info text-sm py-2">
              <Info size={16} />
              <span>{notes}</span>
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

function SectionHeading({ id, icon, title, subtitle }) {
  return (
    <div id={id} className="scroll-mt-20 mb-6 mt-12 first:mt-0">
      <h2 className="text-xl font-bold flex items-center gap-2">
        {icon}
        {title}
      </h2>
      {subtitle && <p className="text-sm opacity-60 mt-1">{subtitle}</p>}
    </div>
  );
}

// ── Page Component ──

export default function IntegrationDocs() {
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'dark';

  const tocSections = [
    { id: 'overview', label: 'Overview' },
    { id: 'authentication', label: 'Authentication' },
    { id: 'rate-limits', label: 'Rate Limits' },
    { id: 'errors', label: 'Error Handling' },
    { id: 'endpoints-users', label: 'Users' },
    { id: 'endpoints-wallet', label: 'Wallet' },
    { id: 'endpoints-classroom', label: 'Classroom' },
    { id: 'endpoints-inventory', label: 'Inventory' },
    { id: 'webhooks', label: 'Webhooks (Beta)' },
    { id: 'quickstart', label: 'Quick Start Guide' },
  ];

  return (
    <>
      <Navbar />
      <div className="max-w-5xl mx-auto p-4 sm:p-6 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BookOpen size={24} /> Integration API Reference
            </h1>
            <p className="text-sm opacity-60 mt-1">
              Technical documentation for developers building integrations with Prizeversity
            </p>
          </div>
          <Link to="/integrations" className="btn btn-primary btn-sm gap-1">
            <Plug size={16} />
            Manage Apps
          </Link>
        </div>

        {/* Teacher notice */}
        <div className="alert alert-info mb-6 text-sm">
          <Info size={18} />
          <div>
            <span className="font-semibold">Not a developer?</span>{' '}
            Check out the{' '}
            <Link to="/support#faq-integrations" className="link link-primary font-medium">
              Help & Support FAQs
            </Link>{' '}
            for a non-technical guide on setting up integrations.
          </div>
        </div>

        <div className="flex gap-8">
          {/* Table of contents — sticky sidebar on desktop */}
          <aside className="hidden lg:block w-48 shrink-0 sticky top-20 self-start">
            <p className="text-xs font-bold opacity-50 uppercase mb-3">On This Page</p>
            <nav className="space-y-1">
              {tocSections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="block text-sm opacity-60 hover:opacity-100 hover:text-primary transition-colors py-0.5"
                >
                  {s.label}
                </a>
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* ═══════════════════════════════════════════════ */}
            {/* OVERVIEW */}
            {/* ═══════════════════════════════════════════════ */}
            <SectionHeading
              id="overview"
              icon={<Server size={20} />}
              title="Overview"
              subtitle="Base URL and general information"
            />

            <p className="text-sm mb-4">
              The Prizeversity Integration API allows external applications to interact with
              classrooms, users, wallets, and inventory. All endpoints are available under:
            </p>

            <CopyBlock code={`${API_BASE_URL}/api/integrations`} />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              <div className="card bg-base-200 p-3 text-center">
                <p className="text-xs opacity-50">Protocol</p>
                <p className="font-mono text-sm font-bold">HTTPS</p>
              </div>
              <div className="card bg-base-200 p-3 text-center">
                <p className="text-xs opacity-50">Format</p>
                <p className="font-mono text-sm font-bold">JSON</p>
              </div>
              <div className="card bg-base-200 p-3 text-center">
                <p className="text-xs opacity-50">Auth</p>
                <p className="font-mono text-sm font-bold">API Key (Header)</p>
              </div>
            </div>

            {/* ═══════════════════════════════════════════════ */}
            {/* AUTHENTICATION */}
            {/* ═══════════════════════════════════════════════ */}
            <SectionHeading
              id="authentication"
              icon={<Key size={20} />}
              title="Authentication"
              subtitle="How to authenticate API requests"
            />

            <p className="text-sm mb-3">
              All API requests must include an <code className="bg-base-300 px-1 rounded">X-API-Key</code> header
              with a valid integration API key. Keys are created by teachers from the{' '}
              <Link to="/integrations" className="link link-primary">Integrations</Link> settings page.
            </p>

            <CopyBlock
              code={`curl -X POST ${API_BASE_URL}/api/integrations/users/list/CLASSROOM_ID \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: pvk_your_api_key_here"`}
            />

            <h3 className="font-semibold text-sm mt-6 mb-2">Scopes</h3>
            <p className="text-sm mb-3">
              Each API key is granted specific permission scopes. A request to an endpoint
              requiring a scope the key doesn't have will return <code className="bg-base-300 px-1 rounded">403 Forbidden</code>.
            </p>

            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Scope</th>
                    <th>Grants Access To</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['wallet:adjust', 'Add or deduct bits from user wallets'],
                    ['users:match', 'Match user names to Prizeversity user IDs'],
                    ['users:read', 'List users in a classroom (extended: balances, XP, badges, stats, groups)'],
                    ['classroom:read', 'Read classroom details (extended: groups, bazaar, badges, XP settings, announcements)'],
                    ['inventory:read', 'View user inventory items'],
                    ['inventory:use', 'Mark inventory items as redeemed'],
                    ['webhooks:manage', 'Register and manage webhook subscriptions'],
                  ].map(([scope, desc]) => (
                    <tr key={scope}>
                      <td><code className="text-xs">{scope}</code></td>
                      <td className="text-sm opacity-70">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="font-semibold text-sm mt-6 mb-2">Classroom Scoping</h3>
            <p className="text-sm mb-3">
              API keys are scoped to specific classrooms. If a request targets a classroom
              the key is not authorized for, the API returns <code className="bg-base-300 px-1 rounded">403</code>.
              This means even if a key is leaked, it can only affect the classrooms
              the teacher explicitly allowed.
            </p>

            {/* ═══════════════════════════════════════════════ */}
            {/* RATE LIMITS */}
            {/* ═══════════════════════════════════════════════ */}
            <SectionHeading
              id="rate-limits"
              icon={<Clock size={20} />}
              title="Rate Limits"
              subtitle="Request throttling per integration app"
            />

            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Window</th>
                    <th>Default Limit</th>
                    <th>HTTP Status on Exceed</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Per minute</td><td className="font-mono">60</td><td><code>429 Too Many Requests</code></td></tr>
                  <tr><td>Per hour</td><td className="font-mono">1,000</td><td><code>429 Too Many Requests</code></td></tr>
                </tbody>
              </table>
            </div>

            <p className="text-sm mt-3 opacity-70">
              The response includes a <code className="bg-base-300 px-1 rounded">retryAfter</code> field (in seconds)
              when rate limited.
            </p>

            {/* ═══════════════════════════════════════════════ */}
            {/* ERROR HANDLING */}
            {/* ═══════════════════════════════════════════════ */}
            <SectionHeading
              id="errors"
              icon={<AlertTriangle size={20} />}
              title="Error Handling"
              subtitle="Standard error response format"
            />

            <p className="text-sm mb-3">
              All errors return a JSON object with an <code className="bg-base-300 px-1 rounded">error</code> field:
            </p>

            <CopyBlock
              code={JSON.stringify({
                error: 'Missing required scope(s): wallet:adjust',
                requiredScopes: ['wallet:adjust'],
                grantedScopes: ['users:read']
              }, null, 2)}
            />

            <div className="overflow-x-auto mt-4">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td><code>400</code></td><td>Bad request — missing or invalid parameters</td></tr>
                  <tr><td><code>401</code></td><td>Unauthorized — invalid or missing API key</td></tr>
                  <tr><td><code>403</code></td><td>Forbidden — missing scope or classroom not authorized</td></tr>
                  <tr><td><code>404</code></td><td>Not found — resource doesn't exist</td></tr>
                  <tr><td><code>429</code></td><td>Rate limit exceeded</td></tr>
                  <tr><td><code>500</code></td><td>Internal server error</td></tr>
                </tbody>
              </table>
            </div>

            {/* ═══════════════════════════════════════════════ */}
            {/* USERS ENDPOINTS */}
            {/* ═══════════════════════════════════════════════ */}
            <SectionHeading
              id="endpoints-users"
              icon={<Users size={20} />}
              title="Users"
              subtitle="Match and list users in a classroom"
            />

            <EndpointCard
              method="POST"
              path="/api/integrations/users/match"
              scope="users:match"
              description="Match external user names to Prizeversity user IDs. Returns MongoDB ObjectIds that can be used with all other endpoints."
              requestBody={JSON.stringify({
                classroomId: '<classroom_id>',
                users: [
                  { name: 'Jane Doe', externalId: 'ext-123' },
                  { name: 'Doe, John', externalId: 'ext-456' },
                  { name: 'user@email.com', externalId: 'ext-789' }
                ]
              }, null, 2)}
              responseBody={JSON.stringify({
                matched: [
                  {
                    name: 'Jane Doe',
                    externalId: 'ext-123',
                    userId: '507f1f77bcf86cd799439011',
                    matchedName: 'Jane Doe',
                    email: 'jane@school.edu'
                  }
                ],
                unmatched: [
                  { name: 'Unknown User', externalId: 'ext-999', reason: 'No matching user found' }
                ],
                total: 3
              }, null, 2)}
              notes='Name matching supports: "First Last", "Last First", "Last, First", token matching, and email matching. The returned userId is a MongoDB ObjectId (not the short ID displayed in the UI).'
            />

            <EndpointCard
              method="GET"
              path="/api/integrations/users/list/:classroomId"
              scope="users:read"
              description="List all users in a classroom (students, admins, and teacher). Add ?fields=extended for detailed user data including balance, XP, badges, stats, groups, and more."
              responseBody={JSON.stringify({
                classroomId: '<classroom_id>',
                className: 'Class 101',
                users: [
                  { userId: '507f1f77bcf86cd799439011', name: 'Jane Doe', email: 'jane@school.edu' },
                  { userId: '507f1f77bcf86cd799439012', name: 'John Smith', email: 'john@school.edu' }
                ]
              }, null, 2)}
              notes="Without query parameters, returns only userId, name, and email. Use the role field to distinguish students, admins, and the teacher."
            >
              <div className="space-y-3 text-sm">
                <p className="font-semibold">Query Parameters:</p>
                <div className="overflow-x-auto">
                  <table className="table table-xs">
                    <thead>
                      <tr>
                        <th>Parameter</th>
                        <th>Value</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><code>fields</code></td>
                        <td><code>extended</code></td>
                        <td>Returns detailed user data (see fields below)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p className="font-semibold">Extended Response Fields <span className="font-normal opacity-60">(when <code>?fields=extended</code>)</span>:</p>
                <div className="overflow-x-auto">
                  <table className="table table-xs">
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Type</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td><code>shortId</code></td><td>String</td><td>Short display ID (e.g. <code>YM1234</code>)</td></tr>
                      <tr><td><code>firstName</code>, <code>lastName</code></td><td>String</td><td>Separated name fields</td></tr>
                      <tr><td><code>role</code></td><td>String</td><td><code>"student"</code>, <code>"admin"</code>, or <code>"teacher"</code></td></tr>
                      <tr><td><code>balance</code></td><td>Number</td><td>Current bit balance</td></tr>
                      <tr><td><code>totalSpent</code></td><td>Number</td><td>Total bits spent (excludes teacher/admin adjustments)</td></tr>
                      <tr><td><code>joinedDate</code></td><td>Date</td><td>When the user joined the classroom</td></tr>
                      <tr><td><code>lastAccessed</code></td><td>Date</td><td>Last time the user accessed the classroom</td></tr>
                      <tr><td><code>totalActivitySeconds</code></td><td>Number</td><td>Total tracked activity time in seconds</td></tr>
                      <tr><td><code>level</code></td><td>Number</td><td>Current level</td></tr>
                      <tr><td><code>xp</code></td><td>Number</td><td>Current XP</td></tr>
                      <tr><td><code>xpProgress</code></td><td>Object</td><td>XP progress with <code>xpForCurrentLevel</code>, <code>xpForNextLevel</code>, <code>xpInCurrentLevel</code>, <code>xpRequiredForLevel</code>, <code>xpNeeded</code>, <code>progress</code> (0–1)</td></tr>
                      <tr><td><code>earnedBadges</code></td><td>Array</td><td>Earned badges: <code>badgeId</code>, <code>name</code>, <code>description</code>, <code>icon</code>, <code>image</code>, <code>levelRequired</code>, <code>earnedAt</code>, <code>rewards</code> (only non-zero: <code>bits</code>, <code>multiplier</code>, <code>luck</code>, <code>discount</code>, <code>shield</code>)</td></tr>
                      <tr><td><code>equippedBadge</code></td><td>Object | null</td><td>Currently equipped badge: <code>badgeId</code>, <code>name</code>, <code>icon</code>, <code>image</code></td></tr>
                      <tr><td><code>nextBadge</code></td><td>Object | null</td><td>Next unearned badge progress: <code>badgeId</code>, <code>name</code>, <code>icon</code>, <code>image</code>, <code>levelRequired</code>, <code>levelsUntilBadge</code>, <code>xpUntilBadge</code>, <code>progress</code> (0–1), <code>rewards</code> (only non-zero: <code>bits</code>, <code>multiplier</code>, <code>luck</code>, <code>discount</code>, <code>shield</code>)</td></tr>
                      <tr><td><code>stats</code></td><td>Object</td><td><code>luck</code>, <code>multiplier</code>, <code>groupMultiplier</code>, <code>shieldActive</code>, <code>shieldCount</code>, <code>attackPower</code>, <code>doubleEarnings</code>, <code>discountShop</code>, <code>passiveItemsCount</code></td></tr>
                      <tr><td><code>groups</code></td><td>Array</td><td>Group memberships: <code>groupSetId</code>, <code>groupSetName</code>, <code>groupId</code>, <code>groupName</code></td></tr>
                      <tr><td><code>isBanned</code></td><td>Boolean</td><td>Only present if user is banned</td></tr>
                      <tr><td><code>banReason</code>, <code>bannedAt</code></td><td>String, Date</td><td>Only present if user is banned</td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="alert alert-warning text-xs mt-2">
                  <AlertTriangle size={14} />
                  <span><code>totalSpent</code> excludes direct teacher/admin balance adjustments to reflect only actual store purchases.</span>
                </div>
              </div>
            </EndpointCard>

            {/* ═══════════════════════════════════════════════ */}
            {/* WALLET ENDPOINTS */}
            {/* ═══════════════════════════════════════════════ */}
            <SectionHeading
              id="endpoints-wallet"
              icon={<Wallet size={20} />}
              title="Wallet"
              subtitle="Adjust user bit balances"
            />

            <EndpointCard
              method="POST"
              path="/api/integrations/wallet/adjust"
              scope="wallet:adjust"
              description="Bulk adjust bit balances for multiple users. Supports group and personal multipliers."
              requestBody={JSON.stringify({
                classroomId: '<classroom_id>',
                updates: [
                  { userId: '<user_mongo_id_1>', amount: 10 },
                  { userId: '<user_mongo_id_2>', amount: -5 },
                  { userId: '<user_mongo_id_3>', amount: 25 }
                ],
                description: 'Weekly reward from ExtRewardTool',
                applyGroupMultipliers: true,
                applyPersonalMultipliers: true
              }, null, 2)}
              responseBody={JSON.stringify({
                message: '3 updated, 0 skipped',
                updated: 3,
                skipped: [],
                details: [
                  {
                    userId: '<user_id_1>',
                    name: 'Jane Doe',
                    baseAmount: 10,
                    finalAmount: 12,
                    multiplier: 1.2,
                    personalMultiplier: 1.1,
                    groupMultiplier: 1.1
                  }
                ]
              }, null, 2)}
            >
              <div className="space-y-2 text-sm">
                <p className="font-semibold">Parameters:</p>
                <div className="overflow-x-auto">
                  <table className="table table-xs">
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Type</th>
                        <th>Required</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><code>classroomId</code></td>
                        <td>String</td>
                        <td>✅</td>
                        <td>Classroom MongoDB ObjectId</td>
                      </tr>
                      <tr>
                        <td><code>updates</code></td>
                        <td>Array</td>
                        <td>✅</td>
                        <td>Array of <code>{`{ userId, amount }`}</code> objects</td>
                      </tr>
                      <tr>
                        <td><code>updates[].userId</code></td>
                        <td>String</td>
                        <td>✅</td>
                        <td>User's MongoDB ObjectId (24-char hex string, <strong>not</strong> the short ID like <code>YM1234</code>). Use the <code>/users/match</code> or <code>/users/list</code> endpoint to retrieve these IDs.</td>
                      </tr>
                      <tr>
                        <td><code>updates[].amount</code></td>
                        <td>Number</td>
                        <td>✅</td>
                        <td>Positive to credit, negative to debit. Cannot be 0.</td>
                      </tr>
                      <tr>
                        <td><code>description</code></td>
                        <td>String</td>
                        <td>No</td>
                        <td>Transaction description shown in user wallet history</td>
                      </tr>
                      <tr>
                        <td><code>applyGroupMultipliers</code></td>
                        <td>Boolean</td>
                        <td>No</td>
                        <td>Default: <code>true</code>. Apply group multipliers to positive amounts.</td>
                      </tr>
                      <tr>
                        <td><code>applyPersonalMultipliers</code></td>
                        <td>Boolean</td>
                        <td>No</td>
                        <td>Default: <code>true</code>. Apply personal multipliers to positive amounts.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="alert alert-warning text-xs mt-2">
                  <AlertTriangle size={14} />
                  <span>Multipliers are only applied to positive amounts (credits). Debits are applied at face value.</span>
                </div>
              </div>
            </EndpointCard>

            {/* ═══════════════════════════════════════════════ */}
            {/* CLASSROOM ENDPOINTS */}
            {/* ═══════════════════════════════════════════════ */}
            <SectionHeading
              id="endpoints-classroom"
              icon={<Package size={20} />}
              title="Classroom"
              subtitle="Read classroom metadata, settings, and structure"
            />

            <EndpointCard
              method="GET"
              path="/api/integrations/classroom/:classroomId"
              scope="classroom:read"
              description="Get classroom information. Add ?fields=extended for full classroom data including group sets, bazaars & items (with mystery box config), badges, admin/TA policies, and XP settings."
              responseBody={JSON.stringify({
                _id: '<classroom_id>',
                name: 'Class 101 - Intro to CS',
                code: 'ABC123',
                userCount: 32
              }, null, 2)}
              notes="Without query parameters, returns only basic info. Use ?fields=extended to include the full classroom structure."
            >
              <div className="space-y-3 text-sm">
                <p className="font-semibold">Query Parameters:</p>
                <div className="overflow-x-auto">
                  <table className="table table-xs">
                    <thead>
                      <tr>
                        <th>Parameter</th>
                        <th>Value</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><code>fields</code></td>
                        <td><code>extended</code></td>
                        <td>Returns full classroom data (see sections below)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p className="font-semibold">Extended Response Fields <span className="font-normal opacity-60">(when <code>?fields=extended</code>)</span>:</p>

                {/* Basic Info */}
                <p className="font-semibold text-xs opacity-70 mt-4">Basic Info</p>
                <div className="overflow-x-auto">
                  <table className="table table-xs">
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Type</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td><code>color</code></td><td>String</td><td>Classroom theme color</td></tr>
                      <tr><td><code>backgroundImage</code></td><td>String</td><td>Optional background image path</td></tr>
                      <tr><td><code>archived</code></td><td>Boolean</td><td>Whether the classroom is archived</td></tr>
                      <tr><td><code>createdAt</code></td><td>Date</td><td>Classroom creation date</td></tr>
                      <tr><td><code>teacher</code></td><td>Object</td><td><code>userId</code>, <code>name</code>, <code>email</code></td></tr>
                      <tr><td><code>admins</code></td><td>Array</td><td>Admin/TA list with <code>userId</code>, <code>name</code>, <code>email</code></td></tr>
                    </tbody>
                  </table>
                </div>

                {/* Group Sets */}
                <p className="font-semibold text-xs opacity-70 mt-4">Group Sets &amp; Groups <span className="font-normal">(<code>groupSets</code>)</span></p>
                <div className="overflow-x-auto">
                  <table className="table table-xs">
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Type</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td><code>name</code></td><td>String</td><td>Group set name</td></tr>
                      <tr><td><code>selfSignup</code></td><td>Boolean</td><td>Whether students can self-join</td></tr>
                      <tr><td><code>joinApproval</code></td><td>Boolean</td><td>Whether joining requires approval</td></tr>
                      <tr><td><code>maxMembers</code></td><td>Number | null</td><td>Max members per group</td></tr>
                      <tr><td><code>groupMultiplierIncrement</code></td><td>Number</td><td>Multiplier increment per member</td></tr>
                      <tr><td><code>groups[].name</code></td><td>String</td><td>Group name</td></tr>
                      <tr><td><code>groups[].groupMultiplier</code></td><td>Number</td><td>Current group multiplier</td></tr>
                      <tr><td><code>groups[].isAutoMultiplier</code></td><td>Boolean</td><td>Whether multiplier is auto-calculated</td></tr>
                      <tr><td><code>groups[].members[]</code></td><td>Array</td><td><code>userId</code>, <code>name</code>, <code>email</code>, <code>status</code>, <code>joinDate</code></td></tr>
                    </tbody>
                  </table>
                </div>

                {/* Bazaars */}
                <p className="font-semibold text-xs opacity-70 mt-4">Bazaars &amp; Items <span className="font-normal">(<code>bazaars</code>)</span></p>
                <div className="overflow-x-auto">
                  <table className="table table-xs">
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Type</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td><code>name</code>, <code>description</code>, <code>image</code></td><td>String</td><td>Bazaar info</td></tr>
                      <tr><td><code>items[].name</code></td><td>String</td><td>Item name</td></tr>
                      <tr><td><code>items[].price</code></td><td>Number</td><td>Item price</td></tr>
                      <tr><td><code>items[].category</code></td><td>String</td><td><code>Attack</code>, <code>Defend</code>, <code>Utility</code>, <code>Passive</code>, or <code>MysteryBox</code></td></tr>
                      <tr><td><code>items[].primaryEffect</code></td><td>String</td><td>Primary effect type</td></tr>
                      <tr><td><code>items[].primaryEffectValue</code></td><td>Number</td><td>Effect value</td></tr>
                      <tr><td><code>items[].secondaryEffects</code></td><td>Array</td><td>Additional effects</td></tr>
                      <tr><td><code>items[].swapOptions</code></td><td>Array</td><td>Swap/nullify options</td></tr>
                      <tr><td><code>items[].mysteryBoxConfig</code></td><td>Object</td><td>Only for <code>MysteryBox</code> items (see below)</td></tr>
                    </tbody>
                  </table>
                </div>

                {/* Mystery Box */}
                <p className="font-semibold text-xs opacity-70 mt-4">Mystery Box Config <span className="font-normal">(<code>items[].mysteryBoxConfig</code> — MysteryBox items only)</span></p>
                <div className="overflow-x-auto">
                  <table className="table table-xs">
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Type</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td><code>luckMultiplier</code></td><td>Number</td><td>Luck stat multiplier applied to drop chances</td></tr>
                      <tr><td><code>pityEnabled</code></td><td>Boolean</td><td>Whether pity system is active</td></tr>
                      <tr><td><code>guaranteedItemAfter</code></td><td>Number</td><td>Guaranteed rare+ drop after N opens (pity)</td></tr>
                      <tr><td><code>pityMinimumRarity</code></td><td>String</td><td>Minimum rarity for pity drops (<code>uncommon</code> / <code>rare</code> / <code>epic</code> / <code>legendary</code>)</td></tr>
                      <tr><td><code>itemPool[]</code></td><td>Array</td><td>Pool items with <code>item</code> (populated: <code>_id</code>, <code>name</code>, <code>description</code>, <code>price</code>, <code>image</code>, <code>category</code>), <code>rarity</code>, <code>baseDropChance</code></td></tr>
                    </tbody>
                  </table>
                </div>

                {/* Badges */}
                <p className="font-semibold text-xs opacity-70 mt-4">Badges <span className="font-normal">(<code>badges</code>)</span></p>
                <div className="overflow-x-auto">
                  <table className="table table-xs">
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Type</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td><code>name</code></td><td>String</td><td>Badge name</td></tr>
                      <tr><td><code>description</code></td><td>String</td><td>Badge description</td></tr>
                      <tr><td><code>icon</code></td><td>String</td><td>Badge emoji icon</td></tr>
                      <tr><td><code>image</code></td><td>String</td><td>Badge image path</td></tr>
                      <tr><td><code>levelRequired</code></td><td>Number</td><td>Level needed to unlock</td></tr>
                      <tr><td><code>rewards</code></td><td>Object</td><td><code>bits</code>, <code>multiplier</code>, <code>luck</code>, <code>discount</code>, <code>shield</code>, <code>applyPersonalMultiplier</code>, <code>applyGroupMultiplier</code></td></tr>
                    </tbody>
                  </table>
                </div>

                {/* Announcements */}
                <p className="font-semibold text-xs opacity-70 mt-4">Announcements <span className="font-normal">(<code>announcements</code>)</span></p>
                <div className="overflow-x-auto">
                  <table className="table table-xs">
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Type</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td><code>content</code></td><td>String</td><td>Announcement text / HTML content</td></tr>
                      <tr><td><code>attachments[]</code></td><td>Array</td><td><code>filename</code>, <code>originalName</code>, <code>url</code></td></tr>
                      <tr><td><code>author</code></td><td>Object</td><td><code>userId</code>, <code>name</code>, <code>email</code></td></tr>
                      <tr><td><code>createdAt</code></td><td>Date</td><td>When the announcement was posted</td></tr>
                    </tbody>
                  </table>
                </div>

                {/* Feedbacks */}
                <p className="font-semibold text-xs opacity-70 mt-4">Feedbacks <span className="font-normal">(<code>feedbacks</code>)</span></p>
                <div className="overflow-x-auto">
                  <table className="table table-xs">
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Type</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td><code>rating</code></td><td>Number</td><td>Rating from 1–5</td></tr>
                      <tr><td><code>comment</code></td><td>String | null</td><td>Feedback comment</td></tr>
                      <tr><td><code>anonymous</code></td><td>Boolean</td><td>Whether feedback was submitted anonymously</td></tr>
                      <tr><td><code>author</code></td><td>Object | null</td><td><code>userId</code>, <code>name</code>, <code>email</code> — <code>null</code> when anonymous</td></tr>
                      <tr><td><code>createdAt</code></td><td>Date</td><td>When the feedback was submitted</td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="alert alert-info text-xs mt-2">
                  <Info size={14} />
                  <span>Hidden feedbacks are excluded. Anonymous feedbacks have <code>author: null</code>. Feedback reward settings are included under <code>policies</code> below.</span>
                </div>

                {/* Policies */}
                <p className="font-semibold text-xs opacity-70 mt-4">Admin / TA Policies <span className="font-normal">(<code>policies</code>)</span></p>
                <div className="overflow-x-auto">
                  <table className="table table-xs">
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Type</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td><code>taBitPolicy</code></td><td>String</td><td><code>full</code>, <code>approval</code>, or <code>none</code></td></tr>
                      <tr><td><code>taGroupPolicy</code></td><td>String</td><td><code>full</code> or <code>none</code></td></tr>
                      <tr><td><code>taFeedbackPolicy</code></td><td>String</td><td><code>full</code> or <code>none</code></td></tr>
                      <tr><td><code>taStatsPolicy</code></td><td>String</td><td><code>full</code> or <code>none</code></td></tr>
                      <tr><td><code>siphonTimeoutHours</code></td><td>Number</td><td>Siphon request timeout (1–168 hrs)</td></tr>
                      <tr><td><code>studentSendEnabled</code></td><td>Boolean</td><td>Whether students can send bits to each other</td></tr>
                      <tr><td><code>studentsCanViewStats</code></td><td>Boolean</td><td>Whether students can view their own stats</td></tr>
                      <tr><td><code>feedbackRewardEnabled</code></td><td>Boolean</td><td>Whether feedback submission gives bit rewards</td></tr>
                      <tr><td><code>feedbackRewardBits</code></td><td>Number</td><td>Bits awarded per feedback submission</td></tr>
                      <tr><td><code>feedbackRewardApplyGroupMultipliers</code></td><td>Boolean</td><td>Apply group multiplier to feedback reward</td></tr>
                      <tr><td><code>feedbackRewardApplyPersonalMultipliers</code></td><td>Boolean</td><td>Apply personal multiplier to feedback reward</td></tr>
                      <tr><td><code>feedbackRewardAllowAnonymous</code></td><td>Boolean</td><td>Award bits even for anonymous feedback</td></tr>
                    </tbody>
                  </table>
                </div>

                {/* XP Settings */}
                <p className="font-semibold text-xs opacity-70 mt-4">XP Settings <span className="font-normal">(<code>xpSettings</code>)</span></p>
                <div className="overflow-x-auto">
                  <table className="table table-xs">
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Type</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td><code>enabled</code></td><td>Boolean</td><td>Whether XP system is active</td></tr>
                      <tr><td><code>bitsEarned</code></td><td>Number</td><td>XP per bit earned</td></tr>
                      <tr><td><code>bitsSpent</code></td><td>Number</td><td>XP per bit spent</td></tr>
                      <tr><td><code>statIncrease</code></td><td>Number</td><td>XP per stat increase</td></tr>
                      <tr><td><code>dailyCheckIn</code></td><td>Number</td><td>XP per daily check-in</td></tr>
                      <tr><td><code>challengeCompletion</code></td><td>Number</td><td>XP per challenge completed</td></tr>
                      <tr><td><code>mysteryBox</code></td><td>Number</td><td>XP per mystery box use</td></tr>
                      <tr><td><code>groupJoin</code></td><td>Number</td><td>XP for joining a group</td></tr>
                      <tr><td><code>badgeUnlock</code></td><td>Number</td><td>XP per badge unlocked</td></tr>
                      <tr><td><code>feedbackSubmission</code></td><td>Number</td><td>XP per feedback submitted</td></tr>
                      <tr><td><code>levelingFormula</code></td><td>String</td><td><code>linear</code>, <code>exponential</code>, or <code>logarithmic</code></td></tr>
                      <tr><td><code>baseXPForLevel2</code></td><td>Number</td><td>Base XP required for level 2</td></tr>
                      <tr><td><code>bitsXPBasis</code></td><td>String</td><td><code>final</code> (includes multipliers) or <code>base</code></td></tr>
                      <tr><td><code>levelUpRewards</code></td><td>Object</td><td><code>enabled</code>, <code>bitsPerLevel</code>, <code>scaleBitsByLevel</code>, <code>applyPersonalMultiplier</code>, <code>applyGroupMultiplier</code>, <code>multiplierPerLevel</code>, <code>luckPerLevel</code>, <code>discountPerLevel</code>, <code>shieldAtLevels</code>, <code>countBitsTowardXP</code>, <code>countStatsTowardXP</code></td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </EndpointCard>

            {/* ═══════════════════════════════════════════════ */}
            {/* INVENTORY ENDPOINTS */}
            {/* ═══════════════════════════════════════════════ */}
            <SectionHeading
              id="endpoints-inventory"
              icon={<Package size={20} />}
              title="Inventory"
              subtitle="Read and redeem user inventory items"
            />

            <EndpointCard
              method="GET"
              path="/api/integrations/inventory/:userId"
              scope="inventory:read"
              description="List all non-consumed inventory items for a user in a specific classroom. Use the returned item _id values with the redeem endpoint."
              requestBody={null}
              responseBody={JSON.stringify({
                userId: '<user_id>',
                classroomId: '<classroom_id>',
                items: [
                  {
                    _id: '68a3f123zyf456def7890123',
                    name: '5 Points Extra Credit',
                    description: 'Redeem for 5 extra credit points',
                    category: 'Passive',
                    price: 50,
                    active: false,
                    consumed: false,
                    usesRemaining: 1
                  },
                  {
                    _id: '68a4f456dbc789def0123456',
                    name: 'Luck Boost',
                    description: '+2 Luck passive effect',
                    category: 'Passive',
                    price: 10,
                    active: true,
                    consumed: false,
                    usesRemaining: 1
                  }
                ]
              }, null, 2)}
              notes="Requires classroomId as a query parameter: /api/integrations/inventory/:userId?classroomId=<classroom_id>. Only returns items that belong to the specified classroom's bazaar and have not been consumed."
            />

            <EndpointCard
              method="POST"
              path="/api/integrations/inventory/redeem"
              scope="inventory:use"
              description="Mark a user's passive inventory item (with no secondary effects) as consumed after processing it externally (e.g., after applying extra credit in an LMS system). This prevents the item from being processed again on subsequent inventory reads."
              requestBody={JSON.stringify({
                classroomId: '<classroom_id>',
                userId: '<user_id>',
                itemId: '<item_id>',
                redemptionData: {
                  type: 'extra_credit',
                  assignment: 'Midterm Exam',
                  points: 5
                }
              }, null, 2)}
              responseBody={JSON.stringify({
                message: 'Item redeemed successfully',
                item: {
                  _id: '<item_id>',
                  name: '5 Points Extra Credit',
                  category: 'Passive',
                  redemptionData: {
                    type: 'extra_credit',
                    assignment: 'Midterm Exam',
                    points: 5
                  }
                }
              }, null, 2)}
              notes="This endpoint is designed for LMS bridge developers. Only passive items with no secondary effects (e.g., extra credit vouchers) can be redeemed through the API. Items with effects (Attack, Defend, Utility, MysteryBox, or Passive items with stat boosts) must be redeemed through the Prizeversity app to ensure effects, orders, and stats are properly recorded. The typical flow is: 1) Read the user's inventory, 2) Filter for effect-free passive items, 3) Process the item externally (e.g., update a grade in the LMS system), 4) Call this endpoint to mark it as consumed."
            />

            {/* ═══════════════════════════════════════════════ */}
            {/* WEBHOOKS */}
            {/* ═══════════════════════════════════════════════ */}
            <SectionHeading
              id="webhooks"
              icon={<Bell size={20} />}
              title="Webhooks"
              subtitle="Receive real-time event notifications"
            />

            <div className="alert alert-warning mb-4 text-sm">
              <AlertTriangle size={16} />
              <div>
                <span className="font-semibold">Beta Feature:</span>{' '}
                Webhooks are currently in beta preview. Delivery behavior and payload format may change.
                If you encounter issues, please <a href="#need-help" className="link link-primary">contact us</a>.
              </div>
            </div>

            <p className="text-sm mb-4">
              Webhooks allow your application to receive HTTP POST requests when events occur
              in Prizeversity. Webhooks are configured per integration app from the{' '}
              <Link to="/integrations" className="link link-primary">Integrations</Link> page.
            </p>

            <h3 className="font-semibold text-sm mb-2">Available Events</h3>
            <div className="overflow-x-auto mb-4">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Triggered When</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['wallet.updated', 'A user\'s bit balance changes'],
                    ['item.purchased', 'A user buys an item from the bazaar'],
                    ['item.redeemed', 'An inventory item is redeemed/used'],
                    ['challenge.completed', 'A user completes a challenge'],
                    ['level.up', 'A user levels up'],
                    ['badge.earned', 'A user unlocks a badge'],
                  ].map(([event, desc]) => (
                    <tr key={event}>
                      <td><code className="text-xs">{event}</code></td>
                      <td className="text-sm opacity-70">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="font-semibold text-sm mb-2">Webhook Payload Format</h3>
            <CopyBlock
              code={JSON.stringify({
                event: 'item.redeemed',
                classroomId: '<classroom_id>',
                timestamp: '2025-01-15T10:30:00.000Z',
                appId: 'pv_abc123def456',
                data: {
                  userId: '<user_id>',
                  itemId: '<item_id>',
                  itemName: '5 Points Extra Credit',
                  itemCategory: 'Passive',
                  redemptionData: {
                    type: 'extra_credit',
                    assignment: 'Midterm Exam',
                    points: 5
                  }
                }
              }, null, 2)}
            />

            <h3 className="font-semibold text-sm mt-6 mb-2">Signature Verification</h3>
            <p className="text-sm mb-3">
              Each webhook request includes an <code className="bg-base-300 px-1 rounded">X-Prizeversity-Signature</code> header
              containing an HMAC-SHA256 signature of the request body, using the webhook's signing secret.
              Always verify this signature to ensure the request is authentic.
            </p>

            <CopyBlock
              code={`// Node.js signature verification example
const crypto = require('crypto');

function verifyWebhook(req, secret) {
  const signature = req.headers['x-prizeversity-signature'];
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// Express middleware
app.post('/webhook', (req, res) => {
  if (!verifyWebhook(req, process.env.WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  const { event, data } = req.body;
  console.log(\`Received \${event}:\`, data);
  
  // Process the event...
  
  res.status(200).json({ received: true });
});`}
            />

            <h3 className="font-semibold text-sm mt-6 mb-2">Retry & Auto-Disable</h3>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr><th>Behavior</th><th>Details</th></tr>
                </thead>
                <tbody>
                  <tr><td>Timeout</td><td>10 seconds per delivery attempt</td></tr>
                  <tr><td>Retries</td><td>No automatic retries (fire-and-forget)</td></tr>
                  <tr><td>Auto-disable</td><td>After 10 consecutive failures, the webhook is automatically disabled</td></tr>
                  <tr><td>Re-enable</td><td>Manually re-enable from the Integrations page or delete and recreate</td></tr>
                </tbody>
              </table>
            </div>

            {/* ═══════════════════════════════════════════════ */}
            {/* QUICK START */}
            {/* ═══════════════════════════════════════════════ */}
            <SectionHeading
              id="quickstart"
              icon={<Zap size={20} />}
              title="Quick Start Guide"
              subtitle="Get up and running in 5 minutes"
            />

            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <span className="badge badge-primary badge-sm">1</span>
                  Create an Integration App
                </h3>
                <p className="text-sm mb-2">
                  A teacher creates an integration from the{' '}
                  <Link to="/integrations" className="link link-primary">Integrations page</Link>{' '}
                  and selects the classroom(s) and permissions the app needs.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <span className="badge badge-primary badge-sm">2</span>
                  Store the API Key
                </h3>
                <p className="text-sm mb-2">
                  Save the API key securely in your application's environment variables.
                  The key is shown only once.
                </p>
                <CopyBlock code={`# .env
PRIZEVERSITY_API_KEY=pvk_your_key_here
PRIZEVERSITY_CLASSROOM_ID=your_classroom_id
PRIZEVERSITY_BASE_URL=https://www.prizeversity.com`} />
              </div>

              <div>
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <span className="badge badge-primary badge-sm">3</span>
                  Match Users
                </h3>
                <p className="text-sm mb-2">
                  Map your app's user names to Prizeversity user IDs. The API returns
                  MongoDB ObjectIds (24-character hex strings like <code className="bg-base-300 px-1 rounded">68a4ez78af95ce2a82ad6ae0</code>),
                  <strong> not</strong> the short IDs shown in the UI (like <code className="bg-base-300 px-1 rounded">YM1234</code>).
                  Use <code className="bg-base-300 px-1 rounded">/users/match</code> or <code className="bg-base-300 px-1 rounded">/users/list</code> to
                  get the correct IDs before calling other endpoints.
                </p>
                <CopyBlock
                  code={`const response = await fetch(
  'https://www.prizeversity.com/api/integrations/users/match',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.PRIZEVERSITY_API_KEY,
    },
    body: JSON.stringify({
      classroomId: process.env.PRIZEVERSITY_CLASSROOM_ID,
      users: [
        { name: 'Jane Doe' },
        { name: 'John Smith' },
      ],
    }),
  }
);

const { matched, unmatched } = await response.json();
// matched[0].userId → use this for wallet adjustments`}
                />
              </div>

              <div>
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <span className="badge badge-primary badge-sm">4</span>
                  Adjust Wallet Balances
                </h3>
                <p className="text-sm mb-2">
                  Send bit adjustments using the matched user IDs:
                </p>
                <CopyBlock
                  code={`const response = await fetch(
  'https://www.prizeversity.com/api/integrations/wallet/adjust',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.PRIZEVERSITY_API_KEY,
    },
    body: JSON.stringify({
      classroomId: process.env.PRIZEVERSITY_CLASSROOM_ID,
      updates: matched.map(s => ({
        userId: s.userId,
        amount: 10, // bits to award
      })),
      description: 'Weekly participation reward',
    }),
  }
);

const result = await response.json();
console.log(\`\${result.updated} users rewarded!\`);`}
                />
              </div>

              <div>
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <span className="badge badge-primary badge-sm">5</span>
                  Read &amp; Redeem Inventory
                </h3>
                <p className="text-sm mb-2">
                  List a user's items, then redeem one by ID:
                </p>
                <CopyBlock
                  code={`// Step 1: List user's inventory
const invResponse = await fetch(
  \`\${BASE_URL}/api/integrations/inventory/\${userId}?classroomId=\${classroomId}\`,
  {
    headers: { 'X-API-Key': process.env.PRIZEVERSITY_API_KEY },
  }
);
const { items } = await invResponse.json();

// Step 2: Find redeemable items (passive, no effects)
// Only passive items without secondary effects can be redeemed via API
const redeemableItems = items.filter(i =>
  i.category === 'Passive' && (!i.secondaryEffects || i.secondaryEffects.length === 0)
);
const extraCreditItem = redeemableItems.find(i => i.name.includes('Extra Credit'));

// Step 3: Redeem it
if (extraCreditItem) {
  const redeemResponse = await fetch(
    \`\${BASE_URL}/api/integrations/inventory/redeem\`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.PRIZEVERSITY_API_KEY,
      },
      body: JSON.stringify({
        classroomId,
        userId,
        itemId: extraCreditItem._id,
        redemptionData: {
          type: 'extra_credit',
          assignment: 'Midterm Exam',
          points: 5
        }
      }),
    }
  );
  const result = await redeemResponse.json();
  console.log(result.message);
}`}
                />
              </div>

              <div>
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <CheckCircle size={16} className="text-success" />
                  Done!
                </h3>
                <p className="text-sm">
                  Users will see the bit adjustment in their wallet with real-time socket
                  updates. Group and personal multipliers are applied automatically to
                  positive amounts.
                </p>
              </div>
            </div>

            {/* Support footer */}
            <div id="need-help" className="card bg-base-200 mt-12 p-6 text-center scroll-mt-24">
              <p className="font-semibold mb-1">Need help?</p>
              <p className="text-sm opacity-70 mb-4">
                For integration support, contact us or check the teacher FAQ.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <a href="mailto:info@prizeversity.com" className="btn btn-primary btn-sm">
                  info@prizeversity.com
                </a>
                <Link to="/support#faq-integrations" className="btn btn-outline btn-sm">
                  Teacher FAQ
                </Link>
                <Link to="/integrations" className="btn btn-outline btn-sm gap-1">
                  <Plug size={14} />
                  Manage Integrations
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}