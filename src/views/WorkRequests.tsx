import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, Trash2, Check, X as XIcon, Wrench } from "lucide-react";
import { PublicUser, WorkRequest, WorkType, PriorityLevel } from "../types";
import { apiDelete, apiGet, apiPost } from "../lib/api";
import {
  Card,
  SectionTitle,
  Button,
  Badge,
  PRIORITY_TONES,
  STATUS_TONES,
  Modal,
  Field,
  inputCls,
  selectCls,
  Spinner,
  Empty,
  fmtTime,
} from "../components/ui";
import { formatINR } from "../lib/roles";

interface Props {
  user: PublicUser;
  showToast: (msg: string, tone?: "success" | "error") => void;
}

export const WorkRequests: React.FC<Props> = ({ user, showToast }) => {
  const [requests, setRequests] = useState<WorkRequest[] | null>(null);
  const [filterType, setFilterType] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [q, setQ] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [decisionBusy, setDecisionBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    apiGet<WorkRequest[]>("/api/work-requests").then(setRequests).catch(() => setRequests([]));
  }, []);

  useEffect(load, [load]);

  const filtered = useMemo(() => {
    if (!requests) return [];
    return requests.filter(
      (r) =>
        (filterType === "ALL" || r.type === filterType) &&
        (filterStatus === "ALL" || r.status === filterStatus) &&
        (!q || (r.title + r.id + r.location.section_id).toLowerCase().includes(q.toLowerCase()))
    );
  }, [requests, filterType, filterStatus, q]);

  const handleDecision = async (id: string, decision: "APPROVED" | "REJECTED", note: string) => {
    setDecisionBusy(id);
    try {
      await apiPost(`/api/work-requests/${id}/decision`, { decision, note });
      showToast(`Request ${id} ${decision === "APPROVED" ? "approved" : "rejected"}.`, decision === "APPROVED" ? "success" : "error");
      load();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setDecisionBusy(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiDelete(`/api/work-requests/${id}`);
      showToast(`Request ${id} deleted.`);
      load();
    } catch (e: any) {
      showToast(e.message, "error");
    }
  };

  return (
    <Card className="p-4 sm:p-5">
      <SectionTitle
        title="Work Requests"
        sub="Role-scoped view of all maintenance work orders in your jurisdiction."
        right={
          user.permissions.create_requests ? (
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="w-3.5 h-3.5" /> New Work Request
            </Button>
          ) : (
            <Badge tone="bg-slate-800 text-slate-400 border-slate-700">Read-only access</Badge>
          )
        }
      />

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, ID, section..."
            className={`${inputCls} pl-9`} />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={selectCls} aria-label="Filter by type">
          <option value="ALL">All work types</option>
          {["TRACK_TAMPING", "RAIL_GRINDING", "SIGNALING_MAINTENANCE", "OHE_MAINTENANCE", "COACH_IOH", "COACH_POH", "WAGON_ROH", "USFD_TESTING", "BALLAST_CLEANING", "RAIL_RENEWAL", "BRIDGE_INSPECTION", "LOCO_SCHEDULE"].map((t) => (
            <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectCls} aria-label="Filter by status">
          <option value="ALL">All statuses</option>
          {["PENDING", "APPROVED", "REJECTED", "SCHEDULED", "IN_PROGRESS", "COMPLETED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {requests === null ? (
        <div className="py-10 flex justify-center"><Spinner className="w-6 h-6" /></div>
      ) : filtered.length === 0 ? (
        <Empty text="No work requests match your filters." />
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <div key={r.id} className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-100">{r.title}</span>
                    <Badge tone={PRIORITY_TONES[r.priority]}>{r.priority}</Badge>
                    <Badge tone={STATUS_TONES[r.status] || "bg-slate-800 text-slate-300 border-slate-700"}>{r.status}</Badge>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {r.id} · {r.type} · {r.location.section_id} ({r.location.station_proximity})
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {fmtTime(r.duration.start_time)} → {fmtTime(r.duration.end_time)} · {r.constraints.safety.possession_type}
                    {r.constraints.safety.requires_ohe_shutdown ? " · ⚡ OHE shutdown" : ""}
                    {r.constraints.time_window.is_non_traffic_hours_mandatory ? " · 🌙 NTH mandatory" : ""}
                  </div>
                  <div className="text-[10px] text-slate-600">
                    Submitted by {r.metadata.created_by} · Source: {r.metadata.source}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {r.status === "PENDING" && user.permissions.approve_requests && (
                    <>
                      <Button variant="success" size="sm" disabled={decisionBusy === r.id}
                        onClick={() => handleDecision(r.id, "APPROVED", "")}>
                        <Check className="w-3 h-3" /> Approve
                      </Button>
                      <Button variant="danger" size="sm" disabled={decisionBusy === r.id}
                        onClick={() => handleDecision(r.id, "REJECTED", "Rejected by " + user.name)}>
                        <XIcon className="w-3 h-3" /> Reject
                      </Button>
                    </>
                  )}
                  {user.permissions.create_requests && (
                    <button onClick={() => handleDelete(r.id)} title="Delete"
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950 text-slate-500 hover:text-rose-400 border border-slate-800 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateRequestModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        user={user}
        onCreated={(msg) => { showToast(msg); setShowCreate(false); load(); }}
      />
    </Card>
  );
};

// ---------------- Create Work Request Modal ----------------

const CreateRequestModal: React.FC<{
  open: boolean;
  onClose: () => void;
  user: PublicUser;
  onCreated: (msg: string) => void;
}> = ({ open, onClose, user, onCreated }) => {
  const [form, setForm] = useState({
    title: "",
    type: "TRACK_TAMPING" as WorkType,
    priority: "HIGH" as PriorityLevel,
    section: "UP-126.0-126.8",
    chainageStart: 126.0,
    chainageEnd: 126.8,
    station: "TKJ-ANVR",
    start: "2026-08-19T02:00",
    end: "2026-08-19T04:30",
    nth: true,
    ohe: true,
    possession: "FULL_BLOCK",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");
    const startIso = new Date(form.start).toISOString();
    const endIso = new Date(form.end).toISOString();
    try {
      const payload: Partial<WorkRequest> = {
        title: form.title,
        type: form.type,
        priority: form.priority,
        status: "PENDING",
        location: {
          type: "TRACK_SECTION",
          section_id: form.section,
          chainage_start: form.chainageStart,
          chainage_end: form.chainageEnd,
          track_number: form.section.startsWith("UP") ? "UP" : form.section.startsWith("DN") ? "DN" : "LOOP_1",
          station_proximity: form.station,
          is_electrified: true,
        },
        duration: {
          start_time: startIso,
          end_time: endIso,
          setup_time_mins: 20,
          teardown_time_mins: 15,
          estimated_duration_hours: Math.round(((new Date(endIso).getTime() - new Date(startIso).getTime()) / 36e5) * 10) / 10,
        },
        resources: {
          personnel: [
            { gang_id: "GANG-001", role: "GANG_MATE", count: 1 },
            { role: "WORKER", count: 8 },
          ],
          equipment: form.type === "TRACK_TAMPING" ? [{ type: "TAMPING_CSM", equipment_id: "TAMPING-CSM-03" }] : [],
          engineering_train: null,
        },
        constraints: {
          time_window: {
            earliest_start: startIso,
            latest_end: endIso,
            preferred_slots: [form.start.slice(11, 16) + "-" + form.end.slice(11, 16)],
            is_non_traffic_hours_mandatory: form.nth,
          },
          safety: {
            possession_type: form.possession as any,
            requires_earthing: form.ohe,
            requires_ohe_shutdown: form.ohe,
            requires_adjacent_caution: false,
          },
          dependencies: { prerequisites: [], successors: [] },
          compatibility: { compatible_with: [], incompatible_with: form.type === "TRACK_TAMPING" ? ["RAIL_GRINDING"] : [] },
        },
        metadata: {
          created_by: user.name,
          role: user.role,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          source: user.role === "CONTRACTOR" ? "EXTERNAL_CONTRACTOR" : "MANUAL",
          notes: `Submitted via portal as ${user.role}`,
        },
      };
      const res = await apiPost<{ request: WorkRequest }>("/api/work-requests", payload);
      onCreated(`Work request ${res.request.id} submitted for approval.`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Submit Maintenance Work Request" wide>
      <div className="space-y-3 text-xs">
        {user.budget_limit != null && user.permissions.approve_requests && (
          <div className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-[10px] text-slate-500">
            Your approval ceiling: <span className="text-cyan-300 font-mono font-semibold">{formatINR(user.budget_limit)}</span> — requests above this auto-escalate to the next authority.
          </div>
        )}
        {error && <div className="rounded-lg border border-rose-800 bg-rose-950/40 px-3 py-2 text-[11px] text-rose-200">{error}</div>}

        <Field label="Work Title *">
          <input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Mainline Track Tamping KM 126.0–126.8 UP" />
        </Field>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Work Type">
            <select className={selectCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as WorkType })}>
              {["TRACK_TAMPING", "RAIL_GRINDING", "SIGNALING_MAINTENANCE", "OHE_MAINTENANCE", "COACH_IOH", "WAGON_ROH", "USFD_TESTING", "BALLAST_CLEANING", "RAIL_RENEWAL", "BRIDGE_INSPECTION"].map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select className={selectCls} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as PriorityLevel })}>
              <option value="CRITICAL">Critical (Safety)</option>
              <option value="HIGH">High (Service-impacting)</option>
              <option value="MEDIUM">Medium (Preventive)</option>
              <option value="LOW">Low (Cosmetic)</option>
            </select>
          </Field>
          <Field label="Possession Type">
            <select className={selectCls} value={form.possession} onChange={(e) => setForm({ ...form, possession: e.target.value })}>
              <option value="FULL_BLOCK">Full Block</option>
              <option value="PARTIAL_BLOCK">Partial Block</option>
              <option value="CAUTION_ORDER">Caution Order</option>
              <option value="DEPOT_BAY_BLOCK">Depot Bay Block</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Section ID">
            <input className={inputCls} value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} />
          </Field>
          <Field label="Start Chainage (km)">
            <input type="number" step="0.1" className={inputCls} value={form.chainageStart}
              onChange={(e) => setForm({ ...form, chainageStart: parseFloat(e.target.value) })} />
          </Field>
          <Field label="End Chainage (km)">
            <input type="number" step="0.1" className={inputCls} value={form.chainageEnd}
              onChange={(e) => setForm({ ...form, chainageEnd: parseFloat(e.target.value) })} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start">
            <input type="datetime-local" className={inputCls} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
          </Field>
          <Field label="End">
            <input type="datetime-local" className={inputCls} value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-slate-950 rounded-lg border border-slate-800 px-3 py-2.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.nth} onChange={(e) => setForm({ ...form, nth: e.target.checked })}
              className="rounded bg-slate-900 border-slate-700 text-blue-500" />
            Non-Traffic Hours mandatory (01:30–05:30)
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.ohe} onChange={(e) => setForm({ ...form, ohe: e.target.checked })}
              className="rounded bg-slate-900 border-slate-700 text-blue-500" />
            25kV OHE shutdown + earthing
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !form.title}>
            <Wrench className="w-3.5 h-3.5" /> {busy ? "Submitting..." : "Submit for Approval"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
