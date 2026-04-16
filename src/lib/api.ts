import type {
  BopOut,
  ConstraintOut,
  EquipmentOut,
  FactoryOut,
  LineBalanceOut,
  LineOut,
  OperationOut,
  OverrideOut,
  PlanCreate,
  PlanOut,
  PlanUpdate,
  ProductOut,
  RunStatus,
  SimEventsOut,
  SimResultOut,
  StageOut,
  TaskOut,
} from '@/types/api';

const BASE = '/api/v1';

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---------------------------------------------------------------------------
// Simulator ID mapping: backend ↔ frontend
// ---------------------------------------------------------------------------
const SIM_BE_TO_FE: Record<string, string> = {
  PRODUCTION: 'des',
  LINE_BALANCE: 'line-balance',
  SMT_CAPACITY: 'smt',
  AGV: 'agv',
};
const SIM_FE_TO_BE: Record<string, string> = Object.fromEntries(
  Object.entries(SIM_BE_TO_FE).map(([k, v]) => [v, k]),
);

export function simulatorsToFrontend(backend: string[]): string[] {
  return backend.map(s => SIM_BE_TO_FE[s] ?? s);
}
export function simulatorsToBackend(frontend: string[]): string[] {
  return frontend.map(s => SIM_FE_TO_BE[s] ?? s);
}

// ---------------------------------------------------------------------------
// Plan API
// ---------------------------------------------------------------------------
export const planApi = {
  list: (status?: string) =>
    api<PlanOut[]>(`/plans${status ? `?status=${status}` : ''}`),

  get: (id: string) => api<PlanOut>(`/plans/${id}`),

  create: (body: PlanCreate) =>
    api<PlanOut>('/plans', { method: 'POST', body: JSON.stringify(body) }),

  update: (id: string, body: Partial<PlanUpdate>) =>
    api<PlanOut>(`/plans/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  delete: (id: string) =>
    api<void>(`/plans/${id}`, { method: 'DELETE' }),

  // Simulation execution
  run: (id: string) =>
    api<RunStatus>(`/plans/${id}/run`, { method: 'POST' }),

  runStatus: (id: string) =>
    api<RunStatus>(`/plans/${id}/run/status`),

  // Results
  result: (id: string) =>
    api<SimResultOut>(`/plans/${id}/result`),

  lineBalance: (id: string) =>
    api<LineBalanceOut[]>(`/plans/${id}/result/line-balance`),

  snapshots: (id: string, offset = 0, limit = 500) =>
    api<Array<{ sim_timestamp_sec: number; equipment_states: Record<string, { status: string }> }>>(
      `/plans/${id}/result/snapshots?offset=${offset}&limit=${limit}`,
    ),

  events: (id: string) =>
    api<SimEventsOut>(`/plans/${id}/result/events`),

  // Sub-resources
  tasks: (id: string) => api<TaskOut[]>(`/plans/${id}/tasks`),
  createTask: (id: string, body: Record<string, unknown>) =>
    api<TaskOut>(`/plans/${id}/tasks`, { method: 'POST', body: JSON.stringify(body) }),
  deleteTask: (id: string, taskId: string) =>
    api<void>(`/plans/${id}/tasks/${taskId}`, { method: 'DELETE' }),

  constraints: (id: string) => api<ConstraintOut[]>(`/plans/${id}/constraints`),
  setConstraint: (id: string, body: { constraint_type: string; is_enabled: boolean }) =>
    api<ConstraintOut>(`/plans/${id}/constraints`, { method: 'POST', body: JSON.stringify(body) }),

  overrides: (id: string) => api<OverrideOut[]>(`/plans/${id}/overrides`),
  createOverride: (id: string, body: Record<string, unknown>) =>
    api<OverrideOut>(`/plans/${id}/overrides`, { method: 'POST', body: JSON.stringify(body) }),
  deleteOverride: (id: string, overrideId: string) =>
    api<void>(`/plans/${id}/overrides/${overrideId}`, { method: 'DELETE' }),

  // Anomalies
  anomalies: (id: string) => api<unknown[]>(`/plans/${id}/anomalies`),
  createAnomaly: (id: string, body: Record<string, unknown>) =>
    api<unknown>(`/plans/${id}/anomalies`, { method: 'POST', body: JSON.stringify(body) }),
  updateAnomaly: (id: string, anomalyId: string, body: Record<string, unknown>) =>
    api<unknown>(`/plans/${id}/anomalies/${anomalyId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteAnomaly: (id: string, anomalyId: string) =>
    api<void>(`/plans/${id}/anomalies/${anomalyId}`, { method: 'DELETE' }),

  // Lifecycle
  archive: (id: string) =>
    api<PlanOut>(`/plans/${id}/archive`, { method: 'POST' }),
  copy: (id: string) =>
    api<PlanOut>(`/plans/${id}/copy`, { method: 'POST' }),
  cancel: (id: string) =>
    api<PlanOut>(`/plans/${id}/cancel`, { method: 'POST' }),

  // Batch
  batchArchive: (ids: string[]) =>
    api<{ archived: number }>('/plans/batch-archive', { method: 'POST', body: JSON.stringify({ plan_ids: ids }) }),
  batchDelete: (ids: string[]) =>
    api<{ deleted: number }>('/plans/batch-delete', { method: 'POST', body: JSON.stringify({ plan_ids: ids }) }),

  // Versions
  versions: (id: string) => api<unknown[]>(`/plans/${id}/versions`),
  createVersion: (id: string, body: { version_name: string; notes?: string }) =>
    api<unknown>(`/plans/${id}/versions`, { method: 'POST', body: JSON.stringify(body) }),

  // Export
  exportReport: (id: string, body: { modules: string[]; format?: string; title?: string }) =>
    api<unknown>(`/plans/${id}/export`, { method: 'POST', body: JSON.stringify(body) }),

  // Apply template
  applyTemplate: (planId: string, templateId: string) =>
    api<unknown>(`/plans/${planId}/apply-template/${templateId}`, { method: 'POST' }),
};

// ---------------------------------------------------------------------------
// Template API
// ---------------------------------------------------------------------------
export const templateApi = {
  list: () => api<unknown[]>('/templates'),
  create: (body: Record<string, unknown>) =>
    api<unknown>('/templates', { method: 'POST', body: JSON.stringify(body) }),
  delete: (id: string) =>
    api<void>(`/templates/${id}`, { method: 'DELETE' }),
  copy: (id: string) =>
    api<unknown>(`/templates/${id}/copy`, { method: 'POST' }),
};

// ---------------------------------------------------------------------------
// Master Data API
// ---------------------------------------------------------------------------
export const masterApi = {
  factories: () => api<FactoryOut[]>('/factories'),
  stages: (factoryId: string) => api<StageOut[]>(`/factories/${factoryId}/stages`),
  lines: (stageId: string) => api<LineOut[]>(`/factories/stages/${stageId}/lines`),
  operations: (lineId: string) => api<OperationOut[]>(`/factories/lines/${lineId}/operations`),
  bop: (lineId: string) => api<BopOut>(`/factories/lines/${lineId}/bop`),
  equipment: (opId: string) => api<EquipmentOut[]>(`/factories/operations/${opId}/equipment`),
  products: () => api<ProductOut[]>('/products'),
};
