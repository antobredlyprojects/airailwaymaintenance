import crypto from "crypto";
import { OfficialRole, SystemUser, UserPermissions } from "../types";

// ---------------------------------------------------------------------------
// Credential store for the SIH prototype.
// The 12 SEED_USERS below are the *demo* officials: they authenticate with the
// plaintext demo123 and see the seeded sample workspace. Accounts created by
// the System Administrator are stored password-hashed (scrypt) and live in a
// clean workspace — production authenticates via IR-NPASS SSO (OAuth 2.0/OIDC).
// ---------------------------------------------------------------------------

/** Scrypt password hash in "salt:hash" form (deterministic verify, salted). */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/** Verifies a password against a stored "salt:hash" (or legacy plaintext demo). */
export function verifyPassword(password: string, stored: string): boolean {
  if (!password || !stored) return false;
  const idx = stored.indexOf(":");
  if (idx === -1) return stored === password; // legacy plaintext (demo seeds)
  const salt = stored.slice(0, idx);
  const expected = stored.slice(idx + 1);
  const actual = crypto.scryptSync(password, salt, 64).toString("hex");
  return actual === expected;
}

/**
 * Default permission set per role for accounts created via User Administration
 * (mirrors the Role–Permission Matrix). Demo seeds may override per user.
 */
export const ROLE_DEFAULT_PERMISSIONS: Record<OfficialRole, UserPermissions> = {
  GANG_MATE: { create_requests: true, approve_requests: false, view_schedules: true, modify_schedules: false, approve_possessions: false, view_budget: false, approve_budget: false, manage_users: false, audit_readonly: false, view_all: false },
  SECTION_ENGINEER: { create_requests: true, approve_requests: true, view_schedules: true, modify_schedules: false, approve_possessions: false, view_budget: true, approve_budget: false, manage_users: false, audit_readonly: false, view_all: false },
  DEPOT_ENGINEER: { create_requests: true, approve_requests: true, view_schedules: true, modify_schedules: false, approve_possessions: false, view_budget: true, approve_budget: false, manage_users: false, audit_readonly: false, view_all: false },
  WORKSHOP_SUPERVISOR: { create_requests: true, approve_requests: true, view_schedules: true, modify_schedules: false, approve_possessions: false, view_budget: true, approve_budget: false, manage_users: false, audit_readonly: false, view_all: false },
  ADE: { create_requests: true, approve_requests: true, view_schedules: true, modify_schedules: true, approve_possessions: true, view_budget: true, approve_budget: false, manage_users: false, audit_readonly: false, view_all: true },
  SR_DME: { create_requests: true, approve_requests: true, view_schedules: true, modify_schedules: true, approve_possessions: false, view_budget: true, approve_budget: false, manage_users: false, audit_readonly: false, view_all: true },
  SECTION_CONTROLLER: { create_requests: false, approve_requests: false, view_schedules: true, modify_schedules: true, approve_possessions: true, view_budget: false, approve_budget: false, manage_users: false, audit_readonly: false, view_all: true },
  DRM: { create_requests: true, approve_requests: true, view_schedules: true, modify_schedules: true, approve_possessions: true, view_budget: true, approve_budget: true, manage_users: false, audit_readonly: false, view_all: true },
  SYSTEM_ADMIN: { create_requests: false, approve_requests: false, view_schedules: true, modify_schedules: false, approve_possessions: false, view_budget: false, approve_budget: false, manage_users: true, audit_readonly: false, view_all: true },
  DATA_ANALYST: { create_requests: false, approve_requests: false, view_schedules: true, modify_schedules: false, approve_possessions: false, view_budget: true, approve_budget: false, manage_users: false, audit_readonly: false, view_all: true },
  CONTRACTOR: { create_requests: true, approve_requests: false, view_schedules: true, modify_schedules: false, approve_possessions: false, view_budget: false, approve_budget: false, manage_users: false, audit_readonly: false, view_all: false },
  AUDITOR: { create_requests: false, approve_requests: false, view_schedules: true, modify_schedules: false, approve_possessions: false, view_budget: false, approve_budget: false, manage_users: false, audit_readonly: true, view_all: true },
};

const NO_PERMS: UserPermissions = {
  create_requests: false,
  approve_requests: false,
  view_schedules: false,
  modify_schedules: false,
  approve_possessions: false,
  view_budget: false,
  approve_budget: false,
  manage_users: false,
  audit_readonly: false,
  view_all: false,
};

