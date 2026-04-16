/** Backend API response types — mirrors sim_backend/app/schemas/*.py */

// --- Master Data ---

export interface FactoryOut {
  factory_id: string;
  factory_code: string;
  factory_name: string;
  location: string | null;
  timezone: string;
  status: string;
}

export interface StageOut {
  stage_id: string;
  factory_id: string;
  stage_code: string;
  stage_name: string;
  sequence: number;
  stage_type: string;
  status: string;
  creator_binding_id: string | null;
}

export interface LineOut {
  line_id: string;
  stage_id: string;
  line_code: string;
  line_name: string;
  smt_pph: number | null;
  operation_count: number | null;
  status: string;
  creator_binding_id: string | null;
}

export interface OperationOut {
  operation_id: string;
  line_id: string;
  operation_code: string;
  operation_name: string;
  sequence: number;
  operation_type: string | null;
  is_key_operation: boolean;
  status: string;
  creator_binding_id: string | null;
}

export interface EquipmentOut {
  equipment_id: string;
  operation_id: string;
  equipment_code: string;
  equipment_name: string;
  equipment_type: string;
  manufacturer: string | null;
  model_no: string | null;
  standard_ct: number | null;
  status: string;
  creator_binding_id: string | null;
}

export interface BopProcessOut {
  bop_process_id: string;
  bop_id: string;
  operation_id: string;
  sequence: number;
  standard_ct: number;
  panel_qty: number | null;
  ct_per_panel: number | null;
  yield_rate: number;
  standard_worker_count: number;
  min_worker_count: number | null;
}

export interface BopOut {
  bop_id: string;
  product_id: string;
  line_id: string;
  bop_version: string;
  is_active: boolean;
  processes: BopProcessOut[];
}

export interface ProductOut {
  product_id: string;
  product_code: string;
  product_name: string;
  product_category: string | null;
  unit: string;
  status: string;
}

// --- Simulation Plan ---

export interface PlanCreate {
  plan_name: string;
  factory_id: string;
  enabled_simulators: string[];
  simulation_duration_hours: number;
  plan_description?: string;
  created_by: string;
}

export interface PlanUpdate {
  plan_name?: string;
  plan_description?: string;
  enabled_simulators?: string[];
  simulation_duration_hours?: number;
}

export interface PlanOut {
  plan_id: string;
  plan_name: string;
  plan_description: string | null;
  factory_id: string;
  status: string;
  enabled_simulators: string[];
  simulation_duration_hours: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ConstraintOut {
  constraint_id: string;
  plan_id: string;
  constraint_type: string;
  is_enabled: boolean;
}

export interface OverrideOut {
  override_id: string;
  plan_id: string;
  scope_type: string;
  scope_id: string | null;
  param_key: string;
  param_value: string;
  time_range_start: number | null;
  time_range_end: number | null;
}

export interface TaskOut {
  task_id: string;
  plan_id: string;
  wo_id: string | null;
  stage_id: string;
  line_id: string;
  product_code: string;
  plan_quantity: number;
  completed_qty: number | null;
  production_sequence: number;
}

// --- Simulation Results ---

export interface RunStatus {
  plan_id: string;
  computation_status: string;
  progress_pct: number | null;
}

export interface SimResultOut {
  result_id: string;
  plan_id: string;
  computation_status: string;
  computation_start: string | null;
  computation_end: string | null;
  total_output: number | null;
  output_per_hour: number | null;
  overall_lbr: number | null;
  bottleneck_equipment_id: string | null;
  bottleneck_utilization: number | null;
  material_shortage_count: number | null;
  equipment_failure_count: number | null;
  result_summary: Record<string, unknown> | null;
}

export interface OperationLoadDetail {
  operation_name: string;
  sequence: number;
  design_ct: number;
  effective_ct: number;
  equipment_count: number;
  worker_count: number;
  utilization: number;
  takt_deviation: number;
  is_bottleneck: boolean;
  is_idle: boolean;
}

export interface LineBalanceOut {
  lb_result_id: string;
  result_id: string;
  line_id: string;
  takt_time: number;
  lbr: number;
  balance_loss_rate: number;
  bottleneck_operation_id: string | null;
  bottleneck_ct: number | null;
  idle_operation_id: string | null;
  operation_load_detail: Record<string, OperationLoadDetail> | null;
  workshop_load_rate: number | null;
  factory_load_rate: number | null;
}

export interface SimEventOut {
  timestamp_ms: number;
  equipment_id: string;
  prim_path: string | null;
  event_type: string;
  product_id: string | null;
  metadata: Record<string, unknown> | null;
}

export interface SimEventsOut {
  plan_id: string;
  total_events: number;
  duration_ms: number;
  events: SimEventOut[];
}
