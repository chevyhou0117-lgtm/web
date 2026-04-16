export type PlanStatus = 'DRAFT' | 'READY' | 'RUNNING' | 'COMPLETED' | 'ARCHIVED';

export type SimulatorId = 'des' | 'line-balance' | 'agv' | 'smt';

export interface SimPlan {
  id: string;
  name: string;
  simulators?: SimulatorId[];
  status: PlanStatus;
  timeRange: string;
  creator: string;
  creatorId: string;
  lastRunTime: string | null;
  createdAt: string;
  description?: string;
  tags?: string[];
}

export const SIMULATOR_LABELS: Record<string, { label: string; cls: string }> = {
  des:           { label: '生产过程模拟', cls: 'bg-blue-500/15 text-blue-400' },
  'line-balance':{ label: '线平衡模拟',   cls: 'bg-cyan-500/15 text-cyan-400' },
  agv:           { label: 'AGV路径模拟', cls: 'bg-violet-500/15 text-violet-400' },
  smt:           { label: 'SMT产能规划', cls: 'bg-amber-500/15 text-amber-400' },
};

export const mockPlans: SimPlan[] = [
  {
    id: 'P001',
    name: 'SMT产线A-新品导入产能评估',
    simulators: ['des', 'line-balance'],
    status: 'COMPLETED',
    timeRange: '2026-04-08 ~ 2026-04-08',
    creator: '李明',
    creatorId: 'IE001',
    lastRunTime: '2026-04-10 09:23',
    createdAt: '2026-04-08',
    description: '评估新品A32X在SMT产线1和产线2上的产能可行性',
    tags: ['新品导入', 'SMT', '产线A'],
  },
  {
    id: 'P002',
    name: '烟台工厂Q2排产方案验证',
    status: 'ARCHIVED',
    timeRange: '2026-04-01 ~ 2026-06-30',
    creator: '王芳',
    creatorId: 'IE002',
    lastRunTime: '2026-04-09 14:55',
    createdAt: '2026-04-01',
    tags: ['Q2排产', '季度评估'],
  },
  {
    id: 'P003',
    name: '换线优化-L03产线',
    simulators: ['des'],
    status: 'READY',
    timeRange: '2026-04-10 ~ 2026-04-11',
    creator: '张三',
    creatorId: 'IE003',
    lastRunTime: null,
    createdAt: '2026-04-10',
  },
  {
    id: 'P004',
    name: '物料供应中断风险分析',
    status: 'DRAFT',
    timeRange: '2026-04-10 ~ 2026-04-12',
    creator: '李明',
    creatorId: 'IE001',
    lastRunTime: null,
    createdAt: '2026-04-10',
  },
  {
    id: 'P005',
    name: '双班制扩产方案-产线B',
    status: 'RUNNING',
    timeRange: '2026-04-10 ~ 2026-04-10',
    creator: '王芳',
    creatorId: 'IE002',
    lastRunTime: '2026-04-10 10:05',
    createdAt: '2026-04-10',
  },
  {
    id: 'P006',
    name: 'AGV路径优化仿真',
    status: 'ARCHIVED',
    timeRange: '2026-03-20 ~ 2026-03-21',
    creator: '张三',
    creatorId: 'IE003',
    lastRunTime: '2026-03-22 11:30',
    createdAt: '2026-03-20',
    tags: ['AGV', '物流优化'],
  },
];

