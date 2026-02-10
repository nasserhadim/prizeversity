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
    { id: 'webhooks', label: 'Webhooks' },
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
            <Link to="/support#faqs" className="link link-primary font-medium">
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
              classrooms, students, wallets, and inventory. All endpoints are available under:
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
                    ['wallet:adjust', 'Add or deduct bits from student wallets'],
                    ['users:match', 'Match student names to Prizeversity user IDs'],
                    ['users:read', 'List students enrolled in a classroom'],
                    ['classroom:read', 'Read classroom name, code, and metadata'],
                    ['inventory:read', 'View student inventory items'],
                    ['inventory:use', 'Mark inventory items as redeemed'],
                    ['lms:grades', 'Sync grades with external LMS'],
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
              subtitle="Match and list students in a classroom"
            />

            <EndpointCard
              method="POST"
              path="/api/integrations/users/match"
              scope="users:match"
              description="Match external student names to Prizeversity user IDs. Returns MongoDB ObjectIds that can be used with all other endpoints."
              requestBody={JSON.stringify({
                classroomId: '<classroom_id>',
                students: [
                  { name: 'Jane Doe', externalId: 'ext-123' },
                  { name: 'Doe, John', externalId: 'ext-456' },
                  { name: 'student@email.com', externalId: 'ext-789' }
                ]
              }, null, 2)}
              responseBody={JSON.stringify({
                matched: [
                  {
                    name: 'Jane Doe',
                    externalId: 'ext-123',
                    studentId: '507f1f77bcf86cd799439011',
                    matchedName: 'Jane Doe',
                    email: 'jane@school.edu'
                  }
                ],
                unmatched: [
                  { name: 'Unknown Student', externalId: 'ext-999', reason: 'No matching student found' }
                ],
                total: 3
              }, null, 2)}
              notes='Name matching supports: "First Last", "Last First", "Last, First", token matching, and email matching. The returned studentId is a MongoDB ObjectId (not the short ID displayed in the UI).'
            />

            <EndpointCard
              method="GET"
              path="/api/integrations/users/list/:classroomId"
              scope="users:read"
              description="List all students enrolled in a classroom. Returns MongoDB ObjectIds for each student."
              responseBody={JSON.stringify({
                classroomId: '<classroom_id>',
                className: 'Class 101',
                students: [
                  { studentId: '507f1f77bcf86cd799439011', name: 'Jane Doe', email: 'jane@school.edu' },
                  { studentId: '507f1f77bcf86cd799439012', name: 'John Smith', email: 'john@school.edu' }
                ]
              }, null, 2)}
            />

            {/* ═══════════════════════════════════════════════ */}
            {/* WALLET ENDPOINTS */}
            {/* ═══════════════════════════════════════════════ */}
            <SectionHeading
              id="endpoints-wallet"
              icon={<Wallet size={20} />}
              title="Wallet"
              subtitle="Adjust student bit balances"
            />

            <EndpointCard
              method="POST"
              path="/api/integrations/wallet/adjust"
              scope="wallet:adjust"
              description="Bulk adjust bit balances for multiple students. Supports group and personal multipliers."
              requestBody={JSON.stringify({
                classroomId: '<classroom_id>',
                updates: [
                  { studentId: '<student_mongo_id_1>', amount: 10 },
                  { studentId: '<student_mongo_id_2>', amount: -5 },
                  { studentId: '<student_mongo_id_3>', amount: 25 }
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
                    studentId: '<student_id_1>',
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
                        <td>Array of <code>{`{ studentId, amount }`}</code> objects</td>
                      </tr>
                      <tr>
                        <td><code>updates[].studentId</code></td>
                        <td>String</td>
                        <td>✅</td>
                        <td>Student's MongoDB ObjectId (24-char hex string, <strong>not</strong> the short ID like <code>YM1234</code>). Use the <code>/users/match</code> or <code>/users/list</code> endpoint to retrieve these IDs.</td>
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
                        <td>Transaction description shown in student wallet history</td>
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
              subtitle="Read classroom metadata"
            />

            <EndpointCard
              method="GET"
              path="/api/integrations/classroom/:classroomId"
              scope="classroom:read"
              description="Get basic classroom information."
              responseBody={JSON.stringify({
                _id: '<classroom_id>',
                name: 'Class 101 - Intro to CS',
                code: 'ABC123',
                studentCount: 32
              }, null, 2)}
            />

            {/* ═══════════════════════════════════════════════ */}
            {/* INVENTORY ENDPOINTS */}
            {/* ═══════════════════════════════════════════════ */}
            <SectionHeading
              id="endpoints-inventory"
              icon={<Package size={20} />}
              title="Inventory"
              subtitle="Read and redeem student inventory items"
            />

            <EndpointCard
              method="POST"
              path="/api/integrations/inventory/redeem"
              scope="inventory:use"
              description="Mark a student's inventory item as redeemed. Useful for triggering external actions like LMS grade updates."
              requestBody={JSON.stringify({
                classroomId: '<classroom_id>',
                studentId: '<student_id>',
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
              notes="A webhook event (item.redeemed) is dispatched when an item is redeemed, allowing external apps like an LMS bridge to process it automatically."
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
                    ['wallet.updated', 'A student\'s bit balance changes'],
                    ['item.purchased', 'A student buys an item from the bazaar'],
                    ['item.redeemed', 'An inventory item is redeemed/used'],
                    ['challenge.completed', 'A student completes a challenge'],
                    ['level.up', 'A student levels up'],
                    ['badge.earned', 'A student unlocks a badge'],
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
                  studentId: '<student_id>',
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
                  Match Students
                </h3>
                <p className="text-sm mb-2">
                  Map your app's student names to Prizeversity user IDs. The API returns
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
      students: [
        { name: 'Jane Doe' },
        { name: 'John Smith' },
      ],
    }),
  }
);

const { matched, unmatched } = await response.json();
// matched[0].studentId → use this for wallet adjustments`}
                />
              </div>

              <div>
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <span className="badge badge-primary badge-sm">4</span>
                  Adjust Wallet Balances
                </h3>
                <p className="text-sm mb-2">
                  Send bit adjustments using the matched student IDs:
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
        studentId: s.studentId,
        amount: 10, // bits to award
      })),
      description: 'Weekly participation reward',
    }),
  }
);

const result = await response.json();
console.log(\`\${result.updated} students rewarded!\`);`}
                />
              </div>

              <div>
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <CheckCircle size={16} className="text-success" />
                  Done!
                </h3>
                <p className="text-sm">
                  Students will see the bit adjustment in their wallet with real-time socket
                  updates. Group and personal multipliers are applied automatically to
                  positive amounts.
                </p>
              </div>
            </div>

            {/* Support footer */}
            <div className="card bg-base-200 mt-12 p-6 text-center">
              <p className="font-semibold mb-1">Need help?</p>
              <p className="text-sm opacity-70 mb-4">
                For integration support, contact us or check the teacher FAQ.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <a href="mailto:info@prizeversity.com" className="btn btn-primary btn-sm">
                  info@prizeversity.com
                </a>
                <Link to="/support#faqs" className="btn btn-outline btn-sm">
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