import express from "express";
import path from "path";
import crypto from "crypto";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import {
  DEMO_SEED_USERS,
  hashPassword,
  verifyPassword,
  ROLE_DEFAULT_PERMISSIONS,
} from "./src/server/users";

import {
  MOCK_PERSONNEL_GANGS,
  MOCK_EQUIPMENT,
  MOCK_MATERIALS,
  INITIAL_WORK_REQUESTS,
  INITIAL_CONFLICTS,
  INITIAL_SCHEDULE,
  MOCK_INTEGRATIONS,
  MOCK_NOTIFICATIONS,
  MOCK_LONG_TERM_PROJECTIONS,
} from "./src/data/mockRailwayData";
import { detectAllConflicts } from "./src/server/ai-engine/conflict-detector";
import { runGeneticAlgorithmOptimization } from "./src/server/ai-engine/ga-solver";
import { generateAlternativeProposals } from "./src/server/ai-engine/alternative-generator";
import { handleDynamicRescheduling } from "./src/server/ai-engine/rescheduler";
import { parseWorkRequestWithGemini, generateAiScheduleExplanation } from "./src/server/gemini-service";
import {
  WorkRequest,
  Conflict,
  Schedule,
  DisruptionEvent,
  ParetoSolution,
  SystemUser,
  PublicUser,
  AuditEvent,
} from "./src/types";
import {
  checkSupabaseHealth,
  syncWorkRequestToSupabase,
  syncConflictToSupabase,
  syncScheduleToSupabase,
  deleteWorkRequestFromSupabase,
  fetchWorkRequestsFromSupabase,
  fetchConflictsFromSupabase,
  fetchScheduleFromSupabase,
  logAuditToSupabase,
  fetchUsersFromSupabase,
  upsertUserToSupabase,
  SUPABASE_SQL_SCHEMA,
  isSupabaseConfigured,
  getSupabaseClient,
} from "./src/server/supabase-service";

dotenv.config();

// In-Memory Database Store for live interactive session
let workRequests: WorkRequest[] = [...INITIAL_WORK_REQUESTS];
let conflicts: Conflict[] = [...INITIAL_CONFLICTS];
let currentSchedule: Schedule = { ...INITIAL_SCHEDULE };
let gangs = [...MOCK_PERSONNEL_GANGS];
let equipmentList = [...MOCK_EQUIPMENT];
let materials = [...MOCK_MATERIALS];
let integrations = [...MOCK_INTEGRATIONS];
let notifications = [...MOCK_NOTIFICATIONS];
let longTermProjections = [...MOCK_LONG_TERM_PROJECTIONS];

// Demo workspace markers: the initial seeded records are sample data shown only
// to demo accounts. Anything created after boot is real (shared) workspace data.
const demoRequestIds = new Set(INITIAL_WORK_REQUESTS.map((r) => r.id));
const demoNotificationIds = new Set(MOCK_NOTIFICATIONS.map((n) => n.id));
const isDemoRequest = (r: WorkRequest) => demoRequestIds.has(r.id);
const isDemoConflict = (c: Conflict) => c.work_requests.every((rid) => demoRequestIds.has(rid));

// ---------------------------------------------------------------------------
// Authentication & Role-Based Access Control
// ---------------------------------------------------------------------------
const sessions = new Map<string, SystemUser>();
const auditEvents: AuditEvent[] = [];
const possessionDecisions: Record<string, { decision: string; note?: string; by: string; at: string }> = {};
// Mutable user store: demo seeds + accounts created by the System Administrator.
let users: SystemUser[] = [...DEMO_SEED_USERS];

const toPublic = (u: SystemUser): PublicUser => {
  const { password: _pw, ...pub } = u;
  return pub;
};

function authUser(req: any): SystemUser | null {
  const header = req.headers?.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return sessions.get(header.slice(7)) || null;
}

function requireAuth(req: any, res: any, next: any) {
  const user = authUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized — please sign in." });
  req.user = user;
  next();
}

function requirePermission(perm: keyof SystemUser["permissions"]) {
  return (req: any, res: any, next: any) => {
    const user = req.user as SystemUser | undefined;
    if (!user) return res.status(401).json({ error: "Unauthorized — please sign in." });
    if (!user.permissions[perm]) return res.status(403).json({ error: `Permission denied: ${perm}` });
    next();
  };
}

