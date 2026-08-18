import React, { useCallback, useEffect, useState } from "react";
import { Check, X as XIcon, ListChecks } from "lucide-react";
import { PublicUser, WorkRequest } from "../types";
import { apiGet, apiPost } from "../lib/api";
import { Card, SectionTitle, Button, Badge, PRIORITY_TONES, Spinner, Empty, fmtTime } from "../components/ui";
import { formatINR } from "../lib/roles";

export const Approvals: React.FC<{ user: PublicUser; showToast: (m: string, t?: "success" | "error") => void }> = ({
  user,
  showToast,
}) => {
  const [pending, setPending] = useState<WorkRequest[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    apiGet<WorkRequest[]>("/api/approvals").then(setPending).catch(() => setPending([]));
  }, []);
  useEffect(load, [load]);

  const decide = async (id: string, decision: "APPROVED" | "REJECTED") => {
    setBusy(id);
    try {
      await apiPost(`/api/work-requests/${id}/decision`, { decision, note: notes[id] || "" });
      showToast(`Request ${id} ${decision === "APPROVED" ? "approved ✓" : "rejected ✗"}.`, decision === "APPROVED" ? "success" : "error");
      load();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="p-4 sm:p-5">
      <SectionTitle
        title="Approvals Queue"
        sub={`Work requests awaiting your decision · approval ceiling ${formatINR(user.budget_limit)}`}
        right={<Badge tone="bg-emerald-950 text-emerald-300 border-emerald-800">{pending?.length ?? 0} waiting</Badge>}
      />

      {pending === null ? (
        <div className="py-10 flex justify-center"><Spinner className="w-6 h-6" /></div>
      ) : pending.length === 0 ? (
        <Empty text="Queue clear — nothing awaiting your approval." />
      ) : (
        <div className="space-y-3">
          {pending.map((r) => (
            <div key={r.id} className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-100">{r.title}</span>
                    <Badge tone={PRIORITY_TONES[r.priority]}>{r.priority}</Badge>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {r.id} · {r.type} · {r.location.section_id}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {fmtTime(r.duration.start_time)} → {fmtTime(r.duration.end_time)} · {r.constraints.safety.possession_type}
                    {r.constraints.safety.requires_ohe_shutdown ? " · ⚡ OHE" : ""}
                  </div>
                  <div className="text-[10px] text-slate-600">Submitted by {r.metadata.created_by} · {r.metadata.source}</div>
                </div>
                <Badge tone={r.priority === "CRITICAL" ? "bg-rose-950 text-rose-300 border-rose-800" : "bg-slate-800 text-slate-400 border-slate-700"}>
                  {r.priority === "CRITICAL" ? "Escalate / immediate" : "Standard"}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={notes[r.id] || ""}
                  onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                  placeholder="Optional approval note (audit logged)..."
                  className="flex-1 min-w-40 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-[11px] text-slate-200 focus:outline-none focus:border-emerald-500 placeholder:text-slate-600"
                />
                <Button variant="success" size="sm" disabled={busy === r.id} onClick={() => decide(r.id, "APPROVED")}>
                  <Check className="w-3 h-3" /> Approve
                </Button>
                <Button variant="danger" size="sm" disabled={busy === r.id} onClick={() => decide(r.id, "REJECTED")}>
                  <XIcon className="w-3 h-3" /> Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-1.5 text-[10px] text-slate-500">
        <ListChecks className="w-3.5 h-3.5 text-emerald-400" />
        Every decision is written to the immutable audit trail with your identity and timestamp.
      </div>
    </Card>
  );
};
