import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Info, Clock, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { WorkRequest, Conflict, PublicUser } from "../types";
import { apiGet } from "../lib/api";
import { Card, SectionTitle, Badge, Spinner, Empty } from "../components/ui";

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------
const HOUR_MS = 3600_000;
const DAY_MS = 86400_000;

/** Return midnight (IST) of the given date string. */
function dayStart(dateStr: string): number {
  const d = new Date(dateStr);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Position of a timestamp as fraction [0,1] within a 24h window. */
function timeFrac(ts: string, windowStart: number): number {
  return (new Date(ts).getTime() - windowStart) / DAY_MS;
}

/** Format ISO string → "HH:mm" (IST). */
function fmtTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
}

/** Short label for work type. */
const TYPE_SHORT: Record<string, string> = {
  TRACK_TAMPING: "Tamping",
  RAIL_GRINDING: "Grinding",
  RAIL_RENEWAL: "Rail Renewal",
  BALLAST_CLEANING: "Ballast Clean",
  BALLAST_REPLACEMENT: "Ballast Replace",
  SLEEPER_REPLACEMENT: "Sleeper Replace",
  SIGNALING_MAINTENANCE: "Signaling",
  OHE_MAINTENANCE: "OHE Maint.",
  COACH_IOH: "Coach IOH",
  COACH_POH: "Coach POH",
  WAGON_ROH: "Wagon ROH",
  LOCO_SCHEDULED: "Loco Maint.",
  BRIDGE_INSPECTION: "Bridge Insp.",
  USFD_TESTING: "USFD Test",
  LEVEL_CROSSING: "Level Crossing",
  DRAINAGE_WORK: "Drainage",
  VEGETATION_CLEARANCE: "Vegetation",
};

const PRIORITY_COLOR: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  CRITICAL: { bg: "bg-red-500/30", border: "border-red-400", text: "text-red-200", glow: "shadow-red-500/30" },
  HIGH: { bg: "bg-orange-500/30", border: "border-orange-400", text: "text-orange-200", glow: "shadow-orange-500/30" },
  MEDIUM: { bg: "bg-yellow-500/25", border: "border-yellow-400", text: "text-yellow-200", glow: "shadow-yellow-500/20" },
  LOW: { bg: "bg-emerald-500/25", border: "border-emerald-400", text: "text-emerald-200", glow: "shadow-emerald-500/20" },
};

