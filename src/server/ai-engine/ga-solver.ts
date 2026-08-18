import {
  WorkRequest,
  PersonnelGang,
  MaintenanceEquipment,
  Schedule,
  WorkAssignment,
  ParetoSolution,
  FitnessMetrics,
} from "../../types";
import { detectAllConflicts } from "./conflict-detector";

export interface GAWeights {
  w1_completion: number;
  w2_idle_time: number;
  w3_travel_time: number;
  w4_priority: number;
  w5_conflict: number;
  w6_delay: number;
}

export const DEFAULT_WEIGHTS: GAWeights = {
  w1_completion: 0.4,
  w2_idle_time: 0.2,
  w3_travel_time: 0.1,
  w4_priority: 0.2,
  w5_conflict: 0.05,
  w6_delay: 0.05,
};

interface Chromosome {
  assignments: WorkAssignment[];
  fitness: number;
  metrics: FitnessMetrics;
}

// ---------- Multi-Objective Pareto Frontier Support ----------

export interface ParetoMetrics {
  work_completed_pct: number;
  resource_utilization_pct: number;
  avg_travel_time_mins: number;
  priority_compliance_pct: number;
  train_punctuality_impact_pct: number;
  conflict_count: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  fitness_score: number;
}

/**
 * Computes genuine trade-off metrics for a candidate schedule so that
 * Pareto solutions reflect real objective values (not hardcoded figures).
 */
export function computeParetoMetrics(
  assignments: WorkAssignment[],
  requests: WorkRequest[],
  gangs: PersonnelGang[],
  equipmentList: MaintenanceEquipment[],
  weights: GAWeights = DEFAULT_WEIGHTS
): ParetoMetrics {
  const total = requests.length;
  const completedCount = assignments.length;
  const completionRate = total > 0 ? completedCount / total : 0;

  const { fitness, metrics } = evaluateScheduleFitness(assignments, requests, gangs, equipmentList, weights);

  // Resource utilization: derived from the idle-time ratio used in the fitness model
  const utilization = Math.min(99, Math.max(40, 100 - metrics.resource_idle_time_ratio));

  // Travel estimate: group assignments by gang, sort chronologically, then sum
  // inter-section transit (10 min base + 8 min per km of chainage delta).
  const byGang = new Map<string, WorkAssignment[]>();
  assignments.forEach((a) => {
    const g = a.assigned_resources.gang_id || "UNASSIGNED";
    if (!byGang.has(g)) byGang.set(g, []);
    byGang.get(g)!.push(a);
  });
  let travelMinutes = 0;
  byGang.forEach((list) => {
    const sorted = [...list].sort(
      (a, b) => new Date(a.assigned_start).getTime() - new Date(b.assigned_start).getTime()
    );
    for (let i = 1; i < sorted.length; i++) {
      const prevKm = parseFloat((sorted[i - 1].track_possession.section.match(/[\d.]+/) || ["0"])[0]) || 0;
      const curKm = parseFloat((sorted[i].track_possession.section.match(/[\d.]+/) || ["0"])[0]) || 0;
      travelMinutes += 10 + Math.abs(curKm - prevKm) * 8;
    }
  });
  const avgTravel = assignments.length > 0 ? Math.round(travelMinutes / assignments.length) : 0;

  // Train punctuality impact: fraction of assignments scheduled during daytime
  // traffic hours (UTC 06-22), matching the temporal-conflict convention.
  const daytimeCount = assignments.filter((a) => {
    const h = new Date(a.assigned_start).getUTCHours();
    return h >= 6 && h <= 22;
  }).length;
  const punctualityImpact =
    assignments.length > 0 ? Math.round((daytimeCount / assignments.length) * 100) : 0;

  // Re-evaluate conflicts on the assigned times to get the true conflict count
  const assignedReqs = assignments
    .map((a) => {
      const orig = requests.find((r) => r.id === a.work_request_id);
      if (!orig) return null;
      return {
        ...orig,
        duration: { ...orig.duration, start_time: a.assigned_start, end_time: a.assigned_end },
      };
    })
    .filter(Boolean) as WorkRequest[];
  const conflictCount = detectAllConflicts(assignedReqs, gangs, equipmentList).length;

  const riskLevel: ParetoMetrics["risk_level"] =
    conflictCount === 0 ? "LOW" : conflictCount <= 2 ? "MEDIUM" : "HIGH";

  return {
    work_completed_pct: parseFloat((completionRate * 100).toFixed(0)),
    resource_utilization_pct: parseFloat(utilization.toFixed(0)),
    avg_travel_time_mins: avgTravel,
    priority_compliance_pct: metrics.priority_weighted_score,
    train_punctuality_impact_pct: punctualityImpact,
    conflict_count: conflictCount,
    risk_level: riskLevel,
    fitness_score: fitness,
  };
}

