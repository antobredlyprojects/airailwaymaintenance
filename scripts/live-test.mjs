/* End-to-end verification: DB-backed credentials + demo-vs-real workspace. */
const BASE = "http://localhost:3000";

const SEED_IDS = [
  "REQ-20260818-0045", "REQ-20260818-0052", "REQ-20260818-0078",
  "REQ-20260818-0091", "REQ-20260818-0104", "REQ-20260819-0062",
  "REQ-20260818-0119",
];
const TEST_REQ_MARKERS = ["(live)", "Debug create", "REQ-20260818-9721", "REQ-20260818-7182", "REQ-20260818-1307"];

async function call(path, { method = "GET", token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function login(username, password) {
  const { status, json } = await call("/api/auth/login", {
    method: "POST",
    body: { username, password },
  });
  if (status !== 200) throw new Error(`login ${username} failed: ${status} ${JSON.stringify(json)}`);
  return json;
}

const results = [];
const check = (name, ok, extra = "") =>
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`);

// ---------- bootstrap ----------
const admin = await login("admin", "demo123");
// DRM sees everything and holds create_requests (admin may not delete per the matrix)
const cleanup = await login("drm", "demo123");

// Clean up artifacts from previous test runs (shared workspace)
const all = await call("/api/work-requests", { token: cleanup.token });
for (const r of all.json) {
  const isTest = TEST_REQ_MARKERS.some((m) => r.id.includes(m) || (r.title || "").includes(m));
  if (isTest) await call(`/api/work-requests/${r.id}`, { method: "DELETE", token: cleanup.token });
}

// Reuse or create the two provisioned (non-demo) accounts
async function ensureUser(username, password, payload) {
  let res = await call("/api/auth/login", { method: "POST", body: { username, password } });
  if (res.status === 200) return res.json;
  res = await call("/api/users", { method: "POST", token: admin.token, body: { ...payload, username, password } });
  if (res.status !== 201) throw new Error(`create ${username} failed: ${res.status} ${JSON.stringify(res.json)}`);
  return login(username, password);
}

// ---------- 1. demo account ----------
const demo = await login("section.engineer", "demo123");
let r = await call("/api/work-requests", { token: demo.token });
check("demo sees sample requests", r.json.some((x) => SEED_IDS.includes(x.id)), `${r.json.length} requests`);
r = await call("/api/conflicts", { token: demo.token });
check("demo sees sample conflicts", r.json.length > 0, `${r.json.length} conflicts`);

const bad = await call("/api/auth/login", { method: "POST", body: { username: "section.engineer", password: "wrong" } });
check("wrong password rejected (401)", bad.status === 401);

// ---------- 2. provisioned accounts ----------
const real = await ensureUser("se.ndls.real", "RealPass#123", {
  name: "Priya Verma", role: "SECTION_ENGINEER", department: "Engineering (P.Way)",
  designation: "Section Engineer (P.Way)", budget_limit: 50000, scope_tags: ["NDLS", "UP-125"],
});
check("provisioned user is not demo", real.user.demo === false);
check("provisioned login works with own credential", true, real.user.role);

r = await call("/api/work-requests", { token: real.token });
check("provisioned user sees ZERO sample requests", r.json.length === 0, `${r.json.length} requests`);
r = await call("/api/conflicts", { token: real.token });
check("provisioned user sees ZERO sample conflicts", r.json.length === 0, `${r.json.length} conflicts`);
r = await call("/api/possessions", { token: real.token });
check("provisioned user sees ZERO sample possessions", r.json.length === 0, `${r.json.length} possessions`);
r = await call("/api/notifications", { token: real.token });
check("provisioned user sees ZERO sample notifications", r.json.length === 0, `${r.json.length} notifications`);

// ---------- 3. workspace fills via request + approve ----------
const newReq = {
  title: "Track tamping — NDLS section (live)",
  type: "TRACK_TAMPING",
  priority: "HIGH",
  status: "PENDING",
  location: { type: "TRACK_SECTION", section_id: "UP-125.6-126.0", chainage_start: 125.6, chainage_end: 126.0, track_number: "UP", station_proximity: "NDLS" },
  duration: { start_time: "2026-08-20T02:00:00Z", end_time: "2026-08-20T04:00:00Z", setup_time: 30, teardown_time: 15 },
  resources: { personnel: [{ gang_id: "GANG-002", role: "GANG_MATE", count: 1 }], equipment: [], engineering_train: null },
  constraints: { time_window: { earliest_start: "2026-08-20T01:30:00Z", latest_end: "2026-08-20T05:30:00Z" }, safety: { possession_type: "FULL_BLOCK", requires_earthing: false, requires_ohe_shutdown: false }, dependencies: { prerequisites: [], successors: [] }, compatibility: { incompatible_with: [] } },
  metadata: { notes: "Live-workspace verification request" },
};
r = await call("/api/work-requests", { method: "POST", token: real.token, body: newReq });
const realReqId = r.json.request?.id;
check("request create succeeds (201)", r.status === 201 && !!realReqId, realReqId);

r = await call("/api/work-requests", { token: real.token });
check("request appears in provisioned user's workspace", r.json.length === 1 && r.json[0].id === realReqId, `${r.json.length} request(s)`);

r = await call("/api/approvals", { token: real.token });
check("provisioned approval queue has it", r.json.length === 1, `${r.json.length} pending`);
r = await call(`/api/work-requests/${realReqId}/decision`, { method: "POST", token: real.token, body: { decision: "APPROVED", note: "Approved in live workspace" } });
check("approval succeeds (status flips)", r.status === 200 && r.json.request?.status === "APPROVED", r.json.request?.status);

// ---------- 4. second provisioned (unscoped ADE) shares real workspace only ----------
const ade = await ensureUser("ade.real", "AdePass#456", {
  name: "Sanjay Gupta", role: "ADE", department: "Engineering (P.Way)",
  designation: "Assistant Divisional Engineer (P.Way)", scope_tags: [],
});
r = await call("/api/work-requests", { token: ade.token });
check("provisioned ADE sees no sample requests", r.json.every((x) => !SEED_IDS.includes(x.id)), `${r.json.length} requests, all real`);
check("provisioned ADE sees the shared real request", r.json.some((x) => x.id === realReqId), "");
r = await call("/api/conflicts", { token: ade.token });
check("provisioned ADE sees no sample conflicts", r.json.every((c) => c.work_requests.some((rid) => !SEED_IDS.includes(rid))), `${r.json.length} conflicts, none sample`);

// ---------- 5. audit trail ----------
r = await call("/api/audit", { token: admin.token });
const logins = r.json.filter((e) => e.action === "LOGIN");
check("audit records this session's logins", logins.length >= 3, `${logins.length} login events`);

console.log(results.join("\n"));
const failed = results.filter((x) => x.startsWith("FAIL"));
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
