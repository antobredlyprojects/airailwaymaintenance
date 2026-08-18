import { WorkRequest, Conflict, PersonnelGang, MaintenanceEquipment } from "../../types";

// ---------------------------------------------------------------------------
// Safe field accessors — work requests can arrive sparse (drafts, API calls,
// Gemini parsing), so the detector must never assume deep structure exists.
// ---------------------------------------------------------------------------
type SparseLocation = {
  type?: string;
  section_id?: string;
  track_number?: string;
  chainage_start?: number;
  chainage_end?: number;
};
type SparseDuration = { start_time?: string; end_time?: string };
type SparseTimeWindow = { is_non_traffic_hours_mandatory?: boolean };

const locationOf = (r: WorkRequest): SparseLocation => (r.location ?? {}) as SparseLocation;
const durationOf = (r: WorkRequest): SparseDuration => (r.duration ?? {}) as SparseDuration;
const timeWindowOf = (r: WorkRequest): SparseTimeWindow =>
  (r.constraints?.time_window ?? {}) as SparseTimeWindow;
const equipmentOf = (r: WorkRequest) =>
  (r.resources?.equipment ?? []).map((e) => e.equipment_id).filter(Boolean);
const personnelOf = (r: WorkRequest) => r.resources?.personnel ?? [];
const incompatibleWith = (r: WorkRequest) =>
  r.constraints?.compatibility?.incompatible_with ?? [];
const prerequisitesOf = (r: WorkRequest) =>
  r.constraints?.dependencies?.prerequisites ?? [];

