import React, { useCallback, useEffect, useState } from "react";
import { Check, X as XIcon, TrainFront } from "lucide-react";
import { PublicUser } from "../types";
import { apiGet, apiPost } from "../lib/api";
import { Card, SectionTitle, Button, Badge, PRIORITY_TONES, Spinner, Empty, fmtTime } from "../components/ui";

interface Possession {
  possession_id: string;
  section: string;
  possession_type: string;
  ohe_shutdown: boolean;
  assigned_start: string;
  assigned_end: string;
  work_request_id: string;
  title: string;
  priority: string;
  decision: string;
  decided_by?: string;
  decided_at?: string;
  note?: string;
}

export const Possessions: React.FC<{ user: PublicUser; showToast: (m: string, t?: "success" | "error") => void }> = ({
  user,
  showToast,
}) => {
  const [list, setList] = useState<Possession[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    apiGet<Possession[]>("/api/possessions").then(setList).catch(() => setList([]));
  }, []);
  useEffect(load, [load]);

  const decide = async (id: string, decision: "APPROVED" | "REJECTED") => {
    setBusy(id);
    try {
      await apiPost(`/api/possessions/${id}/decision`, {
        decision,
        note: `${decision} by ${user.name} (${user.role})`,
      });
      showToast(`Possession ${id} ${decision === "APPROVED" ? "approved — block issued." : "rejected."}`, decision === "APPROVED" ? "success" : "error");
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
        title="Track Possession Approvals"
        sub="Engineering blocks that impact train operations — approve only after verifying safety arrangements."
        right={<Badge tone="bg-amber-950 text-amber-300 border-amber-800">{list?.filter((p) => p.decision === "PENDING").length ?? 0} pending</Badge>}
      />

      {list === null ? (
        <div className="py-10 flex justify-center"><Spinner className="w-6 h-6" /></div>
      ) : list.length === 0 ? (
        <Empty text="No track possessions in the current master schedule." />
      ) : (
        <div className="space-y-3">
          {list.map((p) => {
            const pending = p.decision === "PENDING";
            return (
              <div key={p.possession_id} className={`border rounded-xl p-4 space-y-3 ${pending ? "bg-amber-950/15 border-amber-900/60" : "bg-slate-950/70 border-slate-800"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <TrainFront className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-slate-100">{p.title}</span>
                      <Badge tone={PRIORITY_TONES[p.priority]}>{p.priority}</Badge>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {p.possession_id} · {p.section} · {p.possession_type}
                      {p.ohe_shutdown ? " · ⚡ 25kV OHE isolated + earthing" : " · no traction isolation"}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {fmtTime(p.assigned_start)} → {fmtTime(p.assigned_end)} · linked work {p.work_request_id}
                    </div>
                  </div>
                  <Badge tone={pending ? "bg-amber-950 text-amber-300 border-amber-800" : p.decision === "APPROVED" ? "bg-emerald-950 text-emerald-300 border-emerald-800" : "bg-rose-950 text-rose-300 border-rose-800"}>
                    {p.decision}
                  </Badge>
                </div>

                {!pending && (
                  <div className="text-[10px] text-slate-500">
                    Decided by <span className="text-slate-300">{p.decided_by}</span> at {p.decided_at ? fmtTime(p.decided_at) : "—"}
                    {p.note ? ` · ${p.note}` : ""}
                  </div>
                )}

                {pending && (
                  <div className="flex items-center gap-2">
                    <Button variant="success" size="sm" disabled={busy === p.possession_id} onClick={() => decide(p.possession_id, "APPROVED")}>
                      <Check className="w-3 h-3" /> Approve Block
                    </Button>
                    <Button variant="danger" size="sm" disabled={busy === p.possession_id} onClick={() => decide(p.possession_id, "REJECTED")}>
                      <XIcon className="w-3 h-3" /> Reject
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};