export const SEED_USERS: SystemUser[] = [
  // ------------------ 1. FIELD OPERATIONS ------------------
  {
    id: "U-GM-001",
    username: "gangmate",
    password: "demo123",
    name: "Ramesh Kumar",
    role: "GANG_MATE",
    department: "P.Way (Track)",
    designation: "Gang Mate / Junior Engineer",
    active: true,
    // Scope: own gang plus the P.Way track work his gang performs on the mainline.
    scope: { tags: ["GANG-001", "TRACK_TAMPING", "RAIL_RENEWAL", "BALLAST_CLEANING", "UP-125", "DN-125"] },
    budget_limit: 0,
    permissions: { ...NO_PERMS, create_requests: true, view_schedules: true },
  },
  {
    id: "U-SE-001",
    username: "section.engineer",
    password: "demo123",
    name: "Amit Sharma",
    role: "SECTION_ENGINEER",
    department: "P.Way (Track)",
    designation: "Section Engineer (P.Way)",
    active: true,
    scope: { tags: ["NDLS", "TKJ", "UP-125", "DN-125"] },
    budget_limit: 50000,
    permissions: { ...NO_PERMS, create_requests: true, approve_requests: true, view_schedules: true, view_budget: true },
  },
  {
    id: "U-DE-001",
    username: "depot.engineer",
    password: "demo123",
    name: "Suresh Patil",
    role: "DEPOT_ENGINEER",
    department: "Mechanical (C&W)",
    designation: "Depot Engineer (Coaching)",
    active: true,
    scope: { tags: ["COACH", "SSB", "BAY-IOH", "DEPOT"] },
    budget_limit: 100000,
    permissions: { ...NO_PERMS, create_requests: true, approve_requests: true, view_schedules: true, view_budget: true },
  },
  {
    id: "U-WS-001",
    username: "workshop.supervisor",
    password: "demo123",
    name: "Vikram Singh",
    role: "WORKSHOP_SUPERVISOR",
    department: "Overhaul Workshop",
    designation: "Workshop Supervisor (POH)",
    active: true,
    scope: { tags: ["TKD", "POH", "WORKSHOP", "WAGON"] },
    budget_limit: 500000,
    permissions: { ...NO_PERMS, create_requests: true, approve_requests: true, view_schedules: true, view_budget: true },
  },

  // ------------------ 2. PLANNING & COORDINATION ------------------
  {
    id: "U-ADE-001",
    username: "ade.pway",
    password: "demo123",
    name: "Nandini Iyer",
    role: "ADE",
    department: "Engineering (P.Way)",
    designation: "Assistant Divisional Engineer (P.Way)",
    active: true,
    scope: { tags: [] },
    budget_limit: 1000000,
    permissions: {
      ...NO_PERMS,
      create_requests: true,
      approve_requests: true,
      view_schedules: true,
      modify_schedules: true,
      approve_possessions: true,
      view_budget: true,
      view_all: true,
    },
  },
  {
    id: "U-DME-001",
    username: "srdme.cw",
    password: "demo123",
    name: "Rajiv Menon",
    role: "SR_DME",
    department: "Mechanical (C&W)",
    designation: "Sr. Divisional Mechanical Engineer (C&W)",
    active: true,
    scope: { tags: [] },
    budget_limit: 2000000,
    permissions: {
      ...NO_PERMS,
      create_requests: true,
      approve_requests: true,
      view_schedules: true,
      modify_schedules: true,
      view_budget: true,
      view_all: true,
    },
  },
  {
    id: "U-DTM-001",
    username: "section.controller",
    password: "demo123",
    name: "Meera Joshi",
    role: "SECTION_CONTROLLER",
    department: "Operating / Traffic",
    designation: "Divisional Traffic Manager / Section Controller",
    active: true,
    scope: { tags: [] },
    budget_limit: null,
    permissions: { ...NO_PERMS, view_schedules: true, modify_schedules: true, approve_possessions: true, view_all: true },
  },

  // ------------------ 3. STRATEGIC & OVERSIGHT ------------------
  {
    id: "U-DRM-001",
    username: "drm",
    password: "demo123",
    name: "Arvind Rao",
    role: "DRM",
    department: "Executive Board",
    designation: "Divisional Railway Manager",
    active: true,
    scope: { tags: [] },
    budget_limit: 10000000,
    permissions: {
      ...NO_PERMS,
      create_requests: true,
      approve_requests: true,
      view_schedules: true,
      modify_schedules: true,
      approve_possessions: true,
      view_budget: true,
      approve_budget: true,
      view_all: true,
    },
  },

  // ------------------ 4. SYSTEM ADMIN & BI ------------------
  {
    id: "U-ADM-001",
    username: "admin",
    password: "demo123",
    name: "Kavita Nair",
    role: "SYSTEM_ADMIN",
    department: "IT / Systems",
    designation: "System Administrator",
    active: true,
    scope: { tags: [] },
    budget_limit: null,
    permissions: { ...NO_PERMS, manage_users: true, view_schedules: true, view_all: true },
  },
  {
    id: "U-BI-001",
    username: "analyst",
    password: "demo123",
    name: "Farhan Ali",
    role: "DATA_ANALYST",
    department: "Business Intelligence",
    designation: "Data Analyst",
    active: true,
    scope: { tags: [] },
    budget_limit: null,
    permissions: { ...NO_PERMS, view_schedules: true, view_budget: true, view_all: true },
  },

  // ------------------ 5. EXTERNAL STAKEHOLDERS ------------------
  {
    id: "U-CON-001",
    username: "contractor",
    password: "demo123",
    name: "SteelGrip Rail Services Pvt Ltd",
    role: "CONTRACTOR",
    department: "External Contractor",
    designation: "Rail Grinding Contractor",
    active: true,
    scope: { tags: ["CONTRACTOR"] },
    budget_limit: null,
    permissions: { ...NO_PERMS, create_requests: true, view_schedules: true },
  },
  {
    id: "U-AUD-001",
    username: "auditor",
    password: "demo123",
    name: "C. V. Raman",
    role: "AUDITOR",
    department: "Safety / Audit Directorate",
    designation: "Safety Inspector / Auditor",
    active: true,
    scope: { tags: [] },
    budget_limit: null,
    permissions: { ...NO_PERMS, audit_readonly: true, view_schedules: true, view_all: true },
  },
];

export function findUser(username: string): SystemUser | undefined {
  return SEED_USERS.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
}

// Mark every seeded official as a demo account — these see the sample workspace.
export const DEMO_SEED_USERS: SystemUser[] = SEED_USERS.map((u) => ({ ...u, demo: true }));