export const STATUS_CONFIG: Record<PlanStatus, { label: string; cls: string; dot: string }> = {
  DRAFT:     { label: '草稿',   cls: 'bg-slate-700/50 text-slate-400 border-slate-600',   dot: 'bg-slate-500' },
  READY:     { label: '就绪',   cls: 'bg-blue-500/20 text-blue-400 border-blue-500/40',    dot: 'bg-blue-400' },
  RUNNING:   { label: '运行中', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/40', dot: 'bg-amber-400' },
  COMPLETED: { label: '已完成', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40', dot: 'bg-emerald-400' },
  ARCHIVED:  { label: '已归档', cls: 'bg-purple-500/20 text-purple-400 border-purple-500/40', dot: 'bg-purple-400' },
};


// Mock result data for charts
export const lbrTimeSeriesData = Array.from({ length: 24 }, (_, i) => ({
  time: `${String(i).padStart(2, '0')}:00`,
  lbr: 72 + Math.sin(i * 0.5) * 12 + Math.random() * 5,
  bottleneck: 45 + Math.random() * 8,
}));

export const deviceUtilizationData = [
  { name: 'SPI-L01', util: 91, status: 'overload' },
  { name: 'SMT-L01-01', util: 88, status: 'overload' },
  { name: 'SMT-L01-02', util: 85, status: 'normal' },
  { name: 'AOI-L01', util: 79, status: 'normal' },
  { name: 'REFLOW-L01', util: 76, status: 'normal' },
  { name: 'WAVE-L01', util: 55, status: 'idle' },
  { name: 'SPI-L02', util: 82, status: 'normal' },
  { name: 'SMT-L02-01', util: 90, status: 'overload' },
  { name: 'AOI-L02', util: 68, status: 'normal' },
];

export const productionOutputData = Array.from({ length: 8 }, (_, i) => ({
  hour: `${8 + i}:00`,
  actual: 280 + Math.round(Math.random() * 60),
  plan: 320,
  defect: Math.round(Math.random() * 15),
}));

export const materialStockData = Array.from({ length: 24 }, (_, i) => ({
  time: `${String(i).padStart(2, '0')}:00`,
  IC主控: Math.max(0, 1200 - i * 45 + Math.random() * 30),
  电容0402: Math.max(0, 8000 - i * 300 + Math.random() * 200),
  连接器: Math.max(0, 500 - i * 18 + Math.random() * 10),
}));

export const operationLoadData = [
  { name: '锡膏印刷', ct: 32, takt: 42, util: 76, workers: 1, lbr: 72 },
  { name: '贴片(前)', ct: 48, takt: 42, util: 114, workers: 2, lbr: 100 },
  { name: '贴片(后)', ct: 45, takt: 42, util: 107, workers: 2, lbr: 100 },
  { name: '回流焊', ct: 38, takt: 42, util: 90, workers: 1, lbr: 85 },
  { name: 'AOI检测', ct: 28, takt: 42, util: 67, workers: 1, lbr: 63 },
  { name: '选择焊', ct: 55, takt: 42, util: 131, workers: 1, lbr: 100 },
  { name: 'ICT测试', ct: 22, takt: 42, util: 52, workers: 1, lbr: 52 },
];

export const eventLogData = [
  { time: '08:00:05', type: '工单投产', level: 'INFO', obj: 'WO-20260410-001', detail: '工单 WO-20260410-001 开始投产，产品 A32X，计划量 500pcs' },
  { time: '08:23:14', type: '物料短缺', level: 'WARN', obj: 'IC-12345', detail: '物料 IC主控 库存低于安全水位（剩余 200pcs，安全库存 500pcs）' },
  { time: '09:15:33', type: '设备故障', level: 'WARN', obj: 'SMT-L01-02', detail: '设备 SMT-L01-02 发生故障，预计修复时长 45 分钟' },
  { time: '10:00:33', type: '设备恢复', level: 'INFO', obj: 'SMT-L01-02', detail: '设备 SMT-L01-02 故障排除，恢复正常运行' },
  { time: '10:45:02', type: '换线开始', level: 'INFO', obj: 'L02', detail: '产线 L02 开始换线，切换产品 A32X → B15Y，预计换线时间 25 分钟' },
  { time: '11:10:18', type: '换线完成', level: 'INFO', obj: 'L02', detail: '产线 L02 换线完成，开始生产 B15Y' },
  { time: '12:02:38', type: 'AGV异常', level: 'ERROR', obj: 'AGV-003', detail: 'AGV 路径规划超时，使用默认搬运时间 5 分钟替代' },
  { time: '13:30:00', type: '工单完工', level: 'INFO', obj: 'WO-20260410-001', detail: '工单 WO-20260410-001 完工，实际产出 487pcs，良品率 97.4%' },
  { time: '14:15:22', type: '物料补货', level: 'INFO', obj: 'IC-12345', detail: '物料 IC主控 补货到位，入库 2000pcs' },
  { time: '15:00:00', type: '工单投产', level: 'INFO', obj: 'WO-20260410-003', detail: '工单 WO-20260410-003 开始投产，产品 C08Z，计划量 300pcs' },
];

// SMT capacity planning mock
export const smtCapacityData = Array.from({ length: 12 }, (_, i) => ({
  month: `2026-${String(i + 1).padStart(2, '0')}`,
  demand: 2800000 + Math.round(Math.sin(i * 0.5) * 400000 + Math.random() * 200000),
  capacity: 3200000,
  util: 0,
})).map(d => ({ ...d, util: Math.round(d.demand / d.capacity * 100) }));

export const masterDataStats = {
  factories: 1,
  productionLines: 8,
  equipments: 64,
  bops: 23,
  lastSync: '2026-04-10 08:30:00',
  status: 'normal' as const,
};

export const paramTemplates = [
  { id: 'T001', name: '标准SMT三班倒模板', desc: '包含正常故障率和换线时间', creator: '李明', updatedAt: '2026-04-08', usageCount: 12 },
  { id: 'T002', name: '高良品率产能评估模板', desc: '良品率设定99%，适合新品导入评估', creator: '王芳', updatedAt: '2026-04-05', usageCount: 5 },
  { id: 'T003', name: '含设备故障可靠性模板', desc: 'MTBF/MTTR采用历史数据，真实场景仿真', creator: '张三', updatedAt: '2026-03-28', usageCount: 8 },
];
