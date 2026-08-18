import { Conflict, AlternativeProposal, Schedule } from "../../types";

export function generateAlternativeProposals(
  conflict: Conflict,
  currentSchedule: Schedule
): AlternativeProposal[] {
  const alternatives: AlternativeProposal[] = [];

  // Alternative 1: Time Shift
  alternatives.push({
    id: `ALT-TS-${conflict.id}`,
    conflict_id: conflict.id,
    type: "TIME_SHIFT",
    title: "Option A: Time Window Staggering (Sequential Execution)",
    description: `Shift the secondary conflicting work request by +2.0 hours to execute right after the primary work finishes. Resolves spatial block contention with zero cancellation.`,
    modified_request_ids: conflict.work_requests,
    trade_offs: {
      work_completed_pct: 94,
      resource_utilization_pct: 82,
      travel_time_mins: 35,
      priority_compliance_pct: 96,
      risk_level: "LOW",
      time_adjustment_desc: "+2.0 hr time delay into late night block",
    },
    revised_assignments: [
      {
        work_request_id: conflict.work_requests[1] ?? conflict.work_requests[0],
        assigned_start: "2026-08-18T04:30:00.000Z",
        assigned_end: "2026-08-18T06:30:00.000Z",
      },
    ],
  });

  // Alternative 2: Resource Swap
  alternatives.push({
    id: `ALT-RS-${conflict.id}`,
    conflict_id: conflict.id,
    type: "RESOURCE_SWAP",
    title: "Option B: Reserve Machine & Gang Substitution",
    description: `Substitute the contested primary machine with standby divisional reserve unit (e.g., UNIMAT-02 or Gang #5 squad) to allow simultaneous execution.`,
    modified_request_ids: conflict.work_requests,
    trade_offs: {
      work_completed_pct: 96,
      resource_utilization_pct: 91,
      travel_time_mins: 25,
      priority_compliance_pct: 95,
      risk_level: "LOW",
      time_adjustment_desc: "Simultaneous execution; +10 min mobilization",
    },
    revised_assignments: [
      {
        work_request_id: conflict.work_requests[0],
        assigned_resources: {
          gang_id: "GANG-005",
          gang_name: "Heavy Rail Grinding & Welding Squad",
          equipment_ids: ["TAMPING-UNIMAT-02"],
        },
      },
    ],
  });

  // Alternative 3: Location Split
  alternatives.push({
    id: `ALT-LS-${conflict.id}`,
    conflict_id: conflict.id,
    type: "LOCATION_SPLIT",
    title: "Option C: Segmented Chainage Split Across 2 Nights",
    description: `Partition the track possession sector into two 400m segments. Execute Phase 1 tonight and Phase 2 tomorrow night, fitting comfortably in the 2.5h traffic window.`,
    modified_request_ids: conflict.work_requests,
    trade_offs: {
      work_completed_pct: 90,
      resource_utilization_pct: 88,
      travel_time_mins: 30,
      priority_compliance_pct: 100,
      risk_level: "LOW",
      time_adjustment_desc: "2 nights split (400m tonight, 400m tomorrow)",
    },
    revised_assignments: [],
  });

  // Alternative 4: Work Combination
  alternatives.push({
    id: `ALT-WC-${conflict.id}`,
    conflict_id: conflict.id,
    type: "WORK_COMBINATION",
    title: "Option D: Integrated Joint-Block Co-Activity",
    description: `Merge Track Inspection/Signaling calibration inside the same approved track block possession. Saves 45 minutes of total setup and teardown overhead.`,
    modified_request_ids: conflict.work_requests,
    trade_offs: {
      work_completed_pct: 98,
      resource_utilization_pct: 94,
      travel_time_mins: 15,
      priority_compliance_pct: 100,
      risk_level: "MEDIUM",
      time_adjustment_desc: "Concurrent joint possession block",
    },
    revised_assignments: [],
  });

  // Alternative 5: Priority-Based Deferral
  alternatives.push({
    id: `ALT-PD-${conflict.id}`,
    conflict_id: conflict.id,
    type: "DEFER_LOW_PRIORITY",
    title: "Option E: Priority-Based Deferral to Next Fortnight",
    description: `Defer the low-priority cosmetic or non-critical routine work to the following week's backlog, granting full unrestricted block to safety-critical work.`,
    modified_request_ids: [conflict.work_requests[1] ?? conflict.work_requests[0]],
    trade_offs: {
      work_completed_pct: 85,
      resource_utilization_pct: 89,
      travel_time_mins: 18,
      priority_compliance_pct: 100,
      risk_level: "LOW",
      time_adjustment_desc: "Deferred +7 days to next maintenance cycle",
    },
    revised_assignments: [],
  });

  return alternatives;
}
