import React, { useCallback, useEffect, useState } from "react";
import { ShieldAlert, Lock } from "lucide-react";
import { PublicUser, Conflict } from "../types";
import { apiGet, apiPost } from "../lib/api";
import { Card, SectionTitle, Badge, SEVERITY_TONES, Spinner, Empty, Modal, Button, inputCls } from "../components/ui";

export const Conflicts: React.FC<{ user: PublicUser; showToast: (m: string, t?: "success" | "error") => void }> = ({
  user,
  showToast,
}) => {
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [overrideTarget, setOverrideTarget] = useState<Conflict | null>(null);
  const [justification, setJustification] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiGet<Conflict[]>("/api/conflicts").then(setConflicts).catch(() => setConflicts([]));
  }, []);
  useEffect(load, [load]);

  const canOverride = user.permissions.approve_requests && user.permissions.view_all;

  const doOverride = async () => {
    if (!overrideTarget || !justification.trim()) return;
    setBusy(true);
    try {
      await apiPost(`/api/conflicts/${overrideTarget.id}/override`, {
        justification,
        overrideBy: user.name,
      });
      showToast(`Statutory override recorded for ${overrideTarget.id}. Audit trail updated.`, "error");
      setOverrideTarget(null);
      setJustification("");
      load();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const categories = ["ALL", "SPATIAL", "RESOURCE", "SAFETY", "TEMPORAL", "DEPENDENCY"];
  const [cat, setCat] = useState("ALL");
  const filtered = conflicts?.filter((c) => cat === "ALL" || c.type === cat) || [];

  return (
    <Card className="p-4 sm:p-5">
      <SectionTitle
        title="Conflict Center"
        sub="5-category detection engine — spatial, resource, safety, temporal, dependency."
        right={<Badge tone={conflicts?.some((c) => c.severity === "CRITICAL") ? "bg-rose-950 text-rose-300 border-rose-800" : "bg-emerald-950 text-emerald-300 border-emerald-800"}>
          {conflicts?.filter((c) => c.status === "OPEN").length ?? 0} open
        </Badge>}
      />

      <div className="flex gap-2 overflow-x-auto pb-3 mb-4">
        {categories.map((c) => (
          <button key={c} onClick={() => setCat(c)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap border transition ${
              cat === c ? "bg-rose-900/50 text-rose-200 border-rose-700" : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
            }`}>
            {c === "ALL" ? "All Categories" : c}
          </button>
        ))}
      </div>

      {conflicts === null ? (
        <div className="py-10 flex justify-center"><Spinner className="w-6 h-6" /></div>
      ) : filtered.length === 0 ? (
        <Empty text="No conflicts in this category." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((c) => (
            <div key={c.id} className={`p-4 rounded-xl border space-y-2 ${
              c.status === "OVERRIDDEN" ? "bg-slate-950/60 border-slate-800 opacity-70"
              : c.severity === "CRITICAL" ? "bg-rose-950/25 border-rose-900/60"
              : "bg-amber-950/20 border-amber-900/50"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className={`w-4 h-4 ${c.severity === "CRITICAL" ? "text-rose-400" : "text-amber-400"}`} />
                  <Badge tone={SEVERITY_TONES[c.severity]}>{c.type} · {c.severity}</Badge>
                </div>
                <span className="text-[10px] font-mono text-slate-500">{c.id}</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">{c.description}</p>
              <div className="text-[10px] text-slate-500">Affected: {c.work_requests.join(", ")}</div>
              <ul className="space-y-1 text-[10px] text-slate-400">
                {c.resolution_suggestions.slice(0, 2).map((s, i) => (
                  <li key={i} className="flex gap-1.5"><span className="text-amber-400">→</span>{s}</li>
                ))}
              </ul>
              {c.status === "OVERRIDDEN" && (
                <div className="text-[10px] text-slate-500 bg-slate-900/60 rounded p-2">
                  Overridden by <span className="text-slate-300">{c.override_by}</span>: “{c.override_justification}”
                </div>
              )}
              {canOverride && c.status === "OPEN" && (
                <Button variant="outline" size="sm" className="w-full justify-center mt-1" onClick={() => setOverrideTarget(c)}>
                  <Lock className="w-3 h-3 text-amber-400" /> Statutory Override
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={!!overrideTarget} onClose={() => setOverrideTarget(null)} title="Statutory Safety Override">
        <div className="space-y-3 text-xs">
          <p className="text-slate-400 leading-relaxed">
            Overriding <span className="text-rose-300 font-semibold">{overrideTarget?.id}</span> ({overrideTarget?.type} · {overrideTarget?.severity}).
            This action requires senior divisional authority and is permanently logged.
          </p>
          <textarea
            rows={3}
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Mandatory technical justification — e.g. special caution order with flagman protection..."
            className={`${inputCls} resize-none`}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOverrideTarget(null)}>Cancel</Button>
            <Button variant="danger" disabled={busy || !justification.trim()} onClick={doOverride}>
              {busy ? "Recording..." : "Confirm Override"}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
};
