import React, { useCallback, useEffect, useState } from "react";
import { FileSearch } from "lucide-react";
import { AuditEvent } from "../types";
import { apiGet } from "../lib/api";
import { Card, SectionTitle, Badge, Spinner, Empty } from "../components/ui";

const ACTION_TONES: Record<string, string> = {
  LOGIN: "bg-sky-950 text-sky-300 border-sky-800",
  CREATE_WORK_REQUEST: "bg-blue-950 text-blue-300 border-blue-800",
  APPROVE_WORK_REQUEST: "bg-emerald-950 text-emerald-300 border-emerald-800",
  REJECT_WORK_REQUEST: "bg-rose-950 text-rose-300 border-rose-800",
  POSSESSION_APPROVED: "bg-amber-950 text-amber-300 border-amber-800",
  POSSESSION_REJECTED: "bg-orange-950 text-orange-300 border-orange-800",
  STATUTORY_OVERRIDE: "bg-fuchsia-950 text-fuchsia-300 border-fuchsia-800",
  TOGGLE_USER: "bg-violet-950 text-violet-300 border-violet-800",
  DELETE_WORK_REQUEST: "bg-rose-950 text-rose-300 border-rose-800",
};

export const AuditLog: React.FC = () => {
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const load = useCallback(() => {
    apiGet<AuditEvent[]>("/api/audit").then(setEvents).catch(() => setEvents([]));
  }, []);
  useEffect(load, [load]);

  return (
    <Card className="p-4 sm:p-5">
      <SectionTitle
        title="Audit Trail"
        sub="Immutable, timestamped record of every consequential action — required for DPDP Act and Railway Board compliance."
        right={<Badge tone="bg-slate-800 text-slate-300 border-slate-700">{events?.length ?? 0} events</Badge>}
      />

      {events === null ? (
        <div className="py-10 flex justify-center"><Spinner className="w-6 h-6" /></div>
      ) : events.length === 0 ? (
        <Empty text="No audit events recorded yet." />
      ) : (
        <div className="space-y-1.5">
          {events.map((e) => (
            <div key={e.id} className="flex items-start gap-3 bg-slate-950/60 border border-slate-800/70 rounded-lg px-3 py-2.5">
              <FileSearch className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={ACTION_TONES[e.action] || "bg-slate-800 text-slate-300 border-slate-700"}>{e.action}</Badge>
                  <span className="text-[11px] font-semibold text-slate-200">{e.user}</span>
                  <span className="text-[10px] text-slate-500">({e.role})</span>
                  <span className="text-[10px] font-mono text-cyan-400">{e.entity}</span>
                </div>
                {e.detail && <p className="text-[10px] text-slate-400 mt-1 truncate">{e.detail}</p>}
              </div>
              <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">
                {new Date(e.timestamp).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
