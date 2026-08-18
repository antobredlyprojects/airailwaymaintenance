const BASE = "http://localhost:3000";

const login = async (u, p = "demo123") => {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: u, password: p }),
  });
  return { status: r.status, ...(await r.json()) };
};

const get = async (path, token) => {
  const r = await fetch(BASE + path, { headers: { Authorization: `Bearer ${token}` } });
  return { status: r.status, body: await r.json() };
};

const post = async (path, token, body) => {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
};

(async () => {
  const anon = await fetch(`${BASE}/api/work-requests`);
  console.log("1. anonymous GET /api/work-requests ->", anon.status, "(expect 401)");

  const gm = await login("gangmate");
  console.log("2. gangmate login ->", gm.status, gm.user?.role);
  const gmReqs = await get("/api/work-requests", gm.token);
  console.log("   gangmate sees", gmReqs.body.length, "requests (GANG-001 scope)");

  const se = await login("section.engineer");
  const seReqs = await get("/api/work-requests", se.token);
  console.log("3. section.engineer sees", seReqs.body.length, "requests (NDLS/TKJ scope)");
  const seApprovals = await get("/api/approvals", se.token);
  console.log("   approvals queue:", seApprovals.body.length, "pending");

  const drm = await login("drm");
  const drmReqs = await get("/api/work-requests", drm.token);
  console.log("4. drm sees", drmReqs.body.length, "requests (expect ALL)");

  const pend = seApprovals.body[0];
  if (pend) {
    const dec = await post(`/api/work-requests/${pend.id}/decision`, se.token, {
      decision: "APPROVED",
      note: "Verified safety arrangement",
    });
    console.log("5. approve", pend.id, "->", dec.status, dec.body.request?.status);
  }

  const sc = await login("section.controller");
  const poss = await get("/api/possessions", sc.token);
  console.log("6. controller possession queue:", poss.body.length, "items; first:", poss.body[0]?.decision);
  if (poss.body[0]) {
    const dec = await post(`/api/possessions/${poss.body[0].possession_id}/decision`, sc.token, {
      decision: "APPROVED",
    });
    console.log("   approve possession ->", dec.status, dec.body.decision);
  }

  const aud = await login("auditor");
  const trail = await get("/api/audit", aud.token);
  console.log("7. auditor audit events:", trail.body.length);
  const forbidden = await post("/api/work-requests", aud.token, { title: "x" });
  console.log("   auditor create request ->", forbidden.status, "(expect 403)");

  const con = await login("contractor");
  const conBefore = await get("/api/work-requests", con.token);
  console.log("8. contractor sees before create:", conBefore.body.length, "(expect 0 — internal data hidden)");
  const payload = {
    title: "Contract rail grinding GZB loop",
    type: "RAIL_GRINDING",
    priority: "MEDIUM",
    status: "PENDING",
    location: { type: "TRACK_SECTION", section_id: "LOOP-1-128.0-128.4", chainage_start: 128.0, chainage_end: 128.4, track_number: "LOOP_1", station_proximity: "GZB", is_electrified: true },
    duration: { start_time: "2026-08-20T02:00:00.000Z", end_time: "2026-08-20T04:30:00.000Z", setup_time_mins: 15, teardown_time_mins: 10, estimated_duration_hours: 2.5 },
    resources: { personnel: [{ role: "GANG_MATE", count: 1 }, { role: "WORKER", count: 4 }], equipment: [{ type: "RAIL_GRINDER" }], engineering_train: null },
    constraints: {
      time_window: { earliest_start: "2026-08-20T01:30:00.000Z", latest_end: "2026-08-20T05:30:00.000Z", preferred_slots: ["02:00-04:30"], is_non_traffic_hours_mandatory: true },
      safety: { possession_type: "FULL_BLOCK", requires_earthing: false, requires_ohe_shutdown: false, requires_adjacent_caution: false },
      dependencies: { prerequisites: [], successors: [] },
      compatibility: { compatible_with: [], incompatible_with: [] },
    },
    metadata: { created_by: "", role: "", created_at: "", updated_at: "", source: "MANUAL", notes: "" },
  };
  const created = await post("/api/work-requests", con.token, payload);
  console.log("   contractor create ->", created.status, created.body.request?.id);
  const conAfter = await get("/api/work-requests", con.token);
  console.log("   contractor sees after create:", conAfter.body.length, "(expect 1 — only own work)");
  console.log("   contractor source:", created.body.request?.metadata?.source, "(expect EXTERNAL_CONTRACTOR)");
})().catch((e) => {
  console.error("TEST ERROR:", e.message);
  process.exit(1);
});