function audit(user: SystemUser, action: string, entity: string, detail = "") {
  auditEvents.unshift({
    id: `AUD-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
    timestamp: new Date().toISOString(),
    user: user.name,
    role: user.role,
    action,
    entity,
    detail,
  });
}

/**
 * Returns a predicate that keeps only records matching the user's scope tags.
 * Returns null when the user is unscoped (division/zonal oversight, admin, audit).
 */
function scopeFilter(user: SystemUser) {
  const tags = (user.scope?.tags || []).map((t) => t.toLowerCase());
  if (user.permissions.view_all || tags.length === 0) return null;
  return (r: WorkRequest) => {
    const hay = JSON.stringify(r).toLowerCase();
    return tags.some((t) => hay.includes(t));
  };
}

/**
 * Combines role scoping with the demo gate: sample (seeded) records are visible
 * only to demo accounts; real accounts see only records created/approved after
 * boot — their workspace fills up as work is requested and approved.
 */
function visibleFilter(user: SystemUser) {
  const scope = scopeFilter(user);
  const demoUser = !!user.demo;
  return (r: WorkRequest) => (scope ? scope(r) : true) && (demoUser || !isDemoRequest(r));
}

// Initialize and re-evaluate conflicts
conflicts = detectAllConflicts(workRequests, gangs, equipmentList);

// Background initialization from Supabase if configured.
// Runs fire-and-forget with a hard timeout so an unreachable Supabase
// project can never block server startup.
async function initializeFromSupabase() {
  const SUPABASE_HYDRATION_TIMEOUT_MS = 8000;
  try {
    if (!isSupabaseConfigured()) return;

    await Promise.race([
      (async () => {
        console.log("Checking Supabase for existing cloud records...");
        const cloudRequests = await fetchWorkRequestsFromSupabase();
        if (cloudRequests && cloudRequests.length > 0) {
          console.log(`Loaded ${cloudRequests.length} work requests from Supabase.`);
          workRequests = cloudRequests;
        } else {
          // Sync initial baseline to Supabase
          console.log("Populating initial baseline dataset to Supabase...");
          for (const req of workRequests) {
            await syncWorkRequestToSupabase(req);
          }
        }

        const cloudSchedule = await fetchScheduleFromSupabase();
        if (cloudSchedule) {
          console.log(`Loaded Master Schedule v${cloudSchedule.version} from Supabase.`);
          currentSchedule = cloudSchedule;
        } else {
          await syncScheduleToSupabase(currentSchedule);
        }

        conflicts = detectAllConflicts(workRequests, gangs, equipmentList);
        for (const c of conflicts) {
          await syncConflictToSupabase(c);
        }

        // Seed / merge user accounts (RBAC directory)
        let dbUsers = await fetchUsersFromSupabase();
        if (!dbUsers || dbUsers.length === 0) {
          console.log("Seeding demo user accounts to Supabase...");
          for (const u of DEMO_SEED_USERS) {
            await upsertUserToSupabase({ ...u, password: hashPassword(u.password) });
          }
          dbUsers = await fetchUsersFromSupabase();
        }
        if (dbUsers && dbUsers.length > 0) {
          const byId = new Map(users.map((u) => [u.id, u]));
          let skipped = 0;
          for (const row of dbUsers) {
            if (!(row.role in ROLE_DEFAULT_PERMISSIONS)) {
              skipped++;
              continue; // unknown role — ignore the row instead of crashing the portal
            }
            const existing = byId.get(row.id);
            byId.set(row.id, {
              ...row,
              demo: existing?.demo ?? false,
              permissions: row.permissions || existing?.permissions || {},
            } as SystemUser);
          }
          // The shared demo DB can hold same-username rows from other sessions — dedupe.
          const byUsername = new Map<string, SystemUser>();
          for (const u of byId.values()) {
            const key = u.username.toLowerCase();
            if (!byUsername.has(key)) byUsername.set(key, u);
          }
          users = [...byUsername.values()];
          if (skipped > 0) console.warn(`Skipped ${skipped} user row(s) from Supabase with unknown roles.`);
          console.log(`Loaded ${users.length} user accounts from Supabase.`);
        }
      })(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Supabase hydration exceeded ${SUPABASE_HYDRATION_TIMEOUT_MS}ms and was skipped.`)),
          SUPABASE_HYDRATION_TIMEOUT_MS
        )
      ),
    ]);
  } catch (err: any) {
    console.warn("Supabase startup hydration note:", err?.message || err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // Initial cloud hydration (non-blocking: server starts immediately)
  initializeFromSupabase();

  // --- API Endpoints ---

  // ==========================================================================
  // AUTH: login / session / logout
  // ==========================================================================
  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body || {};
    const user = users.find(
      (u) => u.username.toLowerCase() === String(username || "").trim().toLowerCase()
    );
    if (!user || !verifyPassword(String(password || ""), user.password)) {
      return res.status(401).json({ error: "Invalid username or password." });
    }
    if (!user.active) {
      return res.status(403).json({ error: "Account deactivated. Contact the System Administrator." });
    }
    const token = crypto.randomUUID();
    sessions.set(token, user);
    audit(user, "LOGIN", user.id, "Signed in to RailOptima portal");
    res.json({ token, user: toPublic(user) });
  });

  app.get("/api/auth/me", requireAuth, (req: any, res) => {
    res.json({ user: toPublic(req.user) });
  });

  app.post("/api/auth/logout", requireAuth, (req: any, res) => {
    const header = req.headers?.authorization || "";
    if (header.startsWith("Bearer ")) sessions.delete(header.slice(7));
    res.json({ success: true });
  });

  // ==========================================================================
  // USERS (System Administrator only)
  // ==========================================================================
  app.get("/api/users", requireAuth, requirePermission("manage_users"), (_req, res) => {
    res.json(users.map(toPublic));
  });

  app.post("/api/users", requireAuth, requirePermission("manage_users"), (req: any, res) => {
    const actor = req.user as SystemUser;
    const { username, password, name, role, department, designation, budget_limit, scope_tags } =
      req.body || {};
    if (!username || !password || !name || !role) {
      return res.status(400).json({ error: "username, password, name and role are required." });
    }
    if (!(role in ROLE_DEFAULT_PERMISSIONS)) {
      return res.status(400).json({ error: `Unknown role: ${role}` });
    }
    if (users.some((u) => u.username.toLowerCase() === String(username).trim().toLowerCase())) {
      return res.status(409).json({ error: "A user with this username already exists." });
    }

    const newUser: SystemUser = {
      id: `U-${Date.now().toString(36).toUpperCase()}`,
      username: String(username).trim(),
      password: hashPassword(String(password)),
      name: String(name),
      role: role as SystemUser["role"],
      department: department || "",
      designation: designation || "",
      active: true,
      demo: false,
      scope: { tags: Array.isArray(scope_tags) ? scope_tags.map(String) : [] },
      budget_limit: budget_limit == null || budget_limit === "" ? null : Number(budget_limit),
      permissions: ROLE_DEFAULT_PERMISSIONS[role as SystemUser["role"]],
    };
    users.push(newUser);
    audit(actor, "CREATE_USER", newUser.id, `${newUser.name} (${newUser.role})`);
    upsertUserToSupabase(newUser).catch((e) => console.warn("Supabase user upsert:", e));
    logAuditToSupabase(actor.role, "CREATE_USER", newUser.id, {
      username: newUser.username,
      role: newUser.role,
    });
    res.status(201).json({ user: toPublic(newUser) });
  });

  app.post("/api/users/:id/deactivate", requireAuth, requirePermission("manage_users"), (req: any, res) => {
    const user = users.find((u) => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: "User not found." });
    user.active = !user.active;
    audit(req.user, "TOGGLE_USER", user.id, `${user.name} ${user.active ? "activated" : "deactivated"}`);
    upsertUserToSupabase(user).catch((e) => console.warn("Supabase user upsert:", e));
    res.json({ success: true, user: toPublic(user) });
  });

  // ==========================================================================
  // AUDIT TRAIL (read-only for Auditor / Analyst / Admin)
  // ==========================================================================
  app.get("/api/audit", requireAuth, (req: any, res) => {
    const u = req.user as SystemUser;
    if (!u.permissions.view_all && !u.permissions.audit_readonly) {
      return res.status(403).json({ error: "Permission denied: audit log access." });
    }
    res.json(auditEvents);
  });

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      supabaseConfigured: isSupabaseConfigured(),
      timestamp: new Date().toISOString(),
    });
  });

  // 1. Work Requests (role-scoped)
  app.get("/api/work-requests", requireAuth, (req: any, res) => {
    res.json(workRequests.filter(visibleFilter(req.user)));
  });

  app.post("/api/work-requests", requireAuth, requirePermission("create_requests"), (req: any, res) => {
    const actor = req.user as SystemUser;
    const newReq: WorkRequest = {
      ...req.body,
      id:
        req.body.id ||
        `REQ-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`,
      metadata: {
        ...req.body.metadata,
        created_by: req.body.metadata?.created_by || actor.name,
        role: actor.role,
        source: actor.role === "CONTRACTOR" ? "EXTERNAL_CONTRACTOR" : req.body.metadata?.source || "MANUAL",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    };

    workRequests.unshift(newReq);
    // Real-time conflict recalculation
    conflicts = detectAllConflicts(workRequests, gangs, equipmentList);
    audit(actor, "CREATE_WORK_REQUEST", newReq.id, `${newReq.type} — ${newReq.title}`);

    // Sync to Supabase in background
    syncWorkRequestToSupabase(newReq).catch((e) => console.warn("Supabase background sync notice:", e));
    logAuditToSupabase(newReq.metadata?.role || "TRACK_SUPERVISOR", "CREATE_WORK_REQUEST", newReq.id, {
      title: newReq.title,
      priority: newReq.priority,
    });

    // Add notification if conflicts detected
    const newConflicts = conflicts.filter((c) => c.work_requests.includes(newReq.id));
    if (newConflicts.length > 0) {
      notifications.unshift({
        id: `NOTIF-${Date.now()}`,
        title: `Conflict Detected for ${newReq.id}`,
        message: newConflicts[0].description,
        type: "CONFLICT",
        severity: newConflicts[0].severity,
        timestamp: new Date().toISOString(),
        read: false,
        related_request_id: newReq.id,
      });
    }

    res.status(201).json({ request: newReq, conflicts });
  });

  app.put("/api/work-requests/:id", (req, res) => {
    const { id } = req.params;
    const index = workRequests.findIndex((r) => r.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Work request not found" });
    }
    workRequests[index] = {
      ...workRequests[index],
      ...req.body,
      metadata: {
        ...workRequests[index].metadata,
        updated_at: new Date().toISOString(),
      },
    };
    conflicts = detectAllConflicts(workRequests, gangs, equipmentList);

    syncWorkRequestToSupabase(workRequests[index]).catch((e) => console.warn("Supabase sync:", e));
    logAuditToSupabase("TRACK_SUPERVISOR", "UPDATE_WORK_REQUEST", id, req.body);

    res.json({ request: workRequests[index], conflicts });
  });

  app.delete("/api/work-requests/:id", requireAuth, requirePermission("create_requests"), (req: any, res) => {
    const { id } = req.params;
    workRequests = workRequests.filter((r) => r.id !== id);
    // Prune alerts referencing the removed request so stale notifications don't linger
    notifications = notifications.filter((n) => n.related_request_id !== id);
    conflicts = detectAllConflicts(workRequests, gangs, equipmentList);

    deleteWorkRequestFromSupabase(id).catch((e) => console.warn("Supabase delete:", e));
    audit(req.user, "DELETE_WORK_REQUEST", id, "Work request removed");

    res.json({ success: true, remainingCount: workRequests.length, conflicts });
  });

  // 1b. Approval workflow: pending queue + approve/reject decisions
  app.get("/api/approvals", requireAuth, requirePermission("approve_requests"), (req: any, res) => {
    const pending = workRequests.filter(
      (r) => r.status === "PENDING" && visibleFilter(req.user)(r)
    );
    res.json(pending);
  });

  app.post("/api/work-requests/:id/decision", requireAuth, requirePermission("approve_requests"), (req: any, res) => {
    const { decision, note } = req.body || {};
    const target = workRequests.find((r) => r.id === req.params.id);
    if (!target) return res.status(404).json({ error: "Work request not found." });

    if (decision === "APPROVED") {
      target.status = "APPROVED";
    } else if (decision === "REJECTED") {
      target.status = "REJECTED";
    } else {
      return res.status(400).json({ error: "decision must be APPROVED or REJECTED." });
    }
    target.metadata.notes = note || target.metadata.notes;
    audit(
      req.user,
      decision === "APPROVED" ? "APPROVE_WORK_REQUEST" : "REJECT_WORK_REQUEST",
      target.id,
      note || `${target.title} (${decision})`
    );

    // Re-run conflict engine so approved work reflects in live state
    conflicts = detectAllConflicts(workRequests, gangs, equipmentList);
    res.json({ request: target, conflicts });
  });

  app.post("/api/work-requests/batch", (req, res) => {
    const { requests } = req.body;
    if (Array.isArray(requests)) {
      requests.forEach((r: WorkRequest) => {
        const item = {
          ...r,
          id: r.id || `REQ-BATCH-${Math.floor(1000 + Math.random() * 9000)}`,
        };
        workRequests.unshift(item);
        syncWorkRequestToSupabase(item).catch(() => {});
      });
      conflicts = detectAllConflicts(workRequests, gangs, equipmentList);
    }
    res.json({ count: workRequests.length, conflicts });
  });

  // 2. Conflict Detection & Overrides (senior-only override)
  app.get("/api/conflicts", requireAuth, (req: any, res) => {
    const user = req.user as SystemUser;
    const demoUser = !!user.demo;
    const visibleReqIds = new Set(workRequests.filter(visibleFilter(user)).map((r) => r.id));
    res.json(
      conflicts.filter(
        (c) => (demoUser || !isDemoConflict(c)) && c.work_requests.some((rid) => visibleReqIds.has(rid))
      )
    );
  });

  app.post(
    "/api/conflicts/:id/override",
    requireAuth,
    requirePermission("approve_requests"),
    (req: any, res) => {
      const actor = req.user as SystemUser;
      if (!actor.permissions.view_all) {
        return res.status(403).json({ error: "Statutory overrides require senior divisional authority." });
      }
      const { id } = req.params;
      const { justification, overrideBy, override_by } = req.body;
      const conf = conflicts.find((c) => c.id === id);
      if (!conf) {
        return res.status(404).json({ error: "Conflict not found" });
      }
      conf.status = "OVERRIDDEN";
      conf.override_justification = justification;
      conf.override_by = overrideBy || override_by || actor.name;
      audit(actor, "STATUTORY_OVERRIDE", id, justification || "Senior authority override");

    syncConflictToSupabase(conf).catch((e) => console.warn("Supabase conflict sync:", e));
    logAuditToSupabase(conf.override_by, "STATUTORY_OVERRIDE", id, { justification });

    notifications.unshift({
      id: `NOTIF-OVR-${Date.now()}`,
      title: `Safety Conflict Overridden`,
      message: `Conflict ${id} overridden by ${conf.override_by}: ${justification}`,
      type: "APPROVAL",
      severity: "HIGH",
      timestamp: new Date().toISOString(),
      read: false,
    });

    res.json(conf);
  });

  // 3. AI Schedule Optimization Engine (both /api/schedule and /api/schedules/weekly)
  const getScheduleHandler = (req: any, res: any) => {
    const filter = scopeFilter(req.user);
    if (!filter) return res.json(currentSchedule);
    const visible = new Set(workRequests.filter(filter).map((r) => r.id));
    res.json({
      ...currentSchedule,
      work_assignments: currentSchedule.work_assignments.filter((a) => visible.has(a.work_request_id)),
    });
  };
  app.get("/api/schedule", requireAuth, getScheduleHandler);
  app.get("/api/schedules/weekly", requireAuth, getScheduleHandler);

  const optimizeScheduleHandler = (req: any, res: any) => {
    const actor = req.user as SystemUser;
    if (!actor.permissions.modify_schedules && !actor.permissions.view_all) {
      return res.status(403).json({ error: "Permission denied: schedule optimization." });
    }
    const { weights, populationSize, generations } = req.body;
    const result = runGeneticAlgorithmOptimization(
      workRequests,
      gangs,
      equipmentList,
      weights,
      populationSize || 120,
      generations || 60
    );

    currentSchedule = {
      id: `SCH-2026-W34-OPT`,
      name: `Optimized Master Schedule (GA Gen ${generations || 60})`,
      type: "WEEKLY",
      period: {
        start_date: "2026-08-17",
        end_date: "2026-08-23",
      },
      status: "DRAFT",
      version: currentSchedule.version + 1,
      work_assignments: result.bestScheduleAssignments,
      optimization_metadata: {
        algorithm: "HYBRID_EXPERT_GENETIC_ALGORITHM",
        generations_run: generations || 60,
        population_size: populationSize || 120,
        fitness_score: result.fitnessScore,
        weights: weights || currentSchedule.optimization_metadata.weights,
        pareto_frontier_solutions: result.paretoSolutions,
        selected_pareto_index: 2, // default balanced
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: "Genetic Algorithm Multi-Objective Solver v4.0",
      approved_by: null,
    };

    syncScheduleToSupabase(currentSchedule).catch((e) => console.warn("Supabase schedule sync:", e));
    logAuditToSupabase("CHIEF_PLANNING_OFFICER", "RUN_OPTIMIZATION", currentSchedule.id, {
      fitnessScore: result.fitnessScore,
      version: currentSchedule.version,
    });

    res.json({
      schedule: currentSchedule,
      fitnessScore: result.fitnessScore,
      metrics: result.metrics,
      generationsHistory: result.generationsHistory,
      paretoSolutions: result.paretoSolutions,
      computationTimeMs: 145,
    });
  };
  app.post("/api/schedule/optimize", optimizeScheduleHandler);
  app.post("/api/schedules/optimize", optimizeScheduleHandler);

  // Apply Pareto Frontier Solution
  app.post("/api/schedule/apply-pareto", (req, res) => {
    const { solutionId, solution } = req.body;
    let targetSolution: ParetoSolution | undefined = solution;

    if (!targetSolution && solutionId) {
      targetSolution = currentSchedule.optimization_metadata.pareto_frontier_solutions?.find(
        (p) => p.id === solutionId
      );
    }

    if (targetSolution) {
      currentSchedule = {
        ...currentSchedule,
        version: currentSchedule.version + 1,
        work_assignments: targetSolution.assignments,
        updated_at: new Date().toISOString(),
      };
      syncScheduleToSupabase(currentSchedule).catch(() => {});
      logAuditToSupabase("CHIEF_PLANNING_OFFICER", "APPLY_PARETO_SOLUTION", targetSolution.id, {
        name: targetSolution.name,
      });
    }

    res.json({ success: true, schedule: currentSchedule });
  });

  app.post("/api/schedules/publish", (req, res) => {
    const { approved_by } = req.body;
    currentSchedule.status = "PUBLISHED";
    currentSchedule.approved_by = approved_by || "Chief Operations Manager (COM)";

    syncScheduleToSupabase(currentSchedule).catch(() => {});
    logAuditToSupabase(currentSchedule.approved_by, "PUBLISH_SCHEDULE", currentSchedule.id, {
      version: currentSchedule.version,
    });

    notifications.unshift({
      id: `NOTIF-PUB-${Date.now()}`,
      title: "Master Schedule Published",
      message: `Master Maintenance Schedule v${currentSchedule.version} officially approved and published to all Divisional depots & ICMS.`,
      type: "APPROVAL",
      severity: "INFO",
      timestamp: new Date().toISOString(),
      read: false,
    });

    res.json(currentSchedule);
  });

  // 4. Alternative Proposals (What-If Sandbox)
  app.get("/api/alternatives/:conflictId", (req, res) => {
    const { conflictId } = req.params;
    const conf = conflicts.find((c) => c.id === conflictId) || conflicts[0];
    if (!conf) {
      return res.json([]);
    }
    const alternatives = generateAlternativeProposals(conf, currentSchedule);
    res.json(alternatives);
  });

  app.post("/api/alternatives/apply", (req, res) => {
    const { alternativeId, proposal } = req.body;
    // Mark related conflict resolved
    if (alternativeId) {
      conflicts = conflicts.map((c) =>
        c.id === alternativeId || c.resolution_suggestions.some((s) => s.includes(alternativeId))
          ? { ...c, status: "RESOLVED" }
          : c
      );
    }
    currentSchedule = {
      ...currentSchedule,
      version: currentSchedule.version + 1,
      updated_at: new Date().toISOString(),
    };

    syncScheduleToSupabase(currentSchedule).catch(() => {});
    logAuditToSupabase("TRACK_SUPERVISOR", "APPLY_WHATIF_ALTERNATIVE", alternativeId || "PROPOSAL", proposal || {});

    res.json({
      success: true,
      updatedSchedule: currentSchedule,
      remainingConflicts: conflicts,
    });
  });

  // 5. Dynamic Rescheduling (Live Disruption Simulator)
  const handleDisruptionTrigger = (req: any, res: any) => {
    const disruption: DisruptionEvent = req.body;
    const result = handleDynamicRescheduling(
      disruption,
      currentSchedule,
      workRequests,
      gangs,
      equipmentList
    );

    currentSchedule = result.revisedSchedule;
    syncScheduleToSupabase(currentSchedule).catch(() => {});
    logAuditToSupabase("SECTION_CONTROLLER", "TRIGGER_DISRUPTION_RECOVERY", disruption.id, {
      type: disruption.type,
      impactedCount: result.impactedCount,
    });

    notifications.unshift({
      id: `NOTIF-DIS-${Date.now()}`,
      title: `Emergency Rescheduling Completed`,
      message: `System adapted to '${disruption.title}' in ${result.computationTimeMs}ms with ${result.impactedCount} schedule adjustments.`,
      type: "DISRUPTION",
      severity: "CRITICAL",
      timestamp: new Date().toISOString(),
      read: false,
    });

    res.json(result);
  };
  app.post("/api/disruptions/trigger", handleDisruptionTrigger);
  app.post("/api/reschedule", handleDisruptionTrigger);

  // 6. Resources & Inventory
  app.get("/api/resources", requireAuth, (_req, res) => {
    res.json({
      gangs,
      equipment: equipmentList,
      materials,
    });
  });

  // 6b. Track Possession Approval Workflow (Section Controller / ADE)
  app.get("/api/possessions", requireAuth, (req: any, res) => {
    const visible = new Set(workRequests.filter(visibleFilter(req.user)).map((r) => r.id));
    const list = currentSchedule.work_assignments
      .map((a) => ({ assignment: a, request: workRequests.find((r) => r.id === a.work_request_id) }))
      .filter((x) => visible.has(x.assignment.work_request_id))
      .map((x) => {
        const pid = x.assignment.track_possession.possession_id;
        const dec = possessionDecisions[pid];
        return {
          possession_id: pid,
          section: x.assignment.track_possession.section,
          possession_type: x.assignment.track_possession.possession_type,
          ohe_shutdown: x.assignment.track_possession.ohe_shutdown,
          assigned_start: x.assignment.assigned_start,
          assigned_end: x.assignment.assigned_end,
          work_request_id: x.assignment.work_request_id,
          title: x.request?.title || x.assignment.work_request_id,
          priority: x.request?.priority || "LOW",
          decision: dec?.decision || "PENDING",
          decided_by: dec?.by,
          decided_at: dec?.at,
          note: dec?.note,
        };
      });
    res.json(list);
  });

  app.post(
    "/api/possessions/:id/decision",
    requireAuth,
    requirePermission("approve_possessions"),
    (req: any, res) => {
      const { decision, note } = req.body || {};
      if (!["APPROVED", "REJECTED"].includes(decision)) {
        return res.status(400).json({ error: "decision must be APPROVED or REJECTED." });
      }
      possessionDecisions[req.params.id] = {
        decision,
        note: note || "",
        by: req.user.name,
        at: new Date().toISOString(),
      };
      audit(
        req.user,
        decision === "APPROVED" ? "POSSESSION_APPROVED" : "POSSESSION_REJECTED",
        req.params.id,
        note || `Possession ${decision} for section`
      );
      res.json({ success: true, possession_id: req.params.id, decision });
    }
  );

  // 7. System Integrations (ICMS, FOIS, OMRS/WILD, USFD)
  app.get("/api/integrations", (_req, res) => {
    res.json(integrations);
  });

  app.post("/api/integrations/sync/:service", (req, res) => {
    const { service } = req.params;
    const item = integrations.find((i) => i.service === service);
    if (item) {
      item.last_sync_time = new Date().toISOString();
      item.sync_count_today += 1;
    }
    res.json({ success: true, integration: item });
  });

  app.post("/api/integrations/trigger-wild-alarm", (_req, res) => {
    const newReq: WorkRequest = {
      id: `REQ-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(8000 + Math.random() * 900)}`,
      title: `Auto-Dispatched WILD High Impact Wheel Turning (Wagon #${Math.floor(100000 + Math.random() * 900000)})`,
      type: "WAGON_ROH",
      priority: "CRITICAL",
      status: "APPROVED",
      location: {
        type: "DEPOT_BAY",
        section_id: "BAY-WHEEL-LATHE-02",
        station_proximity: "TKD Marshalling Yard",
        workshop_shop_id: "TKD-SHOP-02",
      },
      duration: {
        start_time: "2026-08-18T06:00:00.000Z",
        end_time: "2026-08-18T09:30:00.000Z",
        setup_time_mins: 20,
        teardown_time_mins: 15,
        estimated_duration_hours: 3.5,
      },
      resources: {
        personnel: [
          { role: "GANG_MATE", count: 1 },
          { role: "WORKER", count: 6 },
        ],
        equipment: [{ type: "WHEEL_LATHE" }],
        engineering_train: null,
      },
      constraints: {
        time_window: {
          earliest_start: "2026-08-18T06:00:00.000Z",
          latest_end: "2026-08-18T14:00:00.000Z",
          preferred_slots: ["06:00-09:30"],
          is_non_traffic_hours_mandatory: false,
        },
        safety: {
          possession_type: "DEPOT_BAY_BLOCK",
          requires_earthing: false,
          requires_ohe_shutdown: false,
          requires_adjacent_caution: false,
        },
        dependencies: { prerequisites: [], successors: [] },
        compatibility: { compatible_with: [], incompatible_with: [] },
      },
      metadata: {
        created_by: "OMRS / WILD Automated Ingestion Gateway",
        role: "WORKSHOP_MANAGER",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        source: "OMRS_WILD",
        notes: "Wheel flat impact peak exceeded 2.9g limit. High derailment hazard.",
      },
    };

    workRequests.unshift(newReq);
    conflicts = detectAllConflicts(workRequests, gangs, equipmentList);
    syncWorkRequestToSupabase(newReq).catch(() => {});

    notifications.unshift({
      id: `NOTIF-WILD-${Date.now()}`,
      title: "WILD Severe Wheel Impact Ingested",
      message: `WILD sensor at KM 124.8 detected 2.9g peak. Automated work order ${newReq.id} dispatched to TKD Wheel Lathe.`,
      type: "DISRUPTION",
      severity: "CRITICAL",
      timestamp: new Date().toISOString(),
      read: false,
    });

    res.json({ request: newReq, count: workRequests.length });
  });

  // 8. Long-Term Strategic Planning (both query params and post)
  const handleLongTerm = (req: any, res: any) => {
    const scenario = req.query.scenario || req.body?.scenario || "BASELINE";
    const factor = scenario === "ACCELERATED" ? 1.25 : scenario === "DEFERRED" ? 0.75 : 1.0;
    const simResults = longTermProjections.map((p) => ({
      ...p,
      demand_hours: Math.round(p.demand_hours * factor),
      deficit_or_surplus_hours: Math.round(p.capacity_hours - p.demand_hours * factor),
      bottleneck_risk: (p.capacity_hours - p.demand_hours * factor < -50
        ? "SEVERE"
        : p.capacity_hours - p.demand_hours * factor < 0
        ? "MODERATE"
        : "NORMAL") as any,
    }));
    res.json(simResults);
  };
  app.get("/api/longterm-projections", handleLongTerm);
  app.get("/api/longterm/projections", handleLongTerm);
  app.post("/api/longterm/simulate", handleLongTerm);

  // 9. Gemini AI Integration Endpoints
  app.post("/api/gemini/parse-request", async (req, res) => {
    try {
      const { text } = req.body;
      const parsed = await parseWorkRequestWithGemini(text);
      res.json(parsed);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to parse text" });
    }
  });

  app.post("/api/gemini/explain-schedule", async (_req, res) => {
    try {
      const explanation = await generateAiScheduleExplanation(currentSchedule, conflicts);
      res.json({ explanation });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to generate explanation" });
    }
  });

  // 10. Notifications
  app.get("/api/notifications", requireAuth, (req: any, res) => {
    const demoUser = !!(req.user as SystemUser).demo;
    res.json(demoUser ? notifications : notifications.filter((n) => !demoNotificationIds.has(n.id)));
  });

  app.post("/api/notifications/:id/read", (req, res) => {
    const { id } = req.params;
    const n = notifications.find((item) => item.id === id);
    if (n) n.read = true;
    res.json({ success: true });
  });

  // 11. Supabase Integration
  app.get("/api/supabase/status", async (_req, res) => {
    try {
      const health = await checkSupabaseHealth();
      res.json({
        ...health,
        schemaSql: SUPABASE_SQL_SCHEMA,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/supabase/sync-all", async (_req, res) => {
    const isConfig = isSupabaseConfigured();
    if (!isConfig) {
      return res.status(400).json({
        success: false,
        message:
          "Supabase credentials (SUPABASE_URL and SUPABASE_ANON_KEY/SERVICE_ROLE_KEY) not configured in environment.",
      });
    }

    try {
      let syncedRequests = 0;
      for (const reqItem of workRequests) {
        const ok = await syncWorkRequestToSupabase(reqItem);
        if (ok) syncedRequests++;
      }

      let syncedConflicts = 0;
      for (const conflictItem of conflicts) {
        const ok = await syncConflictToSupabase(conflictItem);
        if (ok) syncedConflicts++;
      }

      const scheduleSynced = await syncScheduleToSupabase(currentSchedule);

      res.json({
        success: true,
        syncedCount: syncedRequests,
        total: workRequests.length,
        syncedConflicts,
        scheduleSynced,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`RailOptima AI Server running on http://localhost:${PORT}`);
  });
}

startServer();