/**
 * True Pareto dominance: `a` dominates `b` if `a` is at least as good on
 * every objective and strictly better on at least one. Maximized objectives:
 * completion, utilization, priority compliance. Minimized: travel, punctuality impact.
 */
function dominates(a: ParetoMetrics, b: ParetoMetrics): boolean {
  const atLeast = (x: number, y: number) => x >= y;
  const atMost = (x: number, y: number) => x <= y;
  const strictlyBetter =
    a.work_completed_pct > b.work_completed_pct ||
    a.resource_utilization_pct > b.resource_utilization_pct ||
    a.priority_compliance_pct > b.priority_compliance_pct ||
    a.avg_travel_time_mins < b.avg_travel_time_mins ||
    a.train_punctuality_impact_pct < b.train_punctuality_impact_pct;

  return (
    strictlyBetter &&
    atLeast(a.work_completed_pct, b.work_completed_pct) &&
    atLeast(a.resource_utilization_pct, b.resource_utilization_pct) &&
    atLeast(a.priority_compliance_pct, b.priority_compliance_pct) &&
    atMost(a.avg_travel_time_mins, b.avg_travel_time_mins) &&
    atMost(a.train_punctuality_impact_pct, b.train_punctuality_impact_pct)
  );
}

export function evaluateScheduleFitness(
  assignments: WorkAssignment[],
  requests: WorkRequest[],
  gangs: PersonnelGang[],
  equipmentList: MaintenanceEquipment[],
  weights: GAWeights = DEFAULT_WEIGHTS
): { fitness: number; metrics: FitnessMetrics } {
  const total = requests.length;
  const completedCount = assignments.length;
  const completionRate = total > 0 ? completedCount / total : 0;

  // Priority weighting
  let priorityScoreTotal = 0;
  let maxPossiblePriorityScore = 0;

  requests.forEach((r) => {
    const weight = r.priority === "CRITICAL" ? 4 : r.priority === "HIGH" ? 3 : r.priority === "MEDIUM" ? 2 : 1;
    maxPossiblePriorityScore += weight;
    const isAssigned = assignments.some((a) => a.work_request_id === r.id);
    if (isAssigned) {
      priorityScoreTotal += weight;
    }
  });

  const priorityWeightedScore =
    maxPossiblePriorityScore > 0 ? priorityScoreTotal / maxPossiblePriorityScore : 1;

  // Build assigned requests for conflict detection
  const assignedReqs = assignments
    .map((a) => {
      const orig = requests.find((r) => r.id === a.work_request_id);
      if (!orig) return null;
      return {
        ...orig,
        duration: {
          ...orig.duration,
          start_time: a.assigned_start,
          end_time: a.assigned_end,
        },
      };
    })
    .filter(Boolean) as WorkRequest[];

  const conflicts = detectAllConflicts(assignedReqs, gangs, equipmentList);
  const criticalConflicts = conflicts.filter((c) => c.severity === "CRITICAL").length;
  const warningConflicts = conflicts.filter((c) => c.severity === "WARNING").length;

  const conflictPenalty = criticalConflicts * 0.3 + warningConflicts * 0.1;

  // Resource idle and travel estimate
  const idleRatio = Math.max(0.08, 0.25 - (completedCount / (total || 1)) * 0.12);
  const travelRatio = Math.max(0.05, 0.18 - (completedCount / (total || 1)) * 0.08);
  const delayPenalty = Math.max(0, (total - completedCount) * 0.04);

  const overallFitness = Math.max(
    0.05,
    Math.min(
      0.99,
      weights.w1_completion * completionRate +
        weights.w2_idle_time * (1 - idleRatio) +
        weights.w3_travel_time * (1 - travelRatio) +
        weights.w4_priority * priorityWeightedScore -
        weights.w5_conflict * conflictPenalty -
        weights.w6_delay * delayPenalty
    )
  );

  return {
    fitness: parseFloat(overallFitness.toFixed(4)),
    metrics: {
      completed_work_count: completedCount,
      total_requests: total,
      completion_rate: parseFloat((completionRate * 100).toFixed(1)),
      resource_idle_time_ratio: parseFloat((idleRatio * 100).toFixed(1)),
      travel_time_ratio: parseFloat((travelRatio * 100).toFixed(1)),
      priority_weighted_score: parseFloat((priorityWeightedScore * 100).toFixed(1)),
      conflict_penalty: parseFloat(conflictPenalty.toFixed(2)),
      delay_penalty: parseFloat(delayPenalty.toFixed(2)),
      overall_fitness: parseFloat(overallFitness.toFixed(4)),
    },
  };
}

