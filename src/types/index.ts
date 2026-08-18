export type WorkType =
  | "TRACK_TAMPING"
  | "RAIL_GRINDING"
  | "SIGNALING_MAINTENANCE"
  | "OHE_MAINTENANCE"
  | "COACH_IOH"
  | "COACH_POH"
  | "LOCO_SCHEDULE"
  | "WAGON_ROH"
  | "BRIDGE_INSPECTION"
  | "USFD_TESTING"
  | "BALLAST_CLEANING"
  | "RAIL_RENEWAL";

export type PriorityLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type WorkStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "DEFERRED";

export type PossessionType = "FULL_BLOCK" | "PARTIAL_BLOCK" | "CAUTION_ORDER" | "NON_TRAFFIC_HOURS" | "DEPOT_BAY_BLOCK";

export type LocationType = "TRACK_SECTION" | "DEPOT_BAY" | "WORKSHOP_PIT" | "YARD_LINE";

export interface WorkLocation {
  type: LocationType;
  section_id: string; // e.g. "UP-125.5-126.0" or "BAY-IOH-02"
  chainage_start?: number; // e.g. 125.5 km
  chainage_end?: number; // e.g. 126.0 km
  track_number?: "UP" | "DN" | "LOOP_1" | "LOOP_2" | "YARD";
  station_proximity: string; // e.g. "NDLS-TKJ"
  depot_bay_id?: string;
  workshop_shop_id?: string;
  is_electrified?: boolean;
}

export interface WorkDuration {
  start_time: string; // ISO string
  end_time: string; // ISO string
  setup_time_mins: number;
  teardown_time_mins: number;
  estimated_duration_hours: number;
}

export interface GangRequirement {
  gang_id?: string;
  role: "GANG_MATE" | "KEYMAN" | "WORKER" | "SIGNAL_TECH" | "OHE_LINEMAN" | "WELDER";
  count: number;
}

export interface EquipmentRequirement {
  equipment_id?: string;
  type: "TAMPING_CSM" | "TAMPING_UNIMAT" | "RAIL_GRINDER" | "BALLAST_CLEANER" | "OVERHEAD_CRANE" | "USFD_RIG" | "WHEEL_LATHE";
}

export interface WorkResources {
  personnel: GangRequirement[];
  equipment: EquipmentRequirement[];
  engineering_train?: {
    loco_type: string;
    rake_type: string;
    route_path_id: string;
  } | null;
}

export interface WorkConstraints {
  time_window: {
    earliest_start: string;
    latest_end: string;
    preferred_slots: string[];
    is_non_traffic_hours_mandatory: boolean;
  };
  safety: {
    possession_type: PossessionType;
    requires_earthing: boolean;
    requires_ohe_shutdown: boolean;
    requires_adjacent_caution: boolean;
    caution_speed_kmh?: number;
  };
  dependencies: {
    prerequisites: string[]; // Request IDs
    successors: string[];
  };
  compatibility: {
    compatible_with: WorkType[];
    incompatible_with: WorkType[];
  };
}

export interface WorkRequest {
  id: string;
  title: string;
  type: WorkType;
  priority: PriorityLevel;
  status: WorkStatus;
  location: WorkLocation;
  duration: WorkDuration;
  resources: WorkResources;
  constraints: WorkConstraints;
  metadata: {
    created_by: string;
    role: string;
    created_at: string;
    updated_at: string;
    source: "MANUAL" | "VOICE_LOG" | "OCR_LOGBOOK" | "ICMS" | "FOIS" | "OMRS_WILD" | "USFD" | "EXCEL_BATCH" | "EXTERNAL_CONTRACTOR";
    notes?: string;
    sensor_trigger_ref?: string;
  };
}

export type ConflictCategory = "SPATIAL" | "RESOURCE" | "SAFETY" | "TEMPORAL" | "DEPENDENCY";
export type ConflictSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "WARNING" | "INFO";

export interface Conflict {
  id: string;
  type: ConflictCategory;
  severity: ConflictSeverity;
  detected_at: string;
  work_requests: string[]; // IDs
  location_id?: string;
  description: string;
  resolution_suggestions: string[];
  status: "OPEN" | "RESOLVED" | "OVERRIDDEN";
  override_justification?: string;
  override_by?: string;
}

