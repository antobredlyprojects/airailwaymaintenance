-- ============================================================
-- RailSync AI — AI Railway Maintenance Scheduling Platform
-- Supabase schema (runnable in the Supabase SQL editor)
--
-- Part 1 (required — the app reads/writes these today):
--   work_requests, conflicts, master_schedules, audit_logs
-- Part 2 (ready for persistence — the rebuilt portal's auth/RBAC
--   and possession domain; users are currently seeded in code and
--   sessions / possession decisions live in memory, so these
--   tables are forward-compatible, not yet written by the app):
--   users, sessions, track_possessions
--
-- Mirrors SUPABASE_SQL_SCHEMA served by the app (single source).
-- ============================================================

-- ------------------------------------------------------------
-- 1. WORK REQUESTS — syncWorkRequestToSupabase() upserts here
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.work_requests (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  type        TEXT NOT NULL,
  priority    TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'PENDING',
  location    JSONB NOT NULL,
  duration    JSONB NOT NULL,
  resources   JSONB NOT NULL,
  constraints JSONB NOT NULL,
  metadata    JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_requests_status ON public.work_requests (status);
CREATE INDEX IF NOT EXISTS idx_work_requests_type   ON public.work_requests (type);

-- ------------------------------------------------------------
-- 2. CONFLICTS — syncConflictToSupabase() upserts here
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conflicts (
  id                     TEXT PRIMARY KEY,
  type                   TEXT NOT NULL,
  severity               TEXT NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'OPEN',
  description            TEXT NOT NULL,
  work_requests          TEXT[] NOT NULL DEFAULT '{}',
  resolution_suggestions TEXT[] NOT NULL DEFAULT '{}',
  override_justification TEXT,
  override_by            TEXT,
  detected_at            TIMESTAMPTZ DEFAULT NOW(),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conflicts_status ON public.conflicts (status);

-- ------------------------------------------------------------
-- 3. MASTER SCHEDULES — syncScheduleToSupabase() upserts here
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.master_schedules (
  id                    TEXT PRIMARY KEY,
  version               INTEGER NOT NULL,
  generated_at          TIMESTAMPTZ DEFAULT NOW(),
  work_assignments      JSONB NOT NULL,
  optimization_metadata JSONB NOT NULL
);

-- ------------------------------------------------------------
-- 4. AUDIT LOG — logAuditToSupabase() inserts here
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_role   TEXT,
  action_type TEXT NOT NULL,
  entity_id   TEXT,
  details     JSONB
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs (timestamp DESC);

-- ------------------------------------------------------------
-- 5. USERS — RBAC directory (mirrors SystemUser in
--    src/server/users.ts). The app seeds these in code today;
--    switch the auth service to read this table to persist
--    account management across restarts.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id           TEXT PRIMARY KEY,
  username     TEXT NOT NULL UNIQUE,
  password     TEXT NOT NULL,            -- demo plaintext only; hash (argon2/bcrypt) in production
  name         TEXT NOT NULL,
  role         TEXT NOT NULL,            -- GANG_MATE | SECTION_ENGINEER | DEPOT_ENGINEER | WORKSHOP_SUPERVISOR | ADE | SR_DME | SECTION_CONTROLLER | DRM | SYSTEM_ADMIN | DATA_ANALYST | CONTRACTOR | AUDITOR
  department   TEXT,
  designation  TEXT,
  current_location TEXT DEFAULT '',
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  scope        JSONB NOT NULL DEFAULT '{"tags": []}'::jsonb,
  budget_limit NUMERIC,                  -- INR approval ceiling; NULL = unlimited / not an approver
  permissions  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optional demo seed — mirrors SEED_USERS in src/server/users.ts.
-- Plaintext demo123 passwords are demo-only; uncomment to populate:
-- INSERT INTO public.users
--   (id, username, password, name, role, department, designation, active, scope, budget_limit, permissions)
-- VALUES
--   ('U-GM-001','gangmate','demo123','Ramesh Kumar','GANG_MATE','P.Way (Track)','Gang Mate / Junior Engineer',TRUE,
--    '{"tags":["GANG-001","TRACK_TAMPING","RAIL_RENEWAL","BALLAST_CLEANING","UP-125","DN-125"]}'::jsonb,0,
--    '{"create_requests":true,"view_schedules":true}'::jsonb),
--   ('U-SE-001','section.engineer','demo123','Amit Sharma','SECTION_ENGINEER','P.Way (Track)','Section Engineer (P.Way)',TRUE,
--    '{"tags":["NDLS","TKJ","UP-125","DN-125"]}'::jsonb,50000,
--    '{"create_requests":true,"approve_requests":true,"view_schedules":true,"view_budget":true}'::jsonb),
--   ('U-DE-001','depot.engineer','demo123','Suresh Patil','DEPOT_ENGINEER','Mechanical (C&W)','Depot Engineer (Coaching)',TRUE,
--    '{"tags":["COACH","SSB","BAY-IOH","DEPOT"]}'::jsonb,100000,
--    '{"create_requests":true,"approve_requests":true,"view_schedules":true,"view_budget":true}'::jsonb),
--   ('U-WS-001','workshop.supervisor','demo123','Vikram Singh','WORKSHOP_SUPERVISOR','Overhaul Workshop','Workshop Supervisor (POH)',TRUE,
--    '{"tags":["TKD","POH","WORKSHOP","WAGON"]}'::jsonb,500000,
--    '{"create_requests":true,"approve_requests":true,"view_schedules":true,"view_budget":true}'::jsonb),
--   ('U-ADE-001','ade.pway','demo123','Nandini Iyer','ADE','Engineering (P.Way)','Assistant Divisional Engineer (P.Way)',TRUE,
--    '{"tags":[]}'::jsonb,1000000,
--    '{"create_requests":true,"approve_requests":true,"view_schedules":true,"modify_schedules":true,"approve_possessions":true,"view_budget":true,"view_all":true}'::jsonb),
--   ('U-DME-001','srdme.cw','demo123','Rajiv Menon','SR_DME','Mechanical (C&W)','Sr. Divisional Mechanical Engineer (C&W)',TRUE,
--    '{"tags":[]}'::jsonb,2000000,
--    '{"create_requests":true,"approve_requests":true,"view_schedules":true,"modify_schedules":true,"view_budget":true,"view_all":true}'::jsonb),
--   ('U-DTM-001','section.controller','demo123','Meera Joshi','SECTION_CONTROLLER','Operating / Traffic','Divisional Traffic Manager / Section Controller',TRUE,
--    '{"tags":[]}'::jsonb,NULL,
--    '{"view_schedules":true,"modify_schedules":true,"approve_possessions":true,"view_all":true}'::jsonb),
--   ('U-DRM-001','drm','demo123','Arvind Rao','DRM','Executive Board','Divisional Railway Manager',TRUE,
--    '{"tags":[]}'::jsonb,10000000,
--    '{"create_requests":true,"approve_requests":true,"view_schedules":true,"modify_schedules":true,"approve_possessions":true,"view_budget":true,"approve_budget":true,"view_all":true}'::jsonb),
--   ('U-ADM-001','admin','demo123','Kavita Nair','SYSTEM_ADMIN','IT / Systems','System Administrator',TRUE,
--    '{"tags":[]}'::jsonb,NULL,
--    '{"manage_users":true,"view_schedules":true,"view_all":true}'::jsonb),
--   ('U-BI-001','analyst','demo123','Farhan Ali','DATA_ANALYST','Business Intelligence','Data Analyst',TRUE,
--    '{"tags":[]}'::jsonb,NULL,
--    '{"view_schedules":true,"view_budget":true,"view_all":true}'::jsonb),
--   ('U-CON-001','contractor','demo123','SteelGrip Rail Services Pvt Ltd','CONTRACTOR','External Contractor','Rail Grinding Contractor',TRUE,
--    '{"tags":["CONTRACTOR"]}'::jsonb,NULL,
--    '{"create_requests":true,"view_schedules":true}'::jsonb),
--   ('U-AUD-001','auditor','demo123','C. V. Raman','AUDITOR','Safety / Audit Directorate','Safety Inspector / Auditor',TRUE,
--    '{"tags":[]}'::jsonb,NULL,
--    '{"audit_readonly":true,"view_schedules":true,"view_all":true}'::jsonb);

-- ------------------------------------------------------------
-- 6. SESSIONS — login tokens (in-memory Map today)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sessions (
  token        TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- 7. TRACK POSSESSIONS — approval workflow state
--    (served by /api/possessions; decisions held in memory today)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.track_possessions (
  possession_id    TEXT PRIMARY KEY,
  work_request_id  TEXT REFERENCES public.work_requests(id) ON DELETE SET NULL,
  section          TEXT NOT NULL,
  possession_type  TEXT NOT NULL DEFAULT 'FULL_BLOCK', -- FULL_BLOCK | PARTIAL_BLOCK | CAUTION_ORDER | DEPOT_BAY_BLOCK
  ohe_shutdown     BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_start   TIMESTAMPTZ,
  assigned_end     TIMESTAMPTZ,
  decision         TEXT NOT NULL DEFAULT 'PENDING'
                   CHECK (decision IN ('PENDING', 'APPROVED', 'REJECTED')),
  decided_by       TEXT,
  decided_at       TIMESTAMPTZ,
  note             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_possessions_decision ON public.track_possessions (decision);

-- ------------------------------------------------------------
-- Row Level Security
-- The demo applet connects with anon + service-role keys; the
-- service role bypasses RLS and the allow-all policies keep the
-- anon key working. Lock these down before production (e.g.
-- authenticated-only policies keyed on public.users.role).
-- ------------------------------------------------------------
ALTER TABLE public.work_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conflicts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_schedules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_possessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demo full access work_requests"     ON public.work_requests     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "demo full access conflicts"         ON public.conflicts         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "demo full access master_schedules"  ON public.master_schedules  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "demo full access audit_logs"        ON public.audit_logs        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "demo full access users"             ON public.users             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "demo full access sessions"          ON public.sessions          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "demo full access track_possessions" ON public.track_possessions FOR ALL USING (true) WITH CHECK (true);