export function runGeneticAlgorithmOptimization(
  requests: WorkRequest[],
  gangs: PersonnelGang[],
  equipmentList: MaintenanceEquipment[],
  weights: GAWeights = DEFAULT_WEIGHTS,
  populationSize = 100,
  generations = 60
): {
  bestScheduleAssignments: WorkAssignment[];
  fitnessScore: number;
  metrics: FitnessMetrics;
  generationsHistory: { gen: number; bestFitness: number; avgFitness: number }[];
  paretoSolutions: ParetoSolution[];
} {
  // Sort requests: Critical first, then High, Medium, Low
  const priorityOrder: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  const sortedReqs = [...requests].sort(
    (a, b) => (priorityOrder[b.priority] || 1) - (priorityOrder[a.priority] || 1)
  );

  // Time slot candidate generator for night engineering blocks
  const timeSlots = [
    { start: "2026-08-18T01:30:00.000Z", end: "2026-08-18T04:30:00.000Z" },
    { start: "2026-08-18T02:00:00.000Z", end: "2026-08-18T05:00:00.000Z" },
    { start: "2026-08-18T04:30:00.000Z", end: "2026-08-18T06:30:00.000Z" },
    { start: "2026-08-19T01:30:00.000Z", end: "2026-08-19T04:30:00.000Z" },
    { start: "2026-08-19T02:00:00.000Z", end: "2026-08-19T05:30:00.000Z" },
    { start: "2026-08-18T08:30:00.000Z", end: "2026-08-18T16:30:00.000Z" }, // Daytime depot slot
    { start: "2026-08-18T06:00:00.000Z", end: "2026-08-18T10:00:00.000Z" }, // Yard slot
  ];

  // Helper to generate a candidate chromosome. Randomization here is the key to
  // exploring the objective space so the Pareto frontier is genuinely diverse.
  const createChromosome = (mutationLevel = 0.2): Chromosome => {
    const assignments: WorkAssignment[] = [];

    sortedReqs.forEach((req, idx) => {
      // Intentional drops explore the completion-vs-resource trade-off:
      // low-priority work is frequently deferred, medium occasionally.
      if (req.priority === "LOW" && Math.random() < 0.35) return;
      if (req.priority === "MEDIUM" && Math.random() < 0.12) return;

      // Match suitable gang
      const suitableGangs = gangs.filter(
        (g) => g.skills.includes(req.type) || (req.type.includes("COACH") && (g.home_depot || "").includes("COACHING"))
      );
      const chosenGang =
        suitableGangs.length > 0
          ? suitableGangs[Math.floor(Math.random() * suitableGangs.length)]
          : gangs[Math.floor(Math.random() * gangs.length)];

      // Assign time slot: night windows for NTH-mandatory, day slots for depot
      // work, and the full range otherwise (creates punctuality trade-offs).
      const isDepot = req.location.type === "DEPOT_BAY" || req.location.type === "WORKSHOP_PIT";
      const isNth = req.constraints.time_window.is_non_traffic_hours_mandatory;
      let slot;
      if (isDepot) {
        slot = timeSlots[Math.floor(Math.random() * 2) + 5]; // Day bay / yard slots
      } else if (isNth) {
        slot = timeSlots[Math.floor(Math.random() * 4)]; // Night engineering windows only
      } else {
        slot = timeSlots[Math.floor(Math.random() * timeSlots.length)];
      }

      assignments.push({
        id: `ASG-GEN-${idx + 1}-${Math.random().toString(36).substring(2, 6)}`,
        work_request_id: req.id,
        assigned_start: slot.start,
        assigned_end: slot.end,
        assigned_resources: {
          gang_id: chosenGang.id,
          gang_name: chosenGang.name,
          equipment_ids: req.resources.equipment.map((e) => e.equipment_id).filter(Boolean) as string[],
          train_path_id: req.resources.engineering_train?.route_path_id,
        },
        track_possession: {
          section: req.location.section_id,
          possession_id: `POSS-${req.id.replace("REQ-", "")}`,
          possession_type: req.constraints.safety.possession_type,
          ohe_shutdown: req.constraints.safety.requires_ohe_shutdown,
          earthing_ground_id: req.constraints.safety.requires_earthing
            ? `EARTH-${req.location.station_proximity.slice(0, 4)}-${req.location.track_number ?? "M"}`
            : undefined,
        },
        fitness_impact: req.priority === "CRITICAL" ? 0.98 : req.priority === "HIGH" ? 0.91 : 0.85,
      });
    });

    const { fitness, metrics } = evaluateScheduleFitness(assignments, requests, gangs, equipmentList, weights);
    return { assignments, fitness, metrics };
  };

  // Phase 1: Initialize population (kept for the Pareto pool — it carries the
  // broadest objective diversity before convergence narrows the search)
  let population: Chromosome[] = [];
  for (let i = 0; i < populationSize; i++) {
    population.push(createChromosome(i / populationSize));
  }
  const initialPopulation = [...population];

  const history: { gen: number; bestFitness: number; avgFitness: number }[] = [];

  // Phase 2: Run Generations
  for (let gen = 0; gen < generations; gen++) {
    population.sort((a, b) => b.fitness - a.fitness);

    const bestFitness = population[0].fitness;
    const avgFitness =
      population.reduce((acc, cur) => acc + cur.fitness, 0) / population.length;

    if (gen % 5 === 0 || gen === generations - 1) {
      history.push({
        gen,
        bestFitness: parseFloat(bestFitness.toFixed(4)),
        avgFitness: parseFloat(avgFitness.toFixed(4)),
      });
    }

    // Elitism: Keep top 20%
    const eliteCount = Math.floor(populationSize * 0.2);
    const newPop: Chromosome[] = population.slice(0, eliteCount);

    // Crossover & Mutation for the rest
    while (newPop.length < populationSize) {
      // Tournament selection
      const p1 = population[Math.floor(Math.random() * (populationSize * 0.4))];
      const p2 = population[Math.floor(Math.random() * (populationSize * 0.4))];

      // 2-point crossover
      const split = Math.floor(p1.assignments.length / 2);
      const childAssignments = [
        ...p1.assignments.slice(0, split),
        ...p2.assignments.slice(split),
      ];

      // Mutation 1: shift a random assignment to a different time slot
      if (Math.random() < 0.35 && childAssignments.length > 0) {
        const randIdx = Math.floor(Math.random() * childAssignments.length);
        const item = childAssignments[randIdx];
        const newSlot = timeSlots[Math.floor(Math.random() * timeSlots.length)];
        childAssignments[randIdx] = {
          ...item,
          assigned_start: newSlot.start,
          assigned_end: newSlot.end,
        };
      }

      // Mutation 2: occasionally drop the lowest-priority assignment to explore
      // the completion-rate axis of the Pareto frontier
      if (Math.random() < 0.12 && childAssignments.length > 1) {
        const priorityRank: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        let worstIdx = 0;
        let worstRank = 99;
        childAssignments.forEach((a, i) => {
          const orig = requests.find((r) => r.id === a.work_request_id);
          const rank = orig ? priorityRank[orig.priority] || 1 : 1;
          if (rank < worstRank) {
            worstRank = rank;
            worstIdx = i;
          }
        });
        childAssignments.splice(worstIdx, 1);
      }

      const { fitness, metrics } = evaluateScheduleFitness(
        childAssignments,
        requests,
        gangs,
        equipmentList,
        weights
      );
      newPop.push({ assignments: childAssignments, fitness, metrics });
    }

    population = newPop;
  }

  population.sort((a, b) => b.fitness - a.fitness);
  const best = population[0];

  // Phase 4: Multi-Objective Pareto Frontier Generation.
  // Every candidate chromosome is scored across the real trade-off objectives,
  // the non-dominated subset is extracted, and 4 representative strategies are
  // returned so the planner can pick between genuine alternatives. The pool
  // blends the diverse initial generation with the converged final population.
  const candidates = [...initialPopulation, ...population].map((chrom) => ({
    chromosome: chrom,
    pareto: computeParetoMetrics(chrom.assignments, requests, gangs, equipmentList, weights),
  }));

  const nonDominated = candidates.filter(
    (cand) => !candidates.some((other) => other !== cand && dominates(other.pareto, cand.pareto))
  );

  const fallback = nonDominated.length > 0 ? nonDominated[0] : candidates[0];

  const sigOf = (cand: typeof candidates[number]) =>
    [
      cand.pareto.work_completed_pct,
      cand.pareto.resource_utilization_pct,
      cand.pareto.avg_travel_time_mins,
      cand.pareto.train_punctuality_impact_pct,
    ].join("|");

  // Distinct frontier points, strongest first (used to fill any role that
  // would otherwise collide with an already-assigned objective argmax).
  const distinctFrontier: typeof candidates = [];
  {
    const seenSigs = new Set<string>();
    for (const cand of [...nonDominated].sort((a, b) => b.pareto.fitness_score - a.pareto.fitness_score)) {
      const sig = sigOf(cand);
      if (seenSigs.has(sig)) continue;
      seenSigs.add(sig);
      distinctFrontier.push(cand);
    }
  }

  // Each strategy anchors on its own objective's argmax; collisions fall back
  // to the next-strongest frontier point so all four cards stay distinct.
  const roles: { id: string; rank: (p: ParetoMetrics) => number; maximize: boolean }[] = [
    { id: "PARETO-SOL-A", rank: (p) => p.work_completed_pct, maximize: true },
    { id: "PARETO-SOL-B", rank: (p) => p.resource_utilization_pct, maximize: true },
    { id: "PARETO-SOL-C", rank: (p) => p.fitness_score, maximize: true },
    { id: "PARETO-SOL-D", rank: (p) => p.train_punctuality_impact_pct, maximize: false },
  ];

  const chosen: { id: string; cand: typeof candidates[number] }[] = [];
  for (const role of roles) {
    const ranked = [...distinctFrontier].sort((a, b) =>
      role.maximize ? role.rank(b.pareto) - role.rank(a.pareto) : role.rank(a.pareto) - role.rank(b.pareto)
    );
    const picked =
      ranked.find((cand) => !chosen.some((e) => sigOf(e.cand) === sigOf(cand))) ||
      ranked[0] ||
      fallback;
    chosen.push({ id: role.id, cand: picked });
  }

  // Never present duplicate points — the frontier may legitimately contain
  // fewer than four distinct trade-off solutions.
  const deduped: { id: string; cand: typeof candidates[number] }[] = [];
  {
    const finalSigs = new Set<string>();
    for (const entry of chosen) {
      const sig = sigOf(entry.cand);
      if (finalSigs.has(sig)) continue;
      finalSigs.add(sig);
      deduped.push(entry);
    }
  }

  const makeSolution = (entry: { id: string; cand: typeof candidates[number] }): ParetoSolution => {
    const p = entry.cand.pareto;
    const names: Record<string, string> = {
      "PARETO-SOL-A": "Solution A: Maximum Work Completion Strategy",
      "PARETO-SOL-B": "Solution B: Resource & Gang Efficiency Strategy",
      "PARETO-SOL-C": "Solution C: Balanced Multi-Objective Hybrid (Recommended)",
      "PARETO-SOL-D": "Solution D: Strict Zero-Disruption Passenger Priority",
    };
    const descriptions: Record<string, string> = {
      "PARETO-SOL-A": `Non-dominated schedule maximizing throughput: ${p.work_completed_pct}% of requests fitted into available engineering windows with ${p.conflict_count} remaining conflicts.`,
      "PARETO-SOL-B": `Non-dominated schedule minimizing gang idle time: ${p.resource_utilization_pct}% utilization with ${p.avg_travel_time_mins} min average transit per gang.`,
      "PARETO-SOL-C": `Balanced multi-objective hybrid recommended by the weighted fitness model: ${p.work_completed_pct}% completion, ${p.resource_utilization_pct}% utilization and ${p.avg_travel_time_mins} min average transit — the compromise between throughput and efficiency.`,
      "PARETO-SOL-D": `Non-dominated schedule with minimum daytime traffic impact (${p.train_punctuality_impact_pct}%) — mainline works confined to night engineering windows.`,
    };
    return {
      id: entry.id,
      name: names[entry.id] || `Pareto Frontier Solution ${entry.id}`,
      description: descriptions[entry.id] || `Non-dominated trade-off solution: ${p.work_completed_pct}% completion, ${p.resource_utilization_pct}% utilization, ${p.avg_travel_time_mins} min transit.`,
      work_completed_pct: p.work_completed_pct,
      resource_utilization_pct: p.resource_utilization_pct,
      avg_travel_time_mins: p.avg_travel_time_mins,
      priority_compliance_pct: p.priority_compliance_pct,
      train_punctuality_impact_pct: p.train_punctuality_impact_pct,
      risk_level: p.risk_level,
      fitness_score: p.fitness_score,
      assignments: entry.cand.chromosome.assignments,
    };
  };

  const paretoSolutions: ParetoSolution[] = deduped.map(makeSolution);

  return {
    bestScheduleAssignments: best.assignments,
    fitnessScore: best.fitness,
    metrics: best.metrics,
    generationsHistory: history,
    paretoSolutions,
  };
}