export function detectAllConflicts(
  requests: WorkRequest[],
  gangs: PersonnelGang[],
  equipmentList: MaintenanceEquipment[]
): Conflict[] {
  const conflicts: Conflict[] = [];
  let conflictCounter = 1;

  const activeRequests = requests.filter((r) => r.status !== "CANCELLED" && r.status !== "DEFERRED");

  for (let i = 0; i < activeRequests.length; i++) {
    for (let j = i + 1; j < activeRequests.length; j++) {
      const r1 = activeRequests[i];
      const r2 = activeRequests[j];

      const t1Start = new Date(durationOf(r1).start_time).getTime();
      const t1End = new Date(durationOf(r1).end_time).getTime();
      const t2Start = new Date(durationOf(r2).start_time).getTime();
      const t2End = new Date(durationOf(r2).end_time).getTime();

      const timeOverlaps = Math.max(t1Start, t2Start) < Math.min(t1End, t2End);

      // 1. SPATIAL CONFLICTS
      if (timeOverlaps) {
        // Track section chainage overlap
        if (
          locationOf(r1).type === "TRACK_SECTION" &&
          locationOf(r2).type === "TRACK_SECTION" &&
          locationOf(r1).track_number === locationOf(r2).track_number
        ) {
          const start1 = locationOf(r1).chainage_start ?? 0;
          const end1 = locationOf(r1).chainage_end ?? 0;
          const start2 = locationOf(r2).chainage_start ?? 0;
          const end2 = locationOf(r2).chainage_end ?? 0;

          // Check if distance separation is less than 500m (0.5 km) as per Indian Railways Track Machine Manual
          const isOverlapping = Math.max(start1, start2) <= Math.min(end1, end2) + 0.5;
          if (isOverlapping) {
            conflicts.push({
              id: `CONF-SPT-${conflictCounter++}`,
              type: "SPATIAL",
              severity: "CRITICAL",
              detected_at: new Date().toISOString(),
              work_requests: [r1.id, r2.id],
              location_id: `${locationOf(r1).track_number} Line (KM ${Math.min(start1, start2).toFixed(1)} - ${Math.max(end1, end2).toFixed(1)})`,
              description: `Spatial Overlap: '${r1.title}' (KM ${start1}-${end1}) and '${r2.title}' (KM ${start2}-${end2}) on ${locationOf(r1).track_number} line violate the 500m safety separation margin during overlapping time window.`,
              resolution_suggestions: [
                `Shift '${r2.title}' start time to after ${new Date(t1End).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`,
                `Move '${r2.title}' to DN line or adjacent section if applicable.`,
                `Split the track segment into two 300m sub-blocks on successive nights.`,
              ],
              status: "OPEN",
            });
          }
        }

        // Depot bay or Workshop pit overlap
        if (
          locationOf(r1).type === "DEPOT_BAY" &&
          locationOf(r2).type === "DEPOT_BAY" &&
          locationOf(r1).section_id === locationOf(r2).section_id
        ) {
          conflicts.push({
            id: `CONF-SPT-${conflictCounter++}`,
            type: "SPATIAL",
            severity: "CRITICAL",
            detected_at: new Date().toISOString(),
            work_requests: [r1.id, r2.id],
            location_id: locationOf(r1).section_id,
            description: `Depot Bay Contention: Both '${r1.title}' and '${r2.title}' are assigned simultaneously to ${locationOf(r1).section_id}.`,
            resolution_suggestions: [
              `Reassign '${r2.title}' to adjacent free Bay 3 or Bay 4.`,
              `Stagger shift schedule so Coach 1 vacates bay before Coach 2 is shunted in.`,
            ],
            status: "OPEN",
          });
        }
      }

      // 2. RESOURCE CONFLICTS
      if (timeOverlaps) {
        // Equipment double-booking
        const eq1Ids = equipmentOf(r1);
        const eq2Ids = equipmentOf(r2);
        const sharedEquip = eq1Ids.filter((id) => eq2Ids.includes(id));

        if (sharedEquip.length > 0) {
          conflicts.push({
            id: `CONF-RES-${conflictCounter++}`,
            type: "RESOURCE",
            severity: "CRITICAL",
            detected_at: new Date().toISOString(),
            work_requests: [r1.id, r2.id],
            location_id: sharedEquip.join(", "),
            description: `Equipment Double-Booking: Machine [${sharedEquip.join(", ")}] is assigned simultaneously to '${r1.title}' and '${r2.title}'.`,
            resolution_suggestions: [
              `Substitute machine with backup unit from divisional pool (e.g. UNIMAT-02).`,
              `Schedule requests into sequential night non-traffic blocks.`,
            ],
            status: "OPEN",
          });
        }

        // Work Incompatibility Safety Rules
        const isIncompatible =
          incompatibleWith(r1).includes(r2.type) ||
          incompatibleWith(r2).includes(r1.type);

        if (
          isIncompatible &&
          locationOf(r1).type === "TRACK_SECTION" &&
          locationOf(r2).type === "TRACK_SECTION" &&
          Math.abs((locationOf(r1).chainage_start ?? 0) - (locationOf(r2).chainage_start ?? 0)) < 3.0
        ) {
          conflicts.push({
            id: `CONF-SAF-${conflictCounter++}`,
            type: "SAFETY",
            severity: "CRITICAL",
            detected_at: new Date().toISOString(),
            work_requests: [r1.id, r2.id],
            location_id: `Section Sector ${locationOf(r1).section_id} & ${locationOf(r2).section_id}`,
            description: `Work Safety Incompatibility: ${r1.type} and ${r2.type} are strictly incompatible in adjacent track sectors due to safety hazards (flying ballast/hot sparks/traction grounding interference).`,
            resolution_suggestions: [
              `Coordinate power isolation and schedule ${r1.type} first, followed by ${r2.type}.`,
              `Enforce minimum 3.0 km longitudinal separation as required by IR Track Manual.`,
            ],
            status: "OPEN",
          });
        }
      }

      // 5. DEPENDENCY CONFLICTS
      if (prerequisitesOf(r2).includes(r1.id)) {
        if (t2Start < t1End) {
          conflicts.push({
            id: `CONF-DEP-${conflictCounter++}`,
            type: "DEPENDENCY",
            severity: "CRITICAL",
            detected_at: new Date().toISOString(),
            work_requests: [r1.id, r2.id],
            description: `Dependency Sequence Violation: Successor work '${r2.title}' is scheduled to start at ${new Date(t2Start).toLocaleTimeString()} before prerequisite work '${r1.title}' finishes at ${new Date(t1End).toLocaleTimeString()}.`,
            resolution_suggestions: [
              `Delay start of '${r2.title}' until after '${r1.title}' completion + 30 min handover buffer.`,
            ],
            status: "OPEN",
          });
        }
      }
    }

    // 4. TEMPORAL CONFLICTS (Single request check)
    const req = activeRequests[i];
    const startHour = new Date(durationOf(req).start_time).getUTCHours();
    const isDayTime = startHour >= 6 && startHour <= 22;

    if (timeWindowOf(req).is_non_traffic_hours_mandatory && isDayTime) {
      conflicts.push({
        id: `CONF-TMP-${conflictCounter++}`,
        type: "TEMPORAL",
        severity: "WARNING",
        detected_at: new Date().toISOString(),
        work_requests: [req.id],
        description: `Temporal Warning: '${req.title}' is flagged as requiring Non-Traffic Hours (01:30 - 05:30), but is scheduled during daytime traffic hours (${startHour}:00 UTC). This will disrupt regular passenger express train paths.`,
        resolution_suggestions: [
          `Shift to Night Non-Traffic Hours window (01:30 - 05:30).`,
          `Apply for special Day Traffic Block with Section Controller.`,
        ],
        status: "OPEN",
      });
    }

    // Skill mismatch check
    if (req.type === "SIGNALING_MAINTENANCE") {
      const hasSignalTech = personnelOf(req).some((p) => p.role === "SIGNAL_TECH" && p.count > 0);
      if (!hasSignalTech) {
        conflicts.push({
          id: `CONF-RES-${conflictCounter++}`,
          type: "RESOURCE",
          severity: "CRITICAL",
          detected_at: new Date().toISOString(),
          work_requests: [req.id],
          description: `Skill Certification Mismatch: Signaling Maintenance '${req.title}' is scheduled without a certified Signal Technician in the assigned personnel gang.`,
          resolution_suggestions: [
            `Assign Signal Gang #3 (TKJ-SANDT-DEPOT) with 4 certified signal technicians.`,
          ],
          status: "OPEN",
        });
      }
    }
  }

  return conflicts;
}
