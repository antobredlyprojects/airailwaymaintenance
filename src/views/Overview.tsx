import React, { useEffect, useState } from "react";
import { ShieldAlert, ClipboardList, TrainFront, Cpu, ListChecks, Wrench } from "lucide-react";
import { PublicUser, WorkRequest, Conflict, Schedule } from "../types";
import { apiGet } from "../lib/api";
import { Card, Stat, Badge, Spinner, Empty, PRIORITY_TONES } from "../components/ui";
import { ROLE_META } from "../lib/roles";

interface OverviewProps {
  user: PublicUser;
  onNavigate: (v: string) => void;
}

export const Overview: React.FC<OverviewProps> = ({ user, onNavigate }) => {
  const [requests, setRequests] = useState<WorkRequest[] | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [pending, setPending] = useState<WorkRequest[] | null>(null);
  const [possessions, setPossessions] = useState<any[] | null>(null);

  useEffect(() => {
    apiGet<WorkRequest[]>("/api/work-requests").then(setRequests).catch(() => setRequests([]));
    apiGet<Conflict[]>("/api/conflicts").then(setConflicts).catch(() => setConflicts([]));
    apiGet<Schedule>("/api/schedule").then(setSchedule).catch(() => setSchedule(null));
    if (user.permissions.approve_requests)
      apiGet<WorkRequest[]>("/api/approvals").then(setPending).catch(() => setPending([]));
    if (user.permissions.approve_possessions)
      apiGet<any[]>("/api/possessions").then(setPossessions).catch(() => setPossessions([]));
  }, [user]);

  const meta = ROLE_META[user.role];
  const critical = conflicts?.filter((c) => c.severity === "CRITICAL" && c.status === "OPEN").length || 0;
  const pendingCount = pending?.filter((r) => r.status === "PENDING").length ?? 0;
  const possessionPending = possessions?.filter((p) => p.decision === "PENDING").length ?? 0;

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <Card className="p-5 bg-gradient-to-r from-slate-900 via-blue-950/40 to-slate-900 border-slate-800">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${meta.badge}`}>
                {meta.label}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">{user.username}</span>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight">
              Welcome, {user.name.split(" ")[0]}
            </h1>
            <p className="text-xs text-slate-400 max-w-xl">{meta.blurb}</p>
            {user.scope?.tags?.length > 0 && (
              <p className="text-[10px] text-slate-500 pt-1">
                Data scope:{" "}
                {user.scope.tags.map((t, i) => (
                  <React.Fragment key={t}>
                    {i > 0 && <span className="text-slate-600">, </span>}
                    <span className="font-mono text-cyan-400">{t}</span>
                  </React.Fragment>
                ))}
              </p>
            )}
          </div>
          <div className="text-right text-[10px] text-slate-500">
            <div className="font-mono text-slate-400">{user.designation}</div>
            <div className="mt-0.5">{user.department}</div>
          </div>
        </div>
      </Card>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label="Work Requests (my scope)"
          value={requests ? requests.length : "—"}
          icon={<Wrench className="w-4 h-4 text-blue-400" />}
          onClick={() => onNavigate("requests")}
        />
        <Stat
          label="Open Conflicts"
          value={conflicts ? conflicts.length : "—"}
          icon={<ShieldAlert className="w-4 h-4 text-rose-400" />}
          accent={critical > 0 ? "text-rose-300" : "text-amber-300"}
          onClick={() => onNavigate("conflicts")}
        />
        <Stat
          label="Possessions in Schedule"
          value={schedule ? schedule.work_assignments.length : "—"}
          icon={<TrainFront className="w-4 h-4 text-emerald-400" />}
          onClick={() => onNavigate("possessions")}
        />
        <Stat
          label="Schedule Fitness"
          value={schedule ? `${Math.round((schedule.optimization_metadata.fitness_score || 0) * 100)}%` : "—"}
          icon={<Cpu className="w-4 h-4 text-indigo-400" />}
          onClick={() => onNavigate("overview")}
        />
      </div>

      {/* Role-specific action panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {user.permissions.approve_requests && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <ListChecks className="w-4 h-4 text-emerald-400" /> Pending Your Approval
              </span>
              <Badge tone={pendingCount > 0 ? "bg-emerald-950 text-emerald-300 border-emerald-800" : "bg-slate-800 text-slate-400 border-slate-700"}>
                {pendingCount} waiting
              </Badge>
            </div>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {pending && pending.length === 0 && <Empty text="No pending approvals in your scope." />}
              {pending?.slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-slate-200 truncate">{r.title}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{r.id} · {r.type}</div>
                  </div>
                  <Badge tone={PRIORITY_TONES[r.priority]}>{r.priority}</Badge>
                </div>
              ))}
            </div>
            {pendingCount > 0 && (
              <button onClick={() => onNavigate("approvals")} className="mt-3 w-full py-2 rounded-lg bg-emerald-700/20 hover:bg-emerald-700/40 text-emerald-300 border border-emerald-800/60 text-xs font-semibold transition">
                Open Approvals Queue →
              </button>
            )}
          </Card>
        )}

        {user.permissions.approve_possessions && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <TrainFront className="w-4 h-4 text-amber-400" /> Possession Requests
              </span>
              <Badge tone={possessionPending > 0 ? "bg-amber-950 text-amber-300 border-amber-800" : "bg-slate-800 text-slate-400 border-slate-700"}>
                {possessionPending} pending
              </Badge>
            </div>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {possessions && possessions.length === 0 && <Empty text="No possessions in the master schedule." />}
              {possessions?.filter((p) => p.decision === "PENDING").slice(0, 5).map((p) => (
                <div key={p.possession_id} className="bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-2">
                  <div className="text-[11px] font-semibold text-slate-200 truncate">{p.title}</div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {p.section} · {p.possession_type} · {p.ohe_shutdown ? "⚡ OHE isolated" : "no OHE"}
                  </div>
                </div>
              ))}
            </div>
            {possessionPending > 0 && (
              <button onClick={() => onNavigate("possessions")} className="mt-3 w-full py-2 rounded-lg bg-amber-700/20 hover:bg-amber-700/40 text-amber-300 border border-amber-800/60 text-xs font-semibold transition">
                Open Possession Queue →
              </button>
            )}
          </Card>
        )}

        {!user.permissions.approve_requests && !user.permissions.approve_possessions && (
          <Card className="p-4 lg:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-slate-200">Your Recent Work</span>
            </div>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {requests && requests.length === 0 && <Empty text="No work requests in your scope yet." />}
              {requests?.slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-slate-200 truncate">{r.title}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{r.id} · {r.location.section_id}</div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Badge tone={PRIORITY_TONES[r.priority]}>{r.priority}</Badge>
                    <Badge tone={r.status === "APPROVED" ? "bg-emerald-950 text-emerald-300 border-emerald-800" : r.status === "PENDING" ? "bg-amber-950 text-amber-300 border-amber-800" : "bg-slate-800 text-slate-300 border-slate-700"}>
                      {r.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Conflict spotlight */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-500" /> Active Conflict Spotlight
            </span>
            <button onClick={() => onNavigate("conflicts")} className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold">
              View all →
            </button>
          </div>
          {conflicts === null ? (
            <div className="py-6 flex justify-center"><Spinner /></div>
          ) : conflicts.length === 0 ? (
            <Empty text="No conflicts detected in your scope. Clean slate. 🎉" />
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {conflicts.slice(0, 5).map((c) => (
                <div key={c.id} className={`rounded-lg border px-3 py-2 ${c.severity === "CRITICAL" ? "bg-rose-950/30 border-rose-900/60" : "bg-amber-950/25 border-amber-900/50"}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold ${c.severity === "CRITICAL" ? "text-rose-300" : "text-amber-300"}`}>
                      {c.type} · {c.severity}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">{c.id}</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-snug mt-1">{c.description}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