const STATUS_DIM: Record<string, string> = {
  PENDING: "opacity-60",
  APPROVED: "",
  IN_PROGRESS: "",
  COMPLETED: "opacity-50",
  CANCELLED: "opacity-30 line-through",
};

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------
const Tooltip: React.FC<{ req: WorkRequest; x: number; y: number }> = ({ req, x, y }) => {
  const pc = PRIORITY_COLOR[req.priority] || PRIORITY_COLOR.MEDIUM;
  return (
    <div
      className="fixed z-50 pointer-events-none w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl shadow-black/50 p-3 space-y-2"
      style={{ left: x + 12, top: y - 8 }}
    >
      <div className="flex items-center gap-2">
        <Badge tone={`${pc.bg} ${pc.border} ${pc.text}`}>{req.priority}</Badge>
        <span className="text-[10px] text-slate-500 font-mono">{req.id}</span>
      </div>
      <div className="text-xs font-bold text-slate-100 leading-tight">{req.title}</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
        <div className="text-slate-500">Type</div>
        <div className="text-slate-300">{TYPE_SHORT[req.type] || req.type}</div>
        <div className="text-slate-500">Time (IST)</div>
        <div className="text-slate-300 font-mono">{fmtTime(req.duration.start_time)}–{fmtTime(req.duration.end_time)}</div>
        <div className="text-slate-500">Section</div>
        <div className="text-slate-300">{req.location.section_id}</div>
        <div className="text-slate-500">Track</div>
        <div className="text-slate-300">{req.location.track_number || "—"}</div>
        <div className="text-slate-500">Status</div>
        <div className="text-slate-300">{req.status}</div>
      </div>
      {req.constraints?.safety?.possession_type && (
        <div className="text-[10px] text-cyan-400 border-t border-slate-800 pt-1.5">
          Possession: {req.constraints.safety.possession_type}
          {req.constraints.safety.requires_ohe_shutdown && " · OHE Shutdown"}
          {req.constraints.safety.requires_earthing && " · Earthing"}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
interface ScheduleGanttProps {
  user: PublicUser;
}

export const ScheduleGantt: React.FC<ScheduleGanttProps> = ({ user }) => {
  const [requests, setRequests] = useState<WorkRequest[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ req: WorkRequest; x: number; y: number } | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reqs, cons] = await Promise.all([
        apiGet<WorkRequest[]>("/api/work-requests"),
        apiGet<Conflict[]>("/api/conflicts"),
      ]);
      setRequests(reqs);
      setConflicts(cons);
      // Default to the first request's day
      if (reqs.length > 0 && !selectedDay) {
        setSelectedDay(reqs[0].duration.start_time.slice(0, 10));
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Unique days from requests
  const days = useMemo(() => {
    const set = new Set(requests.map((r) => r.duration.start_time.slice(0, 10)));
    return Array.from(set).sort();
  }, [requests]);

  // Navigate days
  const dayIdx = days.indexOf(selectedDay);
  const prevDay = () => dayIdx > 0 && setSelectedDay(days[dayIdx - 1]);
  const nextDay = () => dayIdx < days.length - 1 && setSelectedDay(days[dayIdx + 1]);

  // Filter requests for selected day
  const dayRequests = useMemo(() => {
    if (!selectedDay) return [];
    const start = dayStart(selectedDay);
    const end = start + DAY_MS;
    return requests.filter((r) => {
      const t = new Date(r.duration.start_time).getTime();
      return t >= start && t < end;
    });
  }, [requests, selectedDay]);

  // Conflicts for visible requests
  const visibleConflictIds = useMemo(() => {
    const ids = new Set<string>();
    const reqIds = new Set(dayRequests.map((r) => r.id));
    conflicts.forEach((c) => {
      if (c.work_requests.some((id) => reqIds.has(id))) {
        ids.add(c.id);
      }
    });
    return ids;
  }, [dayRequests, conflicts]);

  // Group by track section
  const sections = useMemo(() => {
    const map = new Map<string, WorkRequest[]>();
    dayRequests.forEach((r) => {
      const key = r.location.station_proximity || r.location.section_id || "Unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [dayRequests]);

  const windowStart = selectedDay ? dayStart(selectedDay) : Date.now();

  // Hour markers for 24h
  const hours = Array.from({ length: 25 }, (_, i) => i);

  // NTH highlight (01:30 – 05:30 IST = 06:00 – 10:00 UTC for IST+5:30)
  // In IST: 1:30 AM = 01:30, 5:30 AM = 05:30
  const nthStart = 1.5 / 24; // 01:30 as fraction
  const nthEnd = 5.5 / 24;   // 05:30 as fraction

  return (
    <Card className="p-4 sm:p-5">
      <SectionTitle
        title="Schedule Gantt"
        sub="24-hour timeline of maintenance work. Bars show assigned work by time window — drag to inspect details."
        right={
          <div className="flex items-center gap-2">
            <Badge tone="bg-slate-800 text-slate-300 border-slate-700">{dayRequests.length} works</Badge>
            {visibleConflictIds.size > 0 && (
              <Badge tone="bg-red-950 text-red-300 border-red-800">{visibleConflictIds.size} conflicts</Badge>
            )}
          </div>
        }
      />

      {/* Day selector */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={prevDay} disabled={dayIdx <= 0} className="p-1 rounded hover:bg-slate-800 disabled:opacity-30">
          <ChevronLeft className="w-4 h-4 text-slate-400" />
        </button>
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold text-slate-200">
            {selectedDay ? new Date(selectedDay + "T12:00:00Z").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "—"}
          </span>
        </div>
        <button onClick={nextDay} disabled={dayIdx >= days.length - 1} className="p-1 rounded hover:bg-slate-800 disabled:opacity-30">
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
        {days.length === 0 && !loading && (
          <span className="text-[10px] text-slate-600">No work requests with scheduled dates</span>
        )}
      </div>

      {loading ? (
        <div className="py-16 flex justify-center"><Spinner className="w-6 h-6" /></div>
      ) : sections.length === 0 ? (
        <Empty text="No work requests scheduled for this day." />
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Time axis header */}
            <div className="flex border-b border-slate-800 pb-1 mb-1">
              <div className="w-44 flex-shrink-0 text-[10px] text-slate-500 font-semibold px-2">Section</div>
              <div className="flex-1 relative h-5">
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute top-0 text-[9px] text-slate-600 font-mono"
                    style={{ left: `${(h / 24) * 100}%`, transform: "translateX(-50%)" }}
                  >
                    {h === 0 ? "12AM" : h < 12 ? `${h}AM` : h === 12 ? "12PM" : `${h - 12}PM`}
                  </div>
                ))}
              </div>
            </div>

            {/* NTH highlight bar */}
            <div className="flex mb-0.5">
              <div className="w-44 flex-shrink-0 text-[9px] text-cyan-600 font-semibold px-2 flex items-center gap-1">
                <Clock className="w-3 h-3" /> NTH Window
              </div>
              <div className="flex-1 relative h-3">
                <div
                  className="absolute inset-y-0 bg-cyan-500/10 border-x border-cyan-500/30"
                  style={{ left: `${nthStart * 100}%`, width: `${(nthEnd - nthStart) * 100}%` }}
                />
              </div>
            </div>

            {/* Section rows */}
            {sections.map(([section, reqs]) => (
              <div key={section} className="flex border-b border-slate-800/50 group">
                {/* Section label */}
                <div className="w-44 flex-shrink-0 px-2 py-2.5 flex flex-col justify-center">
                  <div className="text-[11px] font-bold text-slate-200 leading-tight truncate">{section}</div>
                  <div className="text-[9px] text-slate-500 mt-0.5">{reqs.length} work{reqs.length !== 1 ? "s" : ""}</div>
                </div>

                {/* Timeline area */}
                <div className="flex-1 relative py-2" style={{ minHeight: `${Math.max(reqs.length * 32 + 8, 40)}px` }}>
                  {/* Hour grid lines */}
                  {hours.filter((h) => h % 3 === 0).map((h) => (
                    <div
                      key={h}
                      className="absolute top-0 bottom-0 border-l border-slate-800/40"
                      style={{ left: `${(h / 24) * 100}%` }}
                    />
                  ))}

                  {/* NTH zone background */}
                  <div
                    className="absolute inset-y-0 bg-cyan-500/5 border-x border-cyan-500/15"
                    style={{ left: `${nthStart * 100}%`, width: `${(nthEnd - nthStart) * 100}%` }}
                  />

                  {/* Work bars */}
                  {reqs.map((req, i) => {
                    const start = timeFrac(req.duration.start_time, windowStart);
                    const end = timeFrac(req.duration.end_time, windowStart);
                    const width = Math.max(end - start, 0.005);
                    const pc = PRIORITY_COLOR[req.priority] || PRIORITY_COLOR.MEDIUM;
                    const isConflict = visibleConflictIds.size > 0 && conflicts.some(
                      (c) => c.work_requests.includes(req.id) && visibleConflictIds.has(c.id)
                    );
                    const st = STATUS_DIM[req.status] || "";

                    return (
                      <div
                        key={req.id}
                        className={`absolute rounded-md border ${pc.border} ${pc.bg} ${pc.glow} shadow-md cursor-pointer hover:brightness-125 hover:scale-y-110 transition-all ${st}`}
                        style={{
                          left: `${start * 100}%`,
                          width: `${width * 100}%`,
                          top: `${i * 32 + 4}px`,
                          height: "26px",
                        }}
                        onMouseEnter={(e) => setTooltip({ req, x: e.clientX, y: e.clientY })}
                        onMouseMove={(e) => setTooltip({ req, x: e.clientX, y: e.clientY })}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        <div className="flex items-center h-full px-2 gap-1.5 overflow-hidden">
                          {isConflict && <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0 animate-pulse" />}
                          <span className={`text-[10px] font-bold ${pc.text} truncate`}>
                            {TYPE_SHORT[req.type] || req.type}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono flex-shrink-0">
                            {fmtTime(req.duration.start_time)}–{fmtTime(req.duration.end_time)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-800/50 flex-wrap">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <Info className="w-3 h-3" /> Priority:
              </div>
              {Object.entries(PRIORITY_COLOR).map(([p, c]) => (
                <div key={p} className="flex items-center gap-1">
                  <div className={`w-3 h-3 rounded ${c.bg} border ${c.border}`} />
                  <span className="text-[10px] text-slate-400">{p}</span>
                </div>
              ))}
              <div className="flex items-center gap-1 ml-2">
                <div className="w-3 h-3 rounded bg-cyan-500/10 border border-cyan-500/30" />
                <span className="text-[10px] text-slate-400">NTH Window (01:30–05:30)</span>
              </div>
              <div className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-red-400 animate-pulse" />
                <span className="text-[10px] text-slate-400">Conflict</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tooltip */}
      {tooltip && <Tooltip req={tooltip.req} x={tooltip.x} y={tooltip.y} />}
    </Card>
  );
};
