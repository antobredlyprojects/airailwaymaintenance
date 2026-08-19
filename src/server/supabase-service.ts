import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { WorkRequest, Conflict, Schedule } from "../types";

const DEFAULT_SUPABASE_URL = "https://dvxdkulzsozfkdhbuctk.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2eGRrdWx6c296ZmtkaGJ1Y3RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5ODUxNTYsImV4cCI6MjEwMjU2MTE1Nn0.dohr6u_67gt0G5S9IkIFL_VEo2yxTUOxMjefOAi60Nk";
const DEFAULT_SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2eGRrdWx6c296ZmtkaGJ1Y3RrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Njk4NTE1NiwiZXhwIjoyMTAyNTYxMTU2fQ.7bYId01d4pYSyNeUxsPvlcsClfQQJFmaRcqiaToH9Mc";

let supabaseClient: SupabaseClient | null = null;

export function getCleanSupabaseUrl(): string {
  const raw = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
}

export function getSupabaseKey(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    DEFAULT_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_ANON_KEY
  );
}

const SUPABASE_REQUEST_TIMEOUT_MS = 10000;

/**
 * Wraps fetch with a hard timeout so an unreachable Supabase endpoint
 * fails fast instead of hanging the request / startup path.
 */
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(SUPABASE_REQUEST_TIMEOUT_MS);
  return fetch(input, { ...init, signal: init?.signal ?? timeoutSignal });
}

export function getSupabaseClient(): SupabaseClient | null {
  const supabaseUrl = getCleanSupabaseUrl();
  const supabaseKey = getSupabaseKey();

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  if (!supabaseClient) {
    try {
      supabaseClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: { fetch: fetchWithTimeout },
      });
    } catch (err) {
      console.warn("Failed to initialize Supabase client:", err);
      return null;
    }
  }

  return supabaseClient;
}

export function isSupabaseConfigured(): boolean {
  return !!(getCleanSupabaseUrl() && getSupabaseKey());
}

export async function checkSupabaseHealth(): Promise<{
  connected: boolean;
  configured: boolean;
  url?: string;
  tables?: string[];
  error?: string;
}> {
  const configured = isSupabaseConfigured();
  if (!configured) {
    return {
      connected: false,
      configured: false,
      error: "SUPABASE_URL and SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are not configured in environment variables.",
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      connected: false,
      configured: true,
      error: "Could not create Supabase client with current credentials.",
    };
  }

  const currentUrl = getCleanSupabaseUrl();

  try {
    // Attempt a lightweight query to check connection
    const { data, error } = await client.from("work_requests").select("id").limit(1);
    if (error) {
      // Table might not exist yet, but client connected
      if (error.code === "42P01") {
        return {
          connected: true,
          configured: true,
          url: currentUrl,
          error: "Connected to Supabase project, but 'work_requests' table has not been created yet. Copy and run the SQL schema in your Supabase SQL editor.",
        };
      }
      return {
        connected: false,
        configured: true,
        url: currentUrl,
        error: error.message,
      };
    }

    return {
      connected: true,
      configured: true,
      url: currentUrl,
      tables: ["work_requests"],
    };
  } catch (err: any) {
    return {
      connected: false,
      configured: true,
      url: currentUrl,
      error: err?.message || "Unknown error connecting to Supabase.",
    };
  }
}

/**
 * Syncs a work request to Supabase if configured
 */
export async function syncWorkRequestToSupabase(req: WorkRequest): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from("work_requests").upsert({
      id: req.id,
      title: req.title,
      type: req.type,
      priority: req.priority,
      status: req.status,
      location: req.location,
      duration: req.duration,
      resources: req.resources,
      constraints: req.constraints,
      metadata: req.metadata,
    });

    if (error) {
      console.warn("Supabase upsert work_request warning:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("Supabase sync error:", e);
    return false;
  }
}

/**
 * Syncs a conflict record to Supabase
 */
export async function syncConflictToSupabase(conflict: Conflict): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from("conflicts").upsert({
      id: conflict.id,
      type: conflict.type,
      severity: conflict.severity,
      status: conflict.status,
      description: conflict.description,
      work_requests: conflict.work_requests,
      resolution_suggestions: conflict.resolution_suggestions,
      override_justification: conflict.override_justification,
      override_by: conflict.override_by,
      detected_at: conflict.detected_at,
    });

    if (error) {
      console.warn("Supabase upsert conflict warning:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("Supabase conflict sync error:", e);
    return false;
  }
}