export interface WorkAssignment {
  id: string;
  work_request_id: string;
  assigned_start: string;
  assigned_end: string;
  assigned_resources: {
    gang_id: string;
    gang_name: string;
    equipment_ids: string[];
    train_path_id?: string;
  };
  track_possession: {
    section: string;
    possession_id: string;
    possession_type: PossessionType;
    ohe_shutdown: boolean;
    earthing_ground_id?: string;
  };
  fitness_impact?: number;
}

export interface FitnessMetrics {
  completed_work_count: number;
  total_requests: number;
  completion_rate: number;
  resource_idle_time_ratio: number;
  travel_time_ratio: number;
  priority_weighted_score: number;
  conflict_penalty: number;
  delay_penalty: number;
  overall_fitness: number;
}

export interface ParetoSolution {
  id: string;
  name: string;
  description: string;
  work_completed_pct: number;
  resource_utilization_pct: number;
  avg_travel_time_mins: number;
  priority_compliance_pct: number;
  train_punctuality_impact_pct: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  fitness_score: number;
  assignments: WorkAssignment[];
}

export interface Schedule {
  id: string;
  name: string;
  type: "WEEKLY" | "FORTNIGHTLY";
  period: {
    start_date: string;
    end_date: string;
  };
  status: "DRAFT" | "PUBLISHED" | "SUPERSEDED";
  version: number;
  work_assignments: WorkAssignment[];
  optimization_metadata: {
    algorithm: "HYBRID_EXPERT_GENETIC_ALGORITHM";
    generations_run: number;
    population_size: number;
    fitness_score: number;
    weights: {
      w1_completion: number;
      w2_idle_time: number;
      w3_travel_time: number;
      w4_priority: number;
      w5_conflict: number;
      w6_delay: number;
    };
    pareto_frontier_solutions?: ParetoSolution[];
    selected_pareto_index?: number;
  };
  created_at: string;
  updated_at: string;
  created_by: string;
  approved_by?: string | null;
}

export interface AlternativeProposal {
  id: string;
  conflict_id: string;
  type: "TIME_SHIFT" | "RESOURCE_SWAP" | "LOCATION_SPLIT" | "WORK_COMBINATION" | "DEFER_LOW_PRIORITY";
  strategy_type?: string;
  title: string;
  description: string;
  modified_request_ids: string[];
  trade_offs: {
    work_completed_pct?: number;
    resource_utilization_pct?: number;
    resource_utilization_change_pct?: number;
    travel_time_mins?: number;
    train_delay_mins_estimate?: number;
    priority_compliance_pct?: number;
    safety_score_impact?: string;
    risk_level: "LOW" | "MEDIUM" | "HIGH";
    time_adjustment_desc: string;
  };
  feasibility_notes?: string;
  revised_assignments: Partial<WorkAssignment>[];
}

export interface DisruptionEvent {
  id: string;
  type:
    | "EMERGENCY_RAIL_DEFECT"
    | "GANG_SICK_LEAVE"
    | "MACHINE_BREAKDOWN"
    | "WEATHER_HEAVY_RAIN"
    | "TRAIN_DELAY"
    | "WORK_OVERRUN"
    | "WILD_BEARING_ALARM"
    | "RAIL_FRACTURE"
    | "WEATHER_MONSOON"
    | "EQUIPMENT_BREAKDOWN";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "EMERGENCY" | "SEVERE" | "MODERATE" | "INFO";
  title: string;
  description: string;
  location_id?: string;
  location?: {
    section_id: string;
    track_number?: string;
    chainage?: number;
  };
  chainage?: number;
  reported_at?: string;
  timestamp?: string;
  estimated_delay_hours?: number;
  estimated_clearance_mins?: number;
  impacted_request_ids?: string[];
  resolved?: boolean;
}

export interface PersonnelGang {
  id: string;
  name: string;
  home_depot?: string;
  base_depot?: string;
  department?: string;
  division?: string;
  total_count?: number;
  weekly_hours_logged?: number;
  composition: {
    gang_mate: number;
    keyman: number;
    worker: number;
    certified_signal_tech: number;
    certified_ohe_lineman: number;
    certified_welder: number;
  };
  skills: WorkType[];
  shift_pattern: "NIGHT_ONLY" | "DAY_ONLY" | "ROTATING";
  working_hours: { start: string; end: string };
  leave_count_today: number;
  current_location: string;
  utilization_pct: number;
}

