import { OfficialRole, UserPermissions } from "../types";
import {
  ClipboardList,
  LayoutDashboard,
  ShieldAlert,
  Users,
  FileSearch,
  TrainFront,
  ListChecks,
} from "lucide-react";

export interface RoleMeta {
  label: string;
  dept: string;
  badge: string; // tailwind classes for role chip
  tone: "field" | "section" | "division" | "strategic" | "system" | "external";
  blurb: string;
}

export const ROLE_META: Record<OfficialRole, RoleMeta> = {
  GANG_MATE: {
    label: "Gang Mate (P.Way)",
    dept: "Track Maintenance",
    badge: "bg-emerald-950 text-emerald-300 border-emerald-800",
    tone: "field",
    blurb: "Field supervisor — creates work requests, executes assigned work, reports progress.",
  },
  SECTION_ENGINEER: {
    label: "Section Engineer (P.Way)",
    dept: "Engineering / P.Way",
    badge: "bg-teal-950 text-teal-300 border-teal-800",
    tone: "section",
    blurb: "Approves gang requests up to ₹50k, proposes schedule adjustments for their section.",
  },
  DEPOT_ENGINEER: {
    label: "Depot Engineer (Coaching)",
    dept: "Mechanical (C&W)",
    badge: "bg-sky-950 text-sky-300 border-sky-800",
    tone: "section",
    blurb: "Manages IOH/ROH schedules, bay allocation and depot spare inventory.",
  },
  WORKSHOP_SUPERVISOR: {
    label: "Workshop Supervisor (POH)",
    dept: "Overhaul Workshop",
    badge: "bg-indigo-950 text-indigo-300 border-indigo-800",
    tone: "section",
    blurb: "Plans POH bay sequencing, stage-wise inspections and skilled worker allocation.",
  },
  ADE: {
    label: "ADE (P.Way)",
    dept: "Engineering (P.Way)",
    badge: "bg-blue-950 text-blue-300 border-blue-800",
    tone: "division",
    blurb: "Division-level track maintenance planning, machine allocation, budget up to ₹10L.",
  },
  SR_DME: {
    label: "Sr. DME (C&W)",
    dept: "Mechanical (C&W)",
    badge: "bg-violet-950 text-violet-300 border-violet-800",
    tone: "division",
    blurb: "Division-wide coaching/wagon maintenance, depot load balancing, budget up to ₹20L.",
  },
  SECTION_CONTROLLER: {
    label: "Section Controller",
    dept: "Operating / Traffic",
    badge: "bg-amber-950 text-amber-300 border-amber-800",
    tone: "division",
    blurb: "Approves track possessions, adjusts train timings, authorizes emergency blocks.",
  },
  DRM: {
    label: "Divisional Railway Manager",
    dept: "Executive Board",
    badge: "bg-rose-950 text-rose-300 border-rose-800",
    tone: "strategic",
    blurb: "Final authority — KPIs, escalated conflicts, budget approvals, safety oversight.",
  },
  SYSTEM_ADMIN: {
    label: "System Administrator",
    dept: "IT / Systems",
    badge: "bg-slate-800 text-slate-200 border-slate-600",
    tone: "system",
    blurb: "User accounts, access control, security and audit monitoring.",
  },
  DATA_ANALYST: {
    label: "Data Analyst (BI)",
    dept: "Business Intelligence",
    badge: "bg-cyan-950 text-cyan-300 border-cyan-800",
    tone: "system",
    blurb: "Read-only analytics across all maintenance, operations and budget data.",
  },
  CONTRACTOR: {
    label: "Contractor",
    dept: "External Vendor",
    badge: "bg-fuchsia-950 text-fuchsia-300 border-fuchsia-800",
    tone: "external",
    blurb: "Submits contracted work, tracks own schedule and completion certificates.",
  },
  AUDITOR: {
    label: "Auditor / Safety Inspector",
    dept: "Safety Directorate",
    badge: "bg-zinc-800 text-zinc-200 border-zinc-600",
    tone: "external",
    blurb: "Read-only compliance audit access — every action is immutably logged.",
  },
};

export interface NavItem {
  id: string;
  label: string;
  icon: any;
  /** Returns true when the role should see this view. */
  visible: (perms: UserPermissions, role: OfficialRole) => boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: "overview",
    label: "Command Center",
    icon: LayoutDashboard,
    visible: () => true,
  },
  {
    id: "requests",
    label: "Work Requests",
    icon: ClipboardList,
    visible: () => true,
  },
  {
    id: "approvals",
    label: "Approvals Queue",
    icon: ListChecks,
    visible: (p) => p.approve_requests,
  },
  {
    id: "possessions",
    label: "Possession Approvals",
    icon: TrainFront,
    visible: (p) => p.approve_possessions,
  },
  {
    id: "conflicts",
    label: "Conflict Center",
    icon: ShieldAlert,
    visible: () => true,
  },
  {
    id: "users",
    label: "User Administration",
    icon: Users,
    visible: (p) => p.manage_users,
  },
  {
    id: "audit",
    label: "Audit Trail",
    icon: FileSearch,
    visible: (p) => p.audit_readonly || p.manage_users || p.view_all,
  },
];

export const formatINR = (n: number | null | undefined) =>
  n == null ? "—" : `₹${n.toLocaleString("en-IN")}`;