/**
 * Syncs a schedule to Supabase
 */
export async function syncScheduleToSupabase(schedule: Schedule): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from("master_schedules").upsert({
      id: schedule.id,
      version: schedule.version,
      work_assignments: schedule.work_assignments,
      optimization_metadata: schedule.optimization_metadata,
    });

    if (error) {
      console.warn("Supabase upsert schedule warning:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("Supabase schedule sync error:", e);
    return false;
  }
}

/**
 * Deletes a work request from Supabase
 */
export async function deleteWorkRequestFromSupabase(id: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from("work_requests").delete().eq("id", id);
    if (error) {
      console.warn("Supabase delete work_request error:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Fetch all work requests from Supabase if table exists
 */
export async function fetchWorkRequestsFromSupabase(): Promise<WorkRequest[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client.from("work_requests").select("*");
    if (error || !data || data.length === 0) return null;
    return data as WorkRequest[];
  } catch (e) {
    return null;
  }
}

/**
 * Fetch all conflicts from Supabase if table exists
 */
export async function fetchConflictsFromSupabase(): Promise<Conflict[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client.from("conflicts").select("*");
    if (error || !data || data.length === 0) return null;
    return data as Conflict[];
  } catch (e) {
    return null;
  }
}

/**
 * Fetch latest master schedule from Supabase if table exists
 */
export async function fetchScheduleFromSupabase(): Promise<Schedule | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from("master_schedules")
      .select("*")
      .order("version", { ascending: false })
      .limit(1);
    if (error || !data || data.length === 0) return null;
    return data[0] as Schedule;
  } catch (e) {
    return null;
  }
}

/**
 * Upserts a user account (RBAC directory) into the users table.
 * Passwords are stored as scrypt "salt:hash" — never plaintext.
 */
export async function upsertUserToSupabase(user: any): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from("users").upsert({
      id: user.id,
      username: user.username,
      password: user.password,
      name: user.name,
      role: user.role,
      department: user.department || "",
      designation: user.designation || "",
      current_location: user.current_location || "",
      active: user.active ?? true,
      scope: user.scope || { tags: [] },
      budget_limit: user.budget_limit ?? null,
      permissions: user.permissions || {},
    });
    if (error) {
      // users table may not exist yet — warn once, don't spam
      if (error.code === "42P01") {
        console.warn("Supabase users table missing — run supabase/schema.sql to enable account persistence.");
      } else {
        console.warn("Supabase upsert user warning:", error.message);
      }
      return false;
    }
    return true;
  } catch (e) {
    console.warn("Supabase user sync error:", e);
    return false;
  }
}

/**
 * Fetches all users from Supabase (null when table missing / unreachable).
 */
export async function fetchUsersFromSupabase(): Promise<any[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client.from("users").select("*");
    if (error || !data || data.length === 0) return null;
    return data as any[];
  } catch (e) {
    return null;
  }
}

/**
 * Log audit trail event to Supabase
 */
export async function logAuditToSupabase(
  userRole: string,
  actionType: string,
  entityId: string,
  details: any
): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    await client.from("audit_logs").insert({
      user_role: userRole,
      action_type: actionType,
      entity_id: entityId,
      details,
    });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * SQL Schema DDL for users to copy/paste or run in the Supabase SQL editor.
 * Single source of truth: supabase/schema.sql at the repo root.
 *
 * Path resolution must work in three layouts:
 *   dev (tsx):  module at src/server/            -> ../../supabase/schema.sql
 *   build:      bundle at dist/server.cjs        -> ../supabase/schema.sql
 *   cwd:        npm scripts run from repo root   -> ./supabase/schema.sql
 */
const schemaCandidates = [resolve(process.cwd(), "supabase/schema.sql")];
try {
  // Module-relative fallbacks (covers dev tsx layout); import.meta.url is
  // not a valid URL base in the esbuild CJS bundle, so guard it.
  schemaCandidates.push(
    fileURLToPath(new URL("../../supabase/schema.sql", import.meta.url)),
    fileURLToPath(new URL("../supabase/schema.sql", import.meta.url))
  );
} catch {
  /* bundle without import.meta shim — cwd candidate covers npm scripts */
}
const SCHEMA_SQL_PATH = schemaCandidates.find((p) => existsSync(p));
if (!SCHEMA_SQL_PATH) {
  throw new Error("supabase/schema.sql not found — cannot serve Supabase SQL schema.");
}
export const SUPABASE_SQL_SCHEMA = readFileSync(SCHEMA_SQL_PATH, "utf8");