export interface MaintenanceEquipment {
  id: string;
  name: string;
  type: string;
  category: "TRACK_MACHINE" | "DEPOT_EQUIPMENT" | "WORKSHOP_BAY" | "ENGINEERING_TRAIN";
  model: string;
  status: "AVAILABLE" | "IN_USE" | "UNDER_MAINTENANCE" | "OUT_OF_SERVICE" | "OPERATIONAL";
  base_depot?: string;
  current_section_or_bay: string;
  next_maintenance_due: string;
  fuel_or_health_pct?: number;
  fuel_level_pct?: number;
  health_status_pct?: number;
  certified_operators_required: number;
}

export interface MaterialInventory {
  id: string;
  item_code?: string;
  name: string;
  category: "TRACK" | "COACH" | "OHE" | "SIGNAL";
  stock_quantity?: number;
  quantity_available?: number;
  unit: string;
  reorder_level?: number;
  min_threshold?: number;
  lead_time_days?: number;
  depot_location: string;
}

export interface SystemIntegrationStatus {
  service: "ICMS" | "FOIS" | "OMRS_WILD" | "USFD" | "COIS_TRAIN_CONTROL" | "HRMS" | string;
  name: string;
  protocol?: "REST_JSON" | "SOAP_XML" | "KAFKA_STREAM" | "FILE_BATCH" | string;
  status: "CONNECTED" | "SYNCING" | "DEGRADED";
  last_sync_time: string;
  sync_count_today: number;
  active_alerts_count?: number;
  sample_payload_summary?: string;
  description?: string;
}

export interface LongTermMonthProjection {
  month: string;
  demand_hours: number;
  capacity_hours: number;
  deficit_or_surplus_hours: number;
  tamping_kms_due?: number;
  coaches_poh_due?: number;
  loco_schedules_due?: number;
  usfd_testing_kms?: number;
  bottleneck_risk: "NORMAL" | "MODERATE" | "SEVERE";
  recommendations: string[];
}

export type UserRole =
  | "DEPOT_ENGINEER"
  | "TRACK_SUPERVISOR"
  | "WORKSHOP_MANAGER"
  | "SECTION_CONTROLLER"
  | "SENIOR_MANAGEMENT";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: "APPROVAL" | "CONFLICT" | "DISRUPTION" | "OVERDUE" | "RESOURCE" | "DEPENDENCY";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "WARNING" | "INFO" | "EMERGENCY" | "SEVERE";
  timestamp: string;
  read: boolean;
  related_request_id?: string;
}

// Aliases for component convenience
export type SystemIntegration = SystemIntegrationStatus;
export type LongTermCapacityProjection = LongTermMonthProjection;
export type MaterialItem = MaterialInventory;

// ---------------------------------------------------------------------------
// Authentication & Role-Based Access Control (per Roles & Responsibilities Matrix)
// ---------------------------------------------------------------------------

export type OfficialRole =
  | "GANG_MATE"
  | "SECTION_ENGINEER"
  | "DEPOT_ENGINEER"
  | "WORKSHOP_SUPERVISOR"
  | "ADE"
  | "SR_DME"
  | "SECTION_CONTROLLER"
  | "DRM"
  | "SYSTEM_ADMIN"
  | "DATA_ANALYST"
  | "CONTRACTOR"
  | "AUDITOR";

export interface UserPermissions {
  create_requests: boolean;
  approve_requests: boolean;
  view_schedules: boolean;
  modify_schedules: boolean;
  approve_possessions: boolean;
  view_budget: boolean;
  approve_budget: boolean;
  manage_users: boolean;
  audit_readonly: boolean;
  view_all: boolean;
}

export interface SystemUser {
  id: string;
  username: string;
  password: string; // plaintext only for legacy demo seeds; "salt:hash" (scrypt) for stored accounts
  name: string;
  role: OfficialRole;
  department: string;
  designation: string;
  active: boolean;
  /** Demo accounts are the 12 seeded officials — they see the sample workspace. */
  demo?: boolean;
  /** Substring filters applied to scoped data (gang ids, stations, depots...). Empty = unscoped. */
  scope: { tags: string[] };
  /** Approval ceiling in INR (null = unlimited / not an approver). */
  budget_limit: number | null;
  permissions: UserPermissions;
}

export interface PublicUser {
  id: string;
  username: string;
  name: string;
  role: OfficialRole;
  department: string;
  designation: string;
  active: boolean;
  demo?: boolean;
  scope: { tags: string[] };
  budget_limit: number | null;
  permissions: UserPermissions;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  user: string;
  role: OfficialRole | string;
  action: string;
  entity: string;
  detail: string;
}
