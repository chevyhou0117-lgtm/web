import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  ChevronLeft, Save, CheckCircle2, AlertCircle, Upload, RefreshCw,
  ChevronDown, ChevronRight, Database, Cpu, Truck, Package, Layers,
  Sliders, Settings2, Building2, Plus, Info, X, BookOpen, Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { planApi, masterApi } from '@/lib/api';
import type { PlanOut, BopOut, BopProcessOut } from '@/types/api';

// ── Types ──────────────────────────────────────────────────────────────────────
type NodeType = 'group' | 'line' | 'operation' | 'agv' | 'material' | 'factory';
type NodeStatus = 'normal' | 'bottleneck' | 'idle' | 'warning';
type RibbonTab = 'input' | 'params' | 'constraints';

interface TreeNode {
  id: string;
  label: string;
  sublabel?: string;
  type: NodeType;
  status?: NodeStatus;
  ct?: number;
  yieldRate?: number;
  faultRate?: number;
  mttr?: number;
  children?: TreeNode[];
}

// ── Data ───────────────────────────────────────────────────────────────────────
let ASSET_TREE: TreeNode[] = [
  {
    id: 'factory', label: 'Houston P9', type: 'factory',
    children: [
  {
    id: 'lines', label: '参与产线', type: 'group',
    children: [
      {
        id: 'L01', label: 'SMT产线 L01', type: 'line', status: 'warning',
        children: [
          { id: 'L01-SPI',    label: '锡膏印刷', sublabel: 'SPI-L01',      type: 'operation', status: 'normal',     ct: 32, yieldRate: 98.5, faultRate: 3.2, mttr: 30 },
          { id: 'L01-SMT1',   label: '贴片(前)', sublabel: 'SMT-L01-01',   type: 'operation', status: 'bottleneck', ct: 48, yieldRate: 99.8, faultRate: 2.1, mttr: 45 },
          { id: 'L01-SMT2',   label: '贴片(后)', sublabel: 'SMT-L01-02',   type: 'operation', status: 'bottleneck', ct: 45, yieldRate: 99.6, faultRate: 2.3, mttr: 42 },
          { id: 'L01-REFLOW', label: '回流焊',   sublabel: 'REFLOW-L01',   type: 'operation', status: 'normal',     ct: 38, yieldRate: 99.9, faultRate: 1.5, mttr: 60 },
          { id: 'L01-AOI',    label: 'AOI检测',  sublabel: 'AOI-L01',      type: 'operation', status: 'idle',       ct: 28, faultRate: 0.8, mttr: 20 },
        ],
      },
      {
        id: 'L02', label: 'SMT产线 L02', type: 'line', status: 'normal',
        children: [
          { id: 'L02-SPI',  label: '锡膏印刷', sublabel: 'SPI-L02',    type: 'operation', status: 'normal', ct: 30, yieldRate: 98.0, faultRate: 2.8, mttr: 30 },
          { id: 'L02-SMT1', label: '贴片',     sublabel: 'SMT-L02-01', type: 'operation', status: 'normal', ct: 50, yieldRate: 99.5, faultRate: 2.5, mttr: 45 },
          { id: 'L02-AOI',  label: 'AOI检测',  sublabel: 'AOI-L02',    type: 'operation', status: 'normal', ct: 25, faultRate: 1.0, mttr: 20 },
        ],
      },
    ],
  },
  {
    id: 'agv-group', label: 'AGV 资产', type: 'group',
    children: [
      { id: 'AGV-001', label: 'AGV-001', sublabel: '物料搬运', type: 'agv', status: 'normal' },
      { id: 'AGV-002', label: 'AGV-002', sublabel: '物料搬运', type: 'agv', status: 'normal' },
    ],
  },
    ],  // end factory.children
  },    // end factory node
];

let VIEWPORT_LINES: Array<{ id: string; label: string; machines: Array<{ id: string; label: string; ct: string; status: NodeStatus }> }> = [
  {
    id: 'L01', label: 'SMT产线 L01',
    machines: [
      { id: 'L01-SPI',    label: 'SPI印刷', ct: '32s', status: 'normal'     as NodeStatus },
      { id: 'L01-SMT1',   label: '贴片(前)', ct: '48s', status: 'bottleneck' as NodeStatus },
      { id: 'L01-SMT2',   label: '贴片(后)', ct: '45s', status: 'bottleneck' as NodeStatus },
      { id: 'L01-REFLOW', label: '回流焊',   ct: '38s', status: 'normal'     as NodeStatus },
      { id: 'L01-AOI',    label: 'AOI检测',  ct: '28s', status: 'idle'       as NodeStatus },
    ],
  },
  {
    id: 'L02', label: 'SMT产线 L02',
    machines: [
      { id: 'L02-SPI',  label: 'SPI印刷', ct: '30s', status: 'normal' as NodeStatus },
      { id: 'L02-SMT1', label: '贴片',    ct: '50s', status: 'normal' as NodeStatus },
      { id: 'L02-AOI',  label: 'AOI检测', ct: '25s', status: 'normal' as NodeStatus },
    ],
  },
];

interface ConstraintDef {
  id: string;
  label: string;
  desc: string;
  defaultOn: boolean;
  depId?: string;       // id of another constraint this depends on
  depLabel?: string;    // human-readable dep name for the error message
  depNote?: string;     // why it's blocked (shown inline)
}

const CONSTRAINTS_DATA: ConstraintDef[] = [
  { id: 'device-fault',    label: '设备故障约束',   desc: '按MTBF/MTTR随机触发停机事件，设备故障参数需已就绪',  defaultOn: true  },
  { id: 'material-supply', label: '物料供应约束',   desc: '跟踪消耗与到货，库存归零时停机',                     defaultOn: true  },
  { id: 'agv-dispatch',    label: 'AGV调度约束',   desc: '模拟AGV路径规划与搬运时序，影响上下料等待时间',       defaultOn: false,
    depNote: '依赖「物料供应约束」：AGV调度需结合物料搬运触发时机，请先启用物料供应约束', depId: 'material-supply', depLabel: '物料供应约束' },
  { id: 'wip-buffer',      label: '线边仓缓冲约束', desc: 'WIP超容时上游暂停投料，影响节拍连续性',              defaultOn: true  },
  { id: 'workforce',       label: '人力资源约束',   desc: '按班次限制人员，影响有效工时与多工序共享人力',        defaultOn: false },
  { id: 'changeover',      label: '换线时间约束',   desc: '工单切换时按BOP换线时间占用产线',                     defaultOn: true  },
  { id: 'pm',              label: '预防性维保约束', desc: '按维保计划插入计划停机窗口，需维保计划数据已配置',    defaultOn: false },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function findNode(nodes: TreeNode[], id: string): TreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) { const f = findNode(n.children, id); if (f) return f; }
  }
  return null;
}

function machineStyle(status: NodeStatus | undefined, selected: boolean) {
  if (selected)                return { border: '#3b82f6', bg: '#0d2035ee', text: '#93c5fd', dot: '#3b82f6', glow: true };
  if (status === 'bottleneck') return { border: '#ef4444', bg: '#1a0808ee', text: '#f87171', dot: '#ef4444', glow: false };
  if (status === 'idle')       return { border: '#243548', bg: '#080f18ee', text: '#64748b', dot: '#334155', glow: false };
  return                               { border: '#1e3a55', bg: '#071520ee', text: '#94a3b8', dot: '#22c55e', glow: false };
}

// ── Asset Tree ─────────────────────────────────────────────────────────────────
function TreeItem({
  node, depth, selectedId, expandedIds, onSelect, onToggle,
}: {
  node: TreeNode; depth: number;
  selectedId: string | null;
  expandedIds: string[];
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const expanded  = expandedIds.includes(node.id);
  const selected  = selectedId === node.id;
  const hasKids   = !!node.children?.length;
  const isGroup   = node.type === 'group';
  const isFactory = node.type === 'factory';

  const typeIcon: Record<NodeType, React.ReactNode> = {
    factory:   <Building2 size={12} className="text-cyan-400 flex-shrink-0" />,
    group:     <Layers    size={11} className="text-slate-600 flex-shrink-0" />,
    line:      <Building2 size={11} className={cn('flex-shrink-0', node.status === 'warning' ? 'text-amber-400' : 'text-blue-400')} />,
    operation: <Cpu       size={11} className={cn('flex-shrink-0', node.status === 'bottleneck' ? 'text-red-400' : node.status === 'idle' ? 'text-slate-600' : 'text-emerald-400')} />,
    agv:       <Truck     size={11} className="text-violet-400 flex-shrink-0" />,
    material:  <Package   size={11} className={cn('flex-shrink-0', node.status === 'warning' ? 'text-amber-400' : 'text-slate-500')} />,
  };

  return (
    <div>
      <div
        onClick={() => { if (hasKids) onToggle(node.id); if (!isGroup) onSelect(node.id); }}
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
        className={cn(
          'flex items-center gap-1.5 py-[5px] pr-2 rounded-md cursor-pointer transition-colors select-none',
          selected  ? 'bg-blue-600/15 text-blue-400' : 'hover:bg-[#0d2035]/60',
          isFactory ? 'text-[12px] text-cyan-300 font-semibold' :
          isGroup   ? 'text-[10px] text-slate-600 font-semibold uppercase tracking-wider mt-2 mb-0.5' : 'text-[12px] text-slate-300',
        )}
      >
        <span className="w-3 flex-shrink-0 flex items-center justify-center text-slate-700">
          {hasKids && (expanded ? <ChevronDown size={9} /> : <ChevronRight size={9} />)}
        </span>
        {typeIcon[node.type]}
        <span className="flex-1 truncate">{node.label}</span>
        {node.status === 'bottleneck' && <AlertCircle size={9} className="text-red-400 flex-shrink-0" />}
        {node.status === 'warning' && node.type !== 'operation' && <AlertCircle size={9} className="text-amber-400 flex-shrink-0" />}
        {node.type === 'operation' && (
          <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0 ml-1',
            node.status === 'bottleneck' ? 'bg-red-500' : node.status === 'idle' ? 'bg-slate-700' : 'bg-emerald-500',
          )} />
        )}
      </div>
      {hasKids && expanded && node.children!.map(c => (
        <TreeItem key={c.id} node={c} depth={depth + 1} selectedId={selectedId}
          expandedIds={expandedIds} onSelect={onSelect} onToggle={onToggle} />
      ))}
    </div>
  );
}

function AssetTreePanel({
  selectedId, expandedIds, onSelect, onToggle,
}: {
  selectedId: string | null;
  expandedIds: string[];
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className="absolute top-3 left-3 z-20 flex flex-col rounded-xl border border-[#1e3a55] bg-[#07111e]/90 backdrop-blur shadow-2xl transition-all overflow-hidden"
      style={{ width: collapsed ? 36 : 232, maxHeight: 'calc(100% - 24px)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-2.5 py-2 border-b border-[#142235] flex-shrink-0">
        <button
          onClick={() => setCollapsed(v => !v)}
          className="text-slate-500 hover:text-slate-200 transition-colors flex-shrink-0"
        >
          <Layers size={13} />
        </button>
        {!collapsed && (
          <>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex-1">资产结构</span>
            <button className="text-slate-700 hover:text-slate-400 transition-colors">
              <RefreshCw size={10} />
            </button>
            <button onClick={() => setCollapsed(true)} className="text-slate-700 hover:text-slate-400 transition-colors">
              <ChevronLeft size={12} />
            </button>
          </>
        )}
      </div>

      {!collapsed && (
        <>
          {/* Search */}
          <div className="px-2 py-2 flex-shrink-0">
            <input
              placeholder="搜索资产..."
              className="w-full bg-[#040d16] border border-[#142235] rounded-md px-2.5 py-1 text-[11px] text-slate-300 outline-none focus:border-blue-500/40 placeholder:text-slate-700"
            />
          </div>

          {/* Tree */}
          <div className="flex-1 overflow-y-auto py-1 px-1 min-h-0">
            {ASSET_TREE.map(node => (
              <TreeItem key={node.id} node={node} depth={0} selectedId={selectedId}
                expandedIds={expandedIds} onSelect={onSelect} onToggle={onToggle} />
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-[#142235] px-3 py-1.5 flex items-center gap-3 flex-shrink-0">
            <div className="flex items-center gap-1">
              <AlertCircle size={9} className="text-red-400" />
              <span className="text-[10px] text-slate-600">2 瓶颈</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Simulation Timeline ────────────────────────────────────────────────────────
const DURATION_OPTIONS = [
  { label: '8h',  hours: 8  },
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
  { label: '2d',  hours: 48 },
  { label: '3d',  hours: 72 },
];

const TIMELINE_EVENTS = [
  { hourOffset: 0.08,  label: '投产',    color: '#3b82f6' },
  { hourOffset: 1.37,  label: '物料预警', color: '#f59e0b' },
  { hourOffset: 3.25,  label: '设备故障', color: '#ef4444' },
  { hourOffset: 5.0,   label: '换线',    color: '#8b5cf6' },
  { hourOffset: 5.83,  label: '完工',    color: '#10b981' },
];

function formatSimTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.floor(totalMinutes % 60);
  const s = Math.floor((totalMinutes * 60) % 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function SimTimeline({
  durationHours, onDurationChange,
}: {
  durationHours: number;
  onDurationChange: (h: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [playheadPct, setPlayheadPct] = useState(0);
  const dragging = useRef(false);

  const pctFromEvent = (e: React.MouseEvent | MouseEvent) => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  };

  const onTrackMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    setPlayheadPct(pctFromEvent(e));
    const onMove = (ev: MouseEvent) => { if (dragging.current) setPlayheadPct(pctFromEvent(ev)); };
    const onUp   = () => { dragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  const durationMin = durationHours * 60;
  const currentMin  = playheadPct * durationMin;

  // Wall-clock label for playhead
  const wallLabel = (() => {
    const base = new Date('2026-04-10T08:00:00');
    base.setMinutes(base.getMinutes() + Math.round(currentMin));
    const mm = base.getMonth() + 1;
    const dd = base.getDate();
    const hh = String(base.getHours()).padStart(2, '0');
    const mi = String(base.getMinutes()).padStart(2, '0');
    return `${mm}/${dd} ${hh}:${mi}`;
  })();

  const endLabel = (() => {
    const e = new Date('2026-04-10T08:00:00');
    e.setHours(e.getHours() + durationHours);
    return `${e.getMonth()+1}/${e.getDate()} ${String(e.getHours()).padStart(2,'0')}:00`;
  })();

  // Ticks
  const tickInterval = durationHours <= 12 ? 1 : durationHours <= 24 ? 2 : durationHours <= 48 ? 6 : 12;
  const ticks: number[] = [];
  for (let h = 0; h <= durationHours; h += tickInterval) ticks.push(h);

  // Shift zones
  const shiftZones: Array<{ start: number; end: number }> = [];
  for (let d = 0; d * 24 < durationHours; d++) {
    shiftZones.push({ start: d * 24 + 8, end: Math.min(d * 24 + 20, durationHours) });
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 bg-[#020a12]/96 border-t border-[#1e3a55]/60 backdrop-blur-sm select-none">
      {/* ── Ruler row ── */}
      <div className="relative h-5 mx-4 mt-1.5" ref={trackRef} onMouseDown={onTrackMouseDown}>
        {/* Track bg */}
        <div className="absolute inset-y-0 left-0 right-0 rounded-sm bg-[#07111e] border border-[#142235]" />

        {/* Shift zones */}
        {shiftZones.map((z, i) => {
          const left = (z.start / durationHours) * 100;
          const width = ((z.end - z.start) / durationHours) * 100;
          return (
            <div key={i} className="absolute inset-y-0 bg-blue-500/10"
              style={{ left: `${left}%`, width: `${width}%` }} />
          );
        })}

        {/* Elapsed fill */}
        <div className="absolute inset-y-0 left-0 bg-blue-600/20 rounded-l-sm"
          style={{ width: `${playheadPct * 100}%` }} />

        {/* Tick marks + labels */}
        {ticks.map(h => {
          const pct = (h / durationHours) * 100;
          if (pct > 100.1) return null;
          const isMajor = h % (tickInterval * 2) === 0 || durationHours <= 12;
          const wallH = (8 + h) % 24;
          const label = h > 0 && h % 24 === 0 ? `+${h/24}d` : `${String(wallH).padStart(2,'0')}:00`;
          return (
            <div key={h} className="absolute top-0 bottom-0 flex flex-col justify-start items-start"
              style={{ left: `${pct}%` }}>
              <div className={cn('w-px', isMajor ? 'h-2 bg-[#2a4a6a]' : 'h-1.5 bg-[#1a2e42]')} />
              {isMajor && (
                <span className="text-[8px] font-mono text-slate-500 whitespace-nowrap" style={{ marginLeft: 2 }}>
                  {label}
                </span>
              )}
            </div>
          );
        })}

        {/* Event diamonds */}
        {TIMELINE_EVENTS.map(ev => {
          const pct = (ev.hourOffset / durationHours) * 100;
          if (pct > 100) return null;
          return (
            <div key={ev.label} className="absolute top-0 bottom-0 flex items-center group cursor-default"
              style={{ left: `${pct}%` }}>
              <div className="w-2 h-2 rotate-45 border flex-shrink-0 -translate-x-1/2"
                style={{ background: ev.color + '33', borderColor: ev.color }} />
              <div className="hidden group-hover:flex absolute bottom-full mb-1.5 -translate-x-1/2 bg-[#0b1d30] border border-[#1e3a55] rounded px-2 py-1 flex-col items-center z-20 pointer-events-none"
                style={{ minWidth: 56 }}>
                <span className="text-[9px] font-medium whitespace-nowrap" style={{ color: ev.color }}>{ev.label}</span>
                <span className="text-[8px] font-mono text-slate-500">{formatSimTime(ev.hourOffset * 60)}</span>
              </div>
            </div>
          );
        })}

        {/* Playhead */}
        <div className="absolute top-0 bottom-0 flex flex-col items-center cursor-ew-resize z-10"
          style={{ left: `${playheadPct * 100}%` }}>
          {/* Needle */}
          <div className="w-px flex-1 bg-white/80" />
          {/* Head triangle */}
          <div className="w-0 h-0 flex-shrink-0"
            style={{ borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '6px solid rgba(255,255,255,0.85)' }} />
        </div>
      </div>

      {/* ── Controls row ── */}
      <div className="flex items-center gap-3 px-4 py-1.5">
        {/* Timecode display */}
        <div className="flex items-center gap-1.5 bg-[#040d16] border border-[#142235] rounded px-2.5 py-1 flex-shrink-0">
          <span className="text-[11px] font-mono text-slate-300 tracking-widest">{formatSimTime(currentMin)}</span>
          <span className="text-[9px] text-slate-700 mx-1">/</span>
          <span className="text-[9px] font-mono text-slate-600">{formatSimTime(durationMin)}</span>
        </div>

        {/* Wall clock */}
        <span className="text-[10px] font-mono text-slate-500 flex-shrink-0">{wallLabel}</span>

        <div className="flex-1" />

        {/* Duration selector */}
        <span className="text-[9px] text-slate-600 flex-shrink-0">时长</span>
        <div className="flex items-center gap-0.5">
          {DURATION_OPTIONS.map(opt => (
            <button
              key={opt.hours}
              onClick={() => onDurationChange(opt.hours)}
              className={cn(
                'px-2 py-0.5 rounded text-[9px] font-mono transition-all',
                durationHours === opt.hours
                  ? 'bg-blue-600/25 text-blue-300 border border-blue-500/40'
                  : 'text-slate-500 hover:text-slate-300 border border-transparent hover:border-[#1e3a55]',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <span className="text-[9px] font-mono text-slate-600 flex-shrink-0 ml-2">→ {endLabel}</span>
      </div>
    </div>
  );
}

// ── Factory Viewport ───────────────────────────────────────────────────────────
function FactoryViewport({
  selectedId, onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [durationHours, setDurationHours] = useState(12);
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#030c14]">
      {/* Factory image — centered, tinted to match dark theme */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <img
          src="/images/Group 1664466895.png"
          alt="factory"
          className="w-full h-full object-contain"
          style={{ opacity: 0.18, filter: 'brightness(0.6) saturate(0)' }}
        />
      </div>

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(13,29,48,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(13,29,48,0.3) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Watermark */}
      <div className="absolute top-2.5 left-3 text-[9px] font-mono text-slate-600 select-none pointer-events-none tracking-widest z-10">
        SIMULATION VIEWPORT · 烟台工厂 · SMT PRODUCTION
      </div>

      {/* Legend */}
      <div className="absolute top-2 right-3 flex items-center gap-2 z-10">
        {[
          { cls: 'bg-emerald-500', label: '正常' },
          { cls: 'bg-red-500',     label: '瓶颈' },
          { cls: 'bg-slate-600',   label: '低负荷' },
          { cls: 'bg-blue-500',    label: '已选中' },
        ].map(({ cls, label }) => (
          <div key={label} className="flex items-center gap-1 bg-black/50 backdrop-blur border border-[#1e3a55]/50 px-2 py-0.5 rounded text-[9px] text-slate-400">
            <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', cls)} />
            {label}
          </div>
        ))}
      </div>

      {/* Production lines — interactive overlay */}
      <div className="absolute inset-0 flex flex-col justify-center gap-8 px-8 pb-24 pt-12 z-10">
        {VIEWPORT_LINES.map((line) => (
          <div key={line.id}>
            {/* Line label row */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50 flex-shrink-0" />
              <span className="text-[9px] font-mono text-blue-400/70 uppercase tracking-[0.15em] flex-shrink-0">{line.label}</span>
              <div className="flex-1 border-t border-dashed border-[#1e3a55]/60" />
            </div>

            {/* Machines */}
            <div className="flex items-stretch gap-0">
              {line.machines.map((machine, idx) => {
                const st = machineStyle(machine.status, selectedId === machine.id);
                return (
                  <div key={machine.id} className="flex items-center flex-1 min-w-0">
                    <div
                      className="flex-1 min-w-0 cursor-pointer transition-all"
                      style={{ filter: st.glow ? 'drop-shadow(0 0 8px rgba(59,130,246,0.35))' : undefined }}
                      onClick={() => onSelect(machine.id)}
                    >
                      <div
                        className="rounded-lg px-2.5 pt-2.5 pb-2"
                        style={{ background: st.bg, border: `1px solid ${st.border}`, transition: 'all 0.15s' }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] font-mono truncate pr-1" style={{ color: st.text }}>{machine.label}</span>
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: st.dot }} />
                        </div>
                        <div className="text-[12px] font-bold font-mono leading-none" style={{ color: machine.status === 'bottleneck' ? '#f87171' : '#4a6070' }}>
                          {machine.ct}
                        </div>
                        <div className="text-[8px] font-mono mt-1 leading-none" style={{ color: machine.status === 'bottleneck' ? '#7f1d1d' : machine.status === 'idle' ? '#1e2d3d' : '#0d2035' }}>
                          {machine.status === 'bottleneck' ? '▲ BOTTLENECK' : machine.status === 'idle' ? '— IDLE' : '● RUNNING'}
                        </div>
                      </div>
                    </div>
                    {idx < line.machines.length - 1 && (
                      <div className="w-5 flex items-center justify-center flex-shrink-0">
                        <div className="w-full border-t border-slate-800" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <SimTimeline durationHours={durationHours} onDurationChange={setDurationHours} />
    </div>
  );
}

// ── Right Params Panel ─────────────────────────────────────────────────────────
// ── Time-range override component (shared across all param levels) ─────────────
interface TimeOverrideRow { id: string; startH: string; endH: string; param: string; value: string; }

function TimeRangeOverrides({ availableParams }: { availableParams: Array<{ value: string; label: string }> }) {
  const [rows, setRows] = useState<TimeOverrideRow[]>([]);
  const addRow = () => setRows(prev => [...prev, { id: Math.random().toString(36).slice(2), startH: '2', endH: '4', param: availableParams[0].value, value: '' }]);
  const remove = (id: string) => setRows(prev => prev.filter(r => r.id !== id));
  const update = (id: string, key: keyof TimeOverrideRow, val: string) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, [key]: val } : r));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-[11px] text-slate-400 font-medium">时间段参数覆盖</span>
          <span className="text-[10px] text-slate-600 ml-2">仅在当前方案中生效，不覆盖主数据</span>
        </div>
        <button onClick={addRow} className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 transition-colors">
          <Plus size={10} />添加时段
        </button>
      </div>
      {rows.length === 0 ? (
        <div className="text-[11px] text-slate-700 bg-[#040d16] rounded-lg px-3 py-2.5 text-center border border-[#0e1e2e]">
          未配置 · 点击"添加时段"可设置阶段性参数变化（如第2–4小时CT增加20%）
        </div>
      ) : (
        <div className="space-y-1.5">
          {rows.map(row => (
            <div key={row.id} className="bg-[#040d16] border border-[#0e1e2e] rounded-lg px-2.5 py-2 flex items-center gap-1.5">
              <span className="text-[10px] text-slate-600 flex-shrink-0">T+</span>
              <input type="number" min="0" value={row.startH} onChange={e => update(row.id, 'startH', e.target.value)}
                className="w-10 bg-[#07111e] border border-[#1e3a55] rounded px-1.5 py-1 text-[11px] font-mono text-slate-200 outline-none focus:border-blue-500/60 text-center" />
              <span className="text-[10px] text-slate-600">h →</span>
              <span className="text-[10px] text-slate-600 flex-shrink-0">T+</span>
              <input type="number" min="0" value={row.endH} onChange={e => update(row.id, 'endH', e.target.value)}
                className="w-10 bg-[#07111e] border border-[#1e3a55] rounded px-1.5 py-1 text-[11px] font-mono text-slate-200 outline-none focus:border-blue-500/60 text-center" />
              <span className="text-[10px] text-slate-600 flex-shrink-0">h</span>
              <select value={row.param} onChange={e => update(row.id, 'param', e.target.value)}
                className="flex-1 min-w-0 bg-[#07111e] border border-[#1e3a55] rounded px-1.5 py-1 text-[10px] text-slate-300 outline-none focus:border-blue-500/60">
                {availableParams.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <input type="text" value={row.value} onChange={e => update(row.id, 'value', e.target.value)}
                placeholder="值/±%"
                className="w-14 bg-[#07111e] border border-[#1e3a55] rounded px-1.5 py-1 text-[11px] font-mono text-slate-200 outline-none focus:border-blue-500/60 text-center" />
              <button onClick={() => remove(row.id)} className="text-slate-700 hover:text-red-400 transition-colors flex-shrink-0">
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Params section label helper ────────────────────────────────────────────────
function PSection({ label }: { label: string }) {
  return <div className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold mt-1 mb-2 pt-3 border-t border-[#142235]">{label}</div>;
}

// ── Shared input style ─────────────────────────────────────────────────────────
const inputCls = 'bg-[#07111e] border border-[#1e3a55] rounded-lg px-3 py-2 text-sm font-mono text-slate-200 outline-none focus:border-blue-500/60 transition-colors w-full';
const labelCls = 'text-[11px] text-slate-500 font-medium';

function ParamsPanel({ selectedId }: { selectedId: string | null }) {
  const node = selectedId ? findNode(ASSET_TREE, selectedId) : null;

  if (!node || node.type === 'group') {
    return (
      <div className="flex-1 flex items-center justify-center text-center p-4">
        <div>
          <Cpu size={28} className="text-slate-700 mx-auto mb-2" />
          <p className="text-[11px] text-slate-700">在视图或资产树中<br/>点击工序/设备查看参数</p>
        </div>
      </div>
    );
  }

  // ── Factory: global defaults ──────────────────────────────────────────────
  if (node.type === 'factory') {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b border-[#142235] flex-shrink-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Building2 size={13} className="text-cyan-400" />
            <span className="text-sm font-semibold text-slate-200">{node.label}</span>
          </div>
          <div className="text-[11px] text-slate-500">全局默认参数 · 工序/产线未单独设置时的兜底值</div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          <PSection label="设备默认参数" />
          <div className="flex flex-col gap-1">
            <label className={labelCls}>默认CT（秒/pcs）</label>
            <input type="number" defaultValue="38" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className={labelCls}>默认良品率（%）</label>
              <input type="number" defaultValue="99.2" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>默认作业效率（%）</label>
              <input type="number" defaultValue="100" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className={labelCls}>默认MTBF（小时）</label>
              <input type="number" defaultValue="120" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>默认MTTR（分钟）</label>
              <input type="number" defaultValue="45" className={inputCls} />
            </div>
          </div>
          <PSection label="班次设置" />
          <Select label="排班模式">
            <option>两班制（08:00–20:00）</option>
            <option>三班制（24小时连续）</option>
            <option>单班制（08:00–17:00）</option>
          </Select>
          <div className="flex flex-col gap-1">
            <label className={labelCls}>换班缓冲（分钟）</label>
            <input type="number" defaultValue="10" className={inputCls} />
          </div>
          <PSection label="时间段覆盖" />
          <TimeRangeOverrides availableParams={[
            { value: 'ct',         label: '默认CT（秒）' },
            { value: 'efficiency', label: '作业效率（%）' },
            { value: 'yield',      label: '良品率（%）' },
            { value: 'mtbf',       label: 'MTBF（小时）' },
            { value: 'mttr',       label: 'MTTR（分钟）' },
          ]} />
        </div>
      </div>
    );
  }

  // ── Line: line-level overrides ────────────────────────────────────────────
  if (node.type === 'line') {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b border-[#142235] flex-shrink-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Building2 size={13} className="text-blue-400" />
            <span className="text-sm font-semibold text-slate-200">{node.label}</span>
          </div>
          <div className="text-[11px] text-slate-500">产线级覆盖参数 · 优先于全局默认，被工序级覆盖</div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          <PSection label="产线统一覆盖" />
          <div className="flex flex-col gap-1">
            <label className={labelCls}>CT覆盖值（秒，留空=继承全局）</label>
            <input type="number" placeholder="—" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className={labelCls}>作业效率（%）</label>
              <input type="number" placeholder="—" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>良品率（%）</label>
              <input type="number" placeholder="—" className={inputCls} />
            </div>
          </div>
          <div className="bg-[#0a1929] border border-[#142235] rounded-lg px-3 py-2 text-[10px] text-slate-600">
            留空字段将向上继承全局默认值；工序级单独设置时，工序级优先。
          </div>
          <PSection label="时间段覆盖" />
          <TimeRangeOverrides availableParams={[
            { value: 'ct',         label: 'CT覆盖（秒）' },
            { value: 'efficiency', label: '作业效率（%）' },
            { value: 'yield',      label: '良品率（%）' },
          ]} />
        </div>
      </div>
    );
  }

  // ── Operation: station-level params ──────────────────────────────────────
  if (node.type === 'operation') {
    const takt = 42;
    const util = node.ct ? Math.round((node.ct / takt) * 100) : 0;
    return (
      <div className="flex flex-col h-full">
        <div className={cn('px-4 py-3 border-b border-[#142235] flex-shrink-0', node.status === 'bottleneck' ? 'bg-red-900/10' : '')}>
          <div className="flex items-center gap-2 mb-0.5">
            <Cpu size={13} className={node.status === 'bottleneck' ? 'text-red-400' : 'text-emerald-400'} />
            <span className="text-sm font-semibold text-slate-200">{node.label}</span>
            {node.status === 'bottleneck' && (
              <span className="text-[10px] bg-red-500/15 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded">瓶颈</span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 mb-2">{node.sublabel}</div>
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-slate-600">利用率 (CT ÷ Takt)</span>
            <span className={util > 100 ? 'text-red-400' : util > 85 ? 'text-amber-400' : 'text-slate-400'}>{util}%</span>
          </div>
          <div className="h-1 bg-[#0a1929] rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full', util > 100 ? 'bg-red-500' : util > 85 ? 'bg-amber-500' : 'bg-emerald-500')}
              style={{ width: `${Math.min(util, 100)}%` }} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          <PSection label="工艺参数" />
          <div className="flex flex-col gap-1">
            <label className={cn(labelCls, 'flex items-center justify-between')}>
              CT（秒）<span className="text-slate-700 text-[10px] font-mono">Takt: {takt}s</span>
            </label>
            <input type="number" defaultValue={node.ct}
              className={cn(inputCls, node.status === 'bottleneck' ? 'border-red-500/40 text-red-300' : '')} />
            {node.ct && node.ct > takt && (
              <p className="text-[10px] text-red-400 flex items-center gap-1">
                <AlertCircle size={9} />CT超出Takt {node.ct - takt}s，为产线瓶颈
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className={labelCls}>良品率（%）</label>
              <input type="number" defaultValue={node.yieldRate} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>作业效率（%）</label>
              <input type="number" defaultValue="100" className={inputCls} />
            </div>
          </div>

          <PSection label="设备可靠性" />
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className={labelCls}>MTBF（小时）</label>
              <input type="number" defaultValue="120" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>MTTR（分钟）</label>
              <input type="number" defaultValue={node.mttr} className={inputCls} />
            </div>
          </div>

          <PSection label="人员配置" />
          <div className="flex flex-col gap-1">
            <label className={labelCls}>配置人数</label>
            <input type="number" defaultValue="1" min="0" className={inputCls} />
          </div>

          {/* BOP reference */}
          <PSection label="BOP 参考值（只读）" />
          <div className="bg-[#0a1929] border border-[#142235] rounded-lg p-3">
            <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-[11px]">
              {[
                ['标准CT', `${node.ct ?? '—'}s`],
                ['良品率', `${node.yieldRate ?? '—'}%`],
                ['MTBF', '120h'],
                ['人员需求', '1人'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-slate-600">{k}</span>
                  <span className="text-slate-400 font-mono">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <PSection label="时间段覆盖" />
          <TimeRangeOverrides availableParams={[
            { value: 'ct',         label: 'CT（秒）' },
            { value: 'efficiency', label: '作业效率（%）' },
            { value: 'yield',      label: '良品率（%）' },
            { value: 'mtbf',       label: 'MTBF（小时）' },
            { value: 'mttr',       label: 'MTTR（分钟）' },
            { value: 'staff',      label: '人员数量' },
          ]} />
        </div>
      </div>
    );
  }

  if (node.type === 'agv') {
    return (
      <div className="flex flex-col h-full p-4 gap-4">
        <div className="flex items-center gap-2 pb-3 border-b border-[#142235]">
          <Truck size={14} className="text-violet-400" />
          <span className="text-sm font-semibold text-slate-200">{node.label}</span>
        </div>
        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-slate-500">最大速度（m/min）</label>
            <input type="number" defaultValue="60" className="bg-[#07111e] border border-[#1e3a55] rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500/60" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-slate-500">装卸时间（秒）</label>
            <input type="number" defaultValue="30" className="bg-[#07111e] border border-[#1e3a55] rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500/60" />
          </div>
        </div>
        <div className="bg-[#0a1929] border border-[#142235] rounded-lg p-3 text-[11px] text-slate-600">
          AGV降级参数（AGV系统无响应时使用）
        </div>
      </div>
    );
  }

  if (node.type === 'material') {
    return (
      <div className="flex flex-col h-full p-4 gap-4">
        <div className="flex items-center gap-2 pb-3 border-b border-[#142235]">
          <Package size={14} className={node.status === 'warning' ? 'text-amber-400' : 'text-slate-400'} />
          <div>
            <div className="text-sm font-semibold text-slate-200">{node.label}</div>
            <div className="text-[11px] text-slate-500">{node.sublabel}</div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-slate-500">安全库存水位（pcs）</label>
            <input type="number" defaultValue="500" className="bg-[#07111e] border border-[#1e3a55] rounded-lg px-3 py-2 text-sm text-slate-200 outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-slate-500">初始库存快照（pcs）</label>
            <input type="number" defaultValue="1200" className="bg-[#07111e] border border-[#1e3a55] rounded-lg px-3 py-2 text-sm text-slate-200 outline-none" />
          </div>
        </div>
        {node.status === 'warning' && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle size={12} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <span className="text-[11px] text-amber-300">当前库存低于安全水位，仿真初始状态可能出现缺料</span>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ── Floating Params Panel (right side, over viewport) ─────────────────────────
function FloatingParamsPanel({
  selectedId, onClear,
}: {
  selectedId: string | null;
  onClear: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className="absolute top-3 right-3 z-20 flex flex-col rounded-xl border border-[#1e3a55] bg-[#07111e]/90 backdrop-blur shadow-2xl transition-all overflow-hidden"
      style={{ width: collapsed ? 36 : 256, maxHeight: 'calc(100% - 24px)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-2.5 py-2 border-b border-[#142235] flex-shrink-0">
        <button
          onClick={() => setCollapsed(v => !v)}
          className="text-slate-500 hover:text-slate-200 transition-colors flex-shrink-0"
        >
          <Sliders size={13} />
        </button>
        {!collapsed && (
          <>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex-1">
              {selectedId ? '设备参数' : '默认参数'}
            </span>
            {selectedId && (
              <button onClick={onClear} className="text-slate-600 hover:text-slate-300 transition-colors">
                <X size={11} />
              </button>
            )}
            <button onClick={() => setCollapsed(true)} className="text-slate-700 hover:text-slate-400 transition-colors">
              <ChevronRight size={12} />
            </button>
          </>
        )}
      </div>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto min-h-0">
          <ParamsPanel selectedId={selectedId} />
        </div>
      )}
    </div>
  );
}

// ── Data Table Panel (center area in "input" mode) ─────────────────────────────

type DataStatus = 'ok' | 'warn' | 'missing';

interface DataSection {
  id: string;
  title: string;
  desc: string;                          // what this data type is
  sourceSystem: string;                  // where it comes from
  sourceNote: string;                    // sync details when expanded
  required: boolean;
  status: DataStatus;
  summary?: string;
  warning?: string;
  canSync: boolean;
  canImport: boolean;
  cols?: string[];
  rows?: string[][];
}

const DATA_SECTIONS: DataSection[] = [
  {
    id: 'bop',
    title: 'BOP（工艺路线）',
    desc: '每条产线每个产品的工序顺序、CT、良品率、人员需求',
    sourceSystem: '主数据平台',
    sourceNote: '主数据平台 v2.1 · 快照版本 v1.2.8 · 同步于 2026-04-10 08:30',
    required: true,
    status: 'ok',
    summary: '23 个激活版本 · 覆盖 6 种产品 × 2 条产线',
    canSync: true,
    canImport: true,
    cols: ['BOP ID', '产品型号', '产线', '工序数', '状态'],
    rows: [
      ['BOP-A32X-L01', 'A32X', 'SMT产线 L01', '5 道', '激活'],
      ['BOP-A32X-L02', 'A32X', 'SMT产线 L02', '3 道', '激活'],
      ['BOP-B15Y-L01', 'B15Y', 'SMT产线 L01', '5 道', '激活'],
      ['BOP-C08Z-L01', 'C08Z', 'SMT产线 L01', '5 道', '激活'],
    ],
  },
  {
    id: 'equipment-config',
    title: '产线设备配置',
    desc: '产线上的设备清单、数量、布局及各设备能力参数（最大速度、标准CT等）',
    sourceSystem: '主数据平台',
    sourceNote: '主数据平台 v2.1 · 快照版本 v1.2.8 · 同步于 2026-04-10 08:30',
    required: true,
    status: 'ok',
    summary: '2 条产线 · 8 台关键设备 · 最后更新：2026-04-08',
    canSync: true,
    canImport: true,
    cols: ['设备编号', '工序', '所属产线', '设备类型', '标准CT（s）'],
    rows: [
      ['SPI-L01',      '锡膏印刷', 'SMT产线 L01', 'SPI印刷机',  '32'],
      ['SMT-L01-01',   '贴片(前)', 'SMT产线 L01', '高速贴片机', '48'],
      ['SMT-L01-02',   '贴片(后)', 'SMT产线 L01', '高速贴片机', '45'],
      ['REFLOW-L01',   '回流焊',   'SMT产线 L01', '回流炉',     '38'],
      ['AOI-L01',      'AOI检测',  'SMT产线 L01', 'AOI设备',    '28'],
    ],
  },
  {
    id: 'staffing',
    title: '人员配置',
    desc: '各工位人员数量及工种-工序关系；人数属可调参数，可在方案中临时覆盖',
    sourceSystem: '主数据平台',
    sourceNote: '主数据平台 v2.1 · 快照版本 v1.2.8 · 同步于 2026-04-10 08:30',
    required: false,
    status: 'ok',
    summary: '2 条产线 · 共 9 个工位 · 总配置 12 人',
    canSync: true,
    canImport: true,
    cols: ['工序', '所属产线', '工种', '配置人数', '最少人数'],
    rows: [
      ['锡膏印刷', 'SMT产线 L01', '印刷工', '1', '1'],
      ['贴片(前)', 'SMT产线 L01', '贴片工', '2', '1'],
      ['贴片(后)', 'SMT产线 L01', '贴片工', '2', '1'],
      ['回流焊',   'SMT产线 L01', '炉温工', '1', '1'],
      ['AOI检测',  'SMT产线 L01', '检验员', '1', '1'],
    ],
  },
  {
    id: 'changeover',
    title: '换线时间配置',
    desc: '产品切换时的换线时间，工单切换时按此数据占用产线；换线时间约束开启时必需',
    sourceSystem: '主数据平台',
    sourceNote: '主数据平台 v2.1 · 快照版本 v1.2.8 · 同步于 2026-04-10 08:30',
    required: false,
    status: 'ok',
    summary: '18 组换线组合 · 平均换线时长 22 分钟 · 最长 45 分钟（A32X→C08Z）',
    canSync: true,
    canImport: true,
    cols: ['从产品', '切换至', '所属产线', '换线时长（min）', '换线类型'],
    rows: [
      ['A32X', 'B15Y', 'SMT产线 L01', '20', '小换线'],
      ['A32X', 'C08Z', 'SMT产线 L01', '45', '大换线'],
      ['B15Y', 'A32X', 'SMT产线 L01', '18', '小换线'],
      ['B15Y', 'C08Z', 'SMT产线 L01', '40', '大换线'],
    ],
  },
  {
    id: 'op-transition',
    title: '工序间接续时间',
    desc: '相邻工序间的传输时间（传送带/人工搬运）和强制等待时间（工艺要求冷却等）',
    sourceSystem: '主数据平台',
    sourceNote: '主数据平台 v2.1 · 快照版本 v1.2.8 · 同步于 2026-04-10 08:30',
    required: false,
    status: 'ok',
    summary: '8 段工序间配置 · 有强制等待的工序：回流焊→AOI（冷却 30s）',
    canSync: true,
    canImport: true,
    cols: ['上游工序', '下游工序', '所属产线', '传输时间（s）', '强制等待（s）'],
    rows: [
      ['锡膏印刷', '贴片(前)', 'SMT产线 L01', '5',  '0'],
      ['贴片(前)', '贴片(后)', 'SMT产线 L01', '3',  '0'],
      ['贴片(后)', '回流焊',   'SMT产线 L01', '5',  '0'],
      ['回流焊',   'AOI检测',  'SMT产线 L01', '10', '30'],
    ],
  },
  {
    id: 'calendar',
    title: '工作日历 & 班次',
    desc: '仿真时钟推进的基础，决定工作/非工作时段及 Takt Time 计算',
    sourceSystem: '主数据平台',
    sourceNote: '主数据平台 v2.1 · 快照版本 v1.2.8 · 同步于 2026-04-10 08:30',
    required: true,
    status: 'ok',
    summary: '工作日历：2026年Q2 · 班次：早班 08:00–20:00（12h）· 工作日 61 天',
    canSync: true,
    canImport: true,
    cols: ['班次名称', '开始时间', '结束时间', '时长', '适用产线'],
    rows: [
      ['早班', '08:00', '20:00', '12h', '全部产线'],
    ],
  },
  {
    id: 'equipment-params',
    title: '设备故障参数（MTBF/MTTR）',
    desc: '设备故障约束开启时使用，按指数分布随机触发故障和维修停机',
    sourceSystem: '主数据平台',
    sourceNote: '主数据平台 v2.1 · 快照版本 v1.2.8 · 同步于 2026-04-10 08:30',
    required: false,
    status: 'ok',
    summary: '64 台设备 · 均已配置 MTBF/MTTR · 分布模型：指数分布',
    canSync: true,
    canImport: true,
    cols: ['设备编号', '工序', 'MTBF（小时）', 'MTTR（分钟）', '故障分布'],
    rows: [
      ['SMT-L01-01', '贴片(前)', '120', '45', '指数分布'],
      ['SMT-L01-02', '贴片(后)', '115', '42', '指数分布'],
      ['REFLOW-L01', '回流焊',   '200', '60', '指数分布'],
      ['AOI-L01',    'AOI检测',  '500', '20', '指数分布'],
    ],
  },
  {
    id: 'production-tasks',
    title: '生产任务',
    desc: '仿真驱动的工单列表，包含产品型号、计划产量、计划时间',
    sourceSystem: 'ERP',
    sourceNote: 'ERP v3.2 · 同步于 2026-04-10 08:35:22 · 操作人：李明',
    required: true,
    status: 'ok',
    summary: '工单 23 条 · 产品型号 6 种 · 总计划产量 4,800 pcs',
    canSync: true,
    canImport: true,
    cols: ['工单号', '产品型号', '计划产量', '计划完工', '状态'],
    rows: [
      ['WO-20260410-001', 'A32X', '500 pcs', '2026-04-10 14:00', '正常'],
      ['WO-20260410-002', 'A32X', '300 pcs', '2026-04-10 18:00', '正常'],
      ['WO-20260410-003', 'B15Y', '800 pcs', '2026-04-10 20:00', '正常'],
      ['WO-20260410-004', 'C08Z', '300 pcs', '2026-04-10 20:00', '正常'],
    ],
  },
  {
    id: 'material-supply',
    title: '物料供应计划',
    desc: '物料供应约束开启时使用，跟踪各物料的到货时间与数量',
    sourceSystem: 'ERP',
    sourceNote: 'ERP v3.2 · 同步于 2026-04-10 08:35:25 · 操作人：李明',
    required: false,
    status: 'ok',
    summary: '物料种类 42 种 · 供应批次 18 批 · 时间覆盖：完全匹配',
    canSync: true,
    canImport: true,
    cols: ['物料编码', '物料名称', '供应数量', '到货时间', '状态'],
    rows: [
      ['IC-12345', 'IC主控',   '2000 pcs',  '2026-04-10 06:00', '正常'],
      ['CAP-0402', '电容0402', '50000 pcs', '2026-04-10 07:00', '正常'],
      ['CON-A1',   '连接器A1', '1000 pcs',  '2026-04-10 07:30', '正常'],
    ],
  },
  {
    id: 'inventory',
    title: '库存快照',
    desc: '仿真开始时刻的原材料仓库存量，影响缺料事件触发时机',
    sourceSystem: 'WMS',
    sourceNote: 'WMS · 未同步',
    required: false,
    status: 'missing',
    warning: '未配置库存快照，仿真将假设初始库存为零，可能导致缺料事件提前触发，影响结果准确性',
    canSync: true,
    canImport: true,
  },
  {
    id: 'wip',
    title: '线边仓状态快照',
    desc: '仿真开始时各工序间线边仓的 WIP 数量，影响初始状态的产线均衡',
    sourceSystem: 'MES',
    sourceNote: 'MES · 未同步',
    required: false,
    status: 'missing',
    warning: '未配置线边仓快照，仿真将以各线边仓空仓状态启动',
    canSync: true,
    canImport: true,
  },
];

const SOURCE_BADGE: Record<string, string> = {
  '主数据平台': 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  'ERP':        'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  'WMS':        'text-violet-400 bg-violet-500/10 border-violet-500/20',
  'MES':        'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
};

function DataTablePanel() {
  const [expanded, setExpanded] = useState<string[]>(['production-tasks']);

  const toggle = (id: string) =>
    setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const groups = [
    { label: '基础数据', note: '来自主数据平台（只读，版本锁定）', ids: ['bop', 'equipment-config', 'staffing', 'changeover', 'op-transition', 'calendar', 'equipment-params'] },
    { label: '业务数据', note: '来自 ERP / WMS / MES（按需同步快照）', ids: ['production-tasks', 'material-supply', 'inventory', 'wip'] },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5">
      <div className="flex items-start gap-2 bg-blue-500/5 border border-blue-500/15 rounded-xl px-4 py-3">
        <Info size={13} className="text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-400">仿真引擎使用数据快照运行，方案启动后快照锁定，主数据系统的后续变更不影响本次仿真结果。</p>
      </div>

      {groups.map(group => {
        const sections = DATA_SECTIONS.filter(s => group.ids.includes(s.id));
        return (
          <div key={group.label}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{group.label}</span>
              <span className="text-[10px] text-slate-700">{group.note}</span>
            </div>
            <div className="space-y-2">
              {sections.map(sec => {
                const isExpanded = expanded.includes(sec.id);
                return (
                  <div key={sec.id} className={cn(
                    'border rounded-xl overflow-hidden transition-all',
                    sec.status === 'ok'      ? 'bg-[#07111e] border-[#142235]' :
                    sec.status === 'missing' ? 'bg-[#07111e] border-[#142235]' :
                    'bg-amber-900/5 border-amber-500/20',
                  )}>
                    {/* Header row */}
                    <div
                      className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-[#0d2035]/30 transition-colors"
                      onClick={() => toggle(sec.id)}
                    >
                      {/* Status dot */}
                      <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0',
                        sec.status === 'ok'      ? 'bg-emerald-400' :
                        sec.status === 'warn'    ? 'bg-amber-400' :
                        'bg-slate-700',
                      )} />

                      {/* Title + description */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-300">{sec.title}</span>
                          {sec.required && (
                            <span className="text-[10px] text-red-400/70">必填</span>
                          )}
                          {/* Source badge — always visible */}
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', SOURCE_BADGE[sec.sourceSystem] ?? '')}>
                            {sec.sourceSystem}
                          </span>
                          {sec.status === 'missing' && (
                            <span className="text-[10px] text-slate-600 bg-[#0a1929] px-1.5 py-0.5 rounded">未配置</span>
                          )}
                        </div>
                        {!isExpanded && (
                          <p className="text-[11px] text-slate-600 mt-0.5 truncate">{sec.summary ?? sec.desc}</p>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        {sec.canSync && (
                          <Button size="xs" variant="outline">
                            <RefreshCw size={10} />同步
                          </Button>
                        )}
                        {sec.canImport && (
                          <Button size="xs" variant="outline">
                            <Upload size={10} />导入
                          </Button>
                        )}
                      </div>

                      {/* Expand toggle */}
                      <span className="text-slate-700 flex-shrink-0">
                        {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      </span>
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="border-t border-[#0e1e2e]">
                        {/* Description + source info bar */}
                        <div className="px-4 py-2.5 bg-[#040d16] flex items-start justify-between gap-4">
                          <p className="text-[11px] text-slate-500">{sec.desc}</p>
                          <span className="text-[10px] text-slate-700 font-mono flex-shrink-0">{sec.sourceNote}</span>
                        </div>

                        {/* Warning */}
                        {sec.warning && (
                          <div className="mx-4 mt-3 flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                            <AlertCircle size={11} className="text-amber-400 flex-shrink-0 mt-0.5" />
                            <span className="text-xs text-amber-300">{sec.warning}</span>
                          </div>
                        )}

                        {/* Summary */}
                        {sec.summary && (
                          <div className="px-4 py-2 text-[11px] text-slate-400">{sec.summary}</div>
                        )}

                        {/* Data table */}
                        {sec.rows && sec.rows.length > 0 && sec.cols && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-y border-[#0e1e2e] bg-[#040d16]">
                                  {sec.cols.map(col => (
                                    <th key={col} className="text-left px-4 py-2 text-[11px] text-slate-600 font-medium">{col}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#0e1e2e]">
                                {sec.rows.map((row, i) => (
                                  <tr key={i} className="hover:bg-[#0d2035]/30 transition-colors">
                                    {row.map((cell, j) => (
                                      <td key={j} className={cn('px-4 py-2', j === 0 ? 'font-mono text-slate-400' : 'text-slate-500')}>{cell}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Constraint Version Manager Modal ──────────────────────────────────────────
interface ConstraintVersion {
  id: string;
  name: string;
  savedAt: string;
  savedBy: string;
  config: Record<string, boolean>;
}

const MOCK_CONSTRAINT_VERSIONS: ConstraintVersion[] = [
  { id: 'CV1', name: '标准生产约束', savedAt: '2026-04-08 14:30', savedBy: '李明',
    config: { 'device-fault': true, 'material-supply': true, 'agv-dispatch': false, 'wip-buffer': true, 'workforce': false, 'changeover': true, 'pm': false } },
  { id: 'CV2', name: '含人力约束（夜班评估）', savedAt: '2026-04-09 09:15', savedBy: '王芳',
    config: { 'device-fault': true, 'material-supply': true, 'agv-dispatch': false, 'wip-buffer': true, 'workforce': true, 'changeover': true, 'pm': false } },
  { id: 'CV3', name: '理想产能（无约束）', savedAt: '2026-04-10 08:00', savedBy: '李明',
    config: { 'device-fault': false, 'material-supply': false, 'agv-dispatch': false, 'wip-buffer': false, 'workforce': false, 'changeover': false, 'pm': false } },
];

function ConstraintVersionModal({
  current, onLoad, onSave, onClose,
}: {
  current: Record<string, boolean>;
  onLoad: (config: Record<string, boolean>) => void;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [versions, setVersions] = useState<ConstraintVersion[]>(MOCK_CONSTRAINT_VERSIONS);
  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  const handleSave = () => {
    if (!saveName.trim()) return;
    const newVer: ConstraintVersion = {
      id: `CV${Date.now()}`,
      name: saveName.trim(),
      savedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      savedBy: '李明',
      config: { ...current },
    };
    setVersions(prev => [newVer, ...prev]);
    onSave(saveName.trim());
    setSaveName('');
    setShowSaveInput(false);
  };

  const enabledLabel = (cfg: Record<string, boolean>) => {
    const count = Object.values(cfg).filter(Boolean).length;
    return `${count} / ${CONSTRAINTS_DATA.length} 已启用`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0b1d30] border border-[#1e3a55] rounded-2xl w-[480px] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#142235]">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">约束配置版本管理</h2>
            <p className="text-[11px] text-slate-600 mt-0.5">保存当前约束配置为版本，或加载历史版本</p>
          </div>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-300 transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Version list */}
        <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
          {versions.map(v => (
            <div key={v.id} className="flex items-center gap-3 bg-[#07111e] border border-[#142235] rounded-xl px-4 py-3 group">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-300 truncate">{v.name}</div>
                <div className="text-[10px] text-slate-600 mt-0.5 flex items-center gap-2">
                  <span>{enabledLabel(v.config)}</span>
                  <span>·</span>
                  <span>{v.savedAt}</span>
                  <span>·</span>
                  <span>{v.savedBy}</span>
                </div>
              </div>
              <Button size="xs" variant="outline" onClick={() => { onLoad(v.config); onClose(); }}>
                加载
              </Button>
            </div>
          ))}
        </div>

        {/* Save current */}
        <div className="px-4 pb-4 border-t border-[#142235] pt-4">
          {showSaveInput ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setShowSaveInput(false); }}
                placeholder="输入版本名称..."
                className="flex-1 bg-[#07111e] border border-[#1e3a55] rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500/60 placeholder:text-slate-600"
              />
              <Button size="xs" variant="primary" disabled={!saveName.trim()} onClick={handleSave}>保存</Button>
              <Button size="xs" variant="ghost" onClick={() => setShowSaveInput(false)}>取消</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setShowSaveInput(true)} className="w-full justify-center">
              <Save size={12} /> 将当前配置保存为新版本
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Constraints Panel ──────────────────────────────────────────────────────────
const SIMULATOR_OPTIONS: Array<{ id: string; label: string; desc: string; cls: string; exclusive?: boolean; requiresDes?: boolean }> = [
  { id: 'des',          label: '生产过程模拟', desc: '离散事件引擎，驱动工单调度与设备事件', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
  { id: 'line-balance', label: '线平衡模拟',   desc: '实时计算CT/节拍比，识别瓶颈工序',     cls: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25' },
  { id: 'agv',          label: 'AGV路径模拟', desc: '模拟物料搬运路径与时序，需启用生产过程模拟', cls: 'bg-violet-500/15 text-violet-400 border-violet-500/25', requiresDes: true },
  { id: 'smt',          label: 'SMT产能规划', desc: '独立月度产能评估，与其他模拟器互斥',   cls: 'bg-amber-500/15 text-amber-400 border-amber-500/25', exclusive: true },
];

function ConstraintsPanel({ onOpenVersionManager }: { onOpenVersionManager: (getter: () => Record<string, boolean>, loader: (c: Record<string, boolean>) => void) => void }) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(CONSTRAINTS_DATA.map(c => [c.id, c.defaultOn]))
  );

  // 模拟时长
  const [duration, setDuration] = useState('8');
  const [durationUnit, setDurationUnit] = useState<'h' | 'd'>('h');

  // 模拟器选择
  const [simulators, setSimulators] = useState<Set<string>>(new Set(['des', 'line-balance']));

  const toggleSimulator = (id: string) => {
    const opt = SIMULATOR_OPTIONS.find(o => o.id === id)!;
    setSimulators(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // If removing DES, also remove AGV which depends on it
        if (id === 'des') next.delete('agv');
      } else {
        if (opt.exclusive) {
          // SMT is exclusive — clear everything else
          return new Set([id]);
        }
        // If adding any non-SMT, clear SMT
        next.delete('smt');
        next.add(id);
      }
      return next;
    });
  };

  const maxDurationHours = 30 * 24;
  const durationHours = durationUnit === 'h' ? Number(duration) : Number(duration) * 24;
  const durationExceeds = durationHours > maxDurationHours;

  const toggle = (id: string) => {
    const c = CONSTRAINTS_DATA.find(x => x.id === id)!;
    if (c.depId && !enabled[c.depId]) return;
    setEnabled(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const enabledCount = Object.values(enabled).filter(Boolean).length;

  const getEnabled = () => enabled;
  const loadEnabled = (cfg: Record<string, boolean>) => setEnabled(cfg);

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-6">

      {/* ── Section 1: 模拟时长 ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold text-slate-300">模拟时长</span>
          <span className="text-[10px] text-slate-600">最长 30 天</span>
        </div>
        <div className="bg-[#07111e] border border-[#142235] rounded-xl p-4">
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              value={duration}
              onChange={e => setDuration(e.target.value.replace(/[^0-9]/g, '') || '1')}
              className={cn(
                'w-24 bg-[#040d16] border rounded-lg px-3 py-1.5 text-sm text-slate-200 outline-none text-center font-mono',
                durationExceeds ? 'border-red-500/60 focus:border-red-500' : 'border-[#1e3a55] focus:border-blue-500/60',
              )}
            />
            <div className="flex rounded-lg overflow-hidden border border-[#1e3a55]">
              {([['h', '小时'], ['d', '天']] as const).map(([val, lbl]) => (
                <button
                  key={val}
                  onClick={() => setDurationUnit(val)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium transition-colors',
                    durationUnit === val ? 'bg-blue-600/30 text-blue-300' : 'text-slate-500 hover:text-slate-300 hover:bg-[#0d2035]',
                  )}
                >
                  {lbl}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-500">
              {durationUnit === 'h'
                ? `= ${(Number(duration) / 8).toFixed(1)} 个工作班次`
                : `= ${Number(duration) * 24} 小时`}
            </span>
          </div>
          {durationExceeds && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-red-400">
              <AlertCircle size={11} />
              <span>超出最大限制 30 天（720 小时）</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 2: 模拟器选择 ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold text-slate-300">模拟器选择</span>
          <span className="text-[10px] text-slate-600">已选 {simulators.size} 个</span>
        </div>
        <div className="space-y-2">
          {SIMULATOR_OPTIONS.map(opt => {
            const isOn = simulators.has(opt.id);
            const desBlocked = opt.requiresDes && !simulators.has('des');
            const smtActive = simulators.has('smt') && !opt.exclusive;
            const blocked = desBlocked || smtActive;
            return (
              <div
                key={opt.id}
                className={cn(
                  'border rounded-xl p-3.5 transition-all',
                  blocked   ? 'opacity-40 border-[#142235] bg-[#07111e]' :
                  isOn      ? 'border-blue-500/20 bg-blue-600/5' :
                              'border-[#142235] bg-[#07111e]',
                )}
              >
                <div className="flex items-center gap-3">
                  <button
                    disabled={blocked}
                    onClick={() => !blocked && toggleSimulator(opt.id)}
                    className={cn(
                      'relative inline-flex h-5 w-9 items-center rounded-full transition-all flex-shrink-0',
                      isOn && !blocked ? 'bg-blue-600' : 'bg-slate-700',
                      blocked && 'cursor-not-allowed',
                    )}
                  >
                    <span className={cn('inline-block w-3.5 h-3.5 transform rounded-full bg-white transition-all', isOn && !blocked ? 'translate-x-4' : 'translate-x-0.5')} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-300">{opt.label}</span>
                      {isOn && !blocked && <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', opt.cls)}>已启用</span>}
                      {opt.exclusive && <span className="text-[10px] text-slate-600 bg-[#0a1929] px-1.5 py-0.5 rounded">独立模式</span>}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">{opt.desc}</p>
                    {desBlocked && (
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-400">
                        <AlertCircle size={9} />
                        <span>请先启用「生产过程模拟」</span>
                      </div>
                    )}
                    {smtActive && (
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-400">
                        <AlertCircle size={9} />
                        <span>SMT产能规划为独立模式，不可与其他模拟器同时启用</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section 3: 软约束开关 ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-300">软约束开关</span>
            <span className="text-[10px] text-slate-600">{enabledCount} / {CONSTRAINTS_DATA.length} 已启用</span>
          </div>
          <button
            onClick={() => onOpenVersionManager(getEnabled, loadEnabled)}
            className="text-[10px] text-blue-400 hover:text-blue-300 bg-blue-600/10 border border-blue-500/20 px-2 py-0.5 rounded transition-colors"
          >
            版本管理
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-3">控制仿真引擎建模深度。关闭全部时以理想产能模式运行。</p>

        <div className="space-y-2">
          {CONSTRAINTS_DATA.map(c => {
            const depBlocked = !!c.depId && !enabled[c.depId];
            const isOn = enabled[c.id] && !depBlocked;
            return (
              <div
                key={c.id}
                className={cn(
                  'border rounded-xl p-4 transition-all',
                  depBlocked ? 'opacity-50 border-[#142235] bg-[#07111e]' :
                  isOn        ? 'bg-blue-600/5 border-blue-500/20' :
                                'border-[#142235] bg-[#07111e]',
                )}
              >
                <div className="flex items-center gap-3">
                  <button
                    disabled={depBlocked}
                    onClick={() => toggle(c.id)}
                    className={cn(
                      'relative inline-flex h-5 w-9 items-center rounded-full transition-all flex-shrink-0',
                      isOn ? 'bg-blue-600' : 'bg-slate-700',
                      depBlocked && 'cursor-not-allowed',
                    )}
                  >
                    <span className={cn('inline-block w-3.5 h-3.5 transform rounded-full bg-white transition-all', isOn ? 'translate-x-4' : 'translate-x-0.5')} />
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-300">{c.label}</span>
                      {isOn && <span className="text-[10px] text-blue-400 bg-blue-600/10 px-1.5 py-0.5 rounded">已启用</span>}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">{c.desc}</p>
                    {depBlocked && c.depNote && (
                      <div className="mt-2 flex items-start gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-2">
                        <AlertCircle size={10} className="text-amber-400 flex-shrink-0 mt-0.5" />
                        <span className="text-[10px] text-amber-300">{c.depNote}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {enabledCount === 0 && (
          <div className="mt-4 bg-slate-500/10 border border-slate-500/20 rounded-xl px-4 py-3 flex items-start gap-2">
            <Info size={13} className="text-slate-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-400">当前为理想产能仿真模式（无约束），适合快速评估产能上限。</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Ribbon Toolbar ─────────────────────────────────────────────────────────────
interface RibbonBtnProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  variant?: 'default' | 'primary' | 'danger';
  disabled?: boolean;
}

function RBtn({ icon, label, onClick, active, variant = 'default', disabled }: RibbonBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg transition-all min-w-[46px] disabled:opacity-40 disabled:cursor-not-allowed',
        variant === 'primary' ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/20' :
        variant === 'danger'  ? 'text-red-400 hover:bg-red-900/20 border border-transparent' :
        active                ? 'bg-[#0d2035] text-blue-400 border border-blue-500/15' :
        'text-slate-400 hover:bg-[#0d2035] hover:text-slate-200 border border-transparent',
      )}
    >
      {icon}
      <span className="text-[10px] whitespace-nowrap leading-none">{label}</span>
    </button>
  );
}

function RDivider() {
  return <div className="w-px h-9 bg-[#142235] mx-0.5 self-center" />;
}

function RGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-0.5 pb-1">{children}</div>
      <div className="text-[9px] text-slate-700 uppercase tracking-wider">{title}</div>
    </div>
  );
}

function Ribbon({
  activeTab, onTabChange, onOpenVersionManager, isReady, onLaunch,
}: {
  activeTab: RibbonTab;
  onTabChange: (t: RibbonTab) => void;
  onOpenVersionManager: () => void;
  isReady: boolean;
  onLaunch: () => void;
}) {
  const tabs: Array<{ id: RibbonTab; label: string }> = [
    { id: 'input',       label: '输入数据' },
    { id: 'params',      label: '参数配置' },
    { id: 'constraints', label: '约束设置' },
  ];

  return (
    <div className="border-b border-[#142235] bg-[#07111e] flex-shrink-0">
      {/* Tab row */}
      <div className="flex items-center px-4 gap-0 border-b border-[#0e1e2e]">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            className={cn(
              'px-4 py-2 text-xs font-medium transition-all border-b-2 -mb-px',
              activeTab === t.id
                ? 'text-blue-400 border-blue-500'
                : 'text-slate-500 border-transparent hover:text-slate-300',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Button row */}
      <div className="flex items-center gap-1.5 px-4 py-1.5 overflow-x-auto">
        {activeTab === 'input' && (
          <>
            <RGroup title="批量操作">
              <RBtn icon={<RefreshCw size={13} />} label="全量同步" />
              <RBtn icon={<CheckCircle2 size={13} />} label="完整性检查" />
            </RGroup>
          </>
        )}

        {activeTab === 'params' && (
          <>
            <RGroup title="模板">
              <RBtn icon={<BookOpen size={13} />} label="套用模板" />
              <RBtn icon={<Save size={13} />} label="另存模板" />
            </RGroup>
            <RDivider />
            <RGroup title="操作">
              <RBtn icon={<RefreshCw size={13} />} label="重置默认" />
              <RBtn icon={<Settings2 size={13} />} label="MES对比" />
            </RGroup>
          </>
        )}

        {activeTab === 'constraints' && (
          <>
            <RGroup title="版本">
              <RBtn icon={<BookOpen size={13} />} label="版本管理" onClick={onOpenVersionManager} />
              <RBtn icon={<Save size={13} />} label="另存版本" onClick={onOpenVersionManager} />
            </RGroup>
          </>
        )}

        {/* Always-visible quick run */}
        <div className="flex-1" />
        <RDivider />
        <RGroup title="运行">
          <RBtn
            icon={<Play size={13} />}
            label="启动仿真"
            variant="primary"
            disabled={!isReady}
            onClick={onLaunch}
          />
        </RGroup>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function PlanConfigPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<PlanOut | null>(null);
  const [assetTree, setAssetTree] = useState<TreeNode[]>(ASSET_TREE);
  const [viewportLines, setViewportLines] = useState(VIEWPORT_LINES);

  // Load plan and asset tree from API
  useEffect(() => {
    if (!planId) return;
    planApi.get(planId).then(setPlan).catch(() => {});

    // Build asset tree from master data
    masterApi.factories().then(async (factories) => {
      if (!factories.length) return;
      const factory = factories[0];
      const stages = await masterApi.stages(factory.factory_id);
      if (!stages.length) return;

      const lineNodes: TreeNode[] = [];
      const vpLines: typeof VIEWPORT_LINES = [];

      for (const stage of stages) {
        const lines = await masterApi.lines(stage.stage_id);
        for (const line of lines) {
          const ops = await masterApi.operations(line.line_id);
          let bop: BopOut | null = null;
          try { bop = await masterApi.bop(line.line_id); } catch { /* no bop */ }
          const ctMap = new Map<string, BopProcessOut>();
          if (bop) for (const p of bop.processes) ctMap.set(p.operation_id, p);

          const opNodes: TreeNode[] = ops.map(op => {
            const proc = ctMap.get(op.operation_id);
            const ct = proc ? Number(proc.standard_ct) : undefined;
            return {
              id: op.operation_id,
              label: op.operation_name,
              sublabel: op.operation_code,
              type: 'operation' as NodeType,
              status: 'normal' as NodeStatus,
              ct,
              yieldRate: proc ? Number(proc.yield_rate) * 100 : undefined,
            };
          });

          // Find bottleneck
          const maxCt = Math.max(...opNodes.map(n => n.ct ?? 0));
          for (const n of opNodes) {
            if (n.ct === maxCt && maxCt > 0) n.status = 'bottleneck';
          }

          lineNodes.push({
            id: line.line_id,
            label: line.line_name,
            sublabel: line.line_code,
            type: 'line',
            status: 'normal',
            children: opNodes,
          });

          vpLines.push({
            id: line.line_id,
            label: line.line_name,
            machines: opNodes.slice(0, 8).map(n => ({
              id: n.id,
              label: n.label,
              ct: n.ct ? `${n.ct}s` : '—',
              status: n.status ?? ('normal' as NodeStatus),
            })),
          });
        }
      }

      const tree: TreeNode[] = [{
        id: 'factory', label: factory.factory_name, type: 'factory',
        children: [{
          id: 'lines', label: 'Production Lines', type: 'group',
          children: lineNodes,
        }],
      }];

      ASSET_TREE = tree;
      VIEWPORT_LINES = vpLines;
      setAssetTree(tree);
      setViewportLines(vpLines);
    }).catch(err => console.error('Failed to load asset tree', err));
  }, [planId]);

  const [ribbonTab, setRibbonTab]       = useState<RibbonTab>('input');
  const [selectedId, setSelectedId]     = useState<string | null>('factory');
  const [expandedIds, setExpandedIds]   = useState<string[]>(['factory', 'lines']);
  const [planStatus, setPlanStatus]     = useState<'DRAFT' | 'READY'>('DRAFT');

  // input completeness: 67% means not all required data configured
  const inputComplete = 67 === 100;
  const isReady = planStatus === 'READY';

  // Version manager modal
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const versionGetterRef = useState<(() => Record<string, boolean>) | null>(null);
  const versionLoaderRef = useState<((c: Record<string, boolean>) => void) | null>(null);

  const handleOpenVersionManager = (
    getter: () => Record<string, boolean>,
    loader: (c: Record<string, boolean>) => void,
  ) => {
    versionGetterRef[1](() => getter);
    versionLoaderRef[1](() => loader);
    setVersionModalOpen(true);
  };

  // Ribbon version manager (constraints tab not active — open modal with no-op fallback)
  const handleRibbonVersionManager = () => setVersionModalOpen(true);

  const toggleExpand = (id: string) =>
    setExpandedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSelect = (id: string) => setSelectedId(prev => prev === id ? null : id);

  const handleSaveReady = async () => {
    if (!planId) return;
    try {
      await planApi.update(planId, { enabled_simulators: plan?.enabled_simulators });
      setPlanStatus('READY');
    } catch (e) { console.error('Failed to save plan', e); }
  };
  const handleLaunch = () => navigate(`/simulation/plan/${planId}/running`);

  const showViewport = ribbonTab === 'params';
  const handleTabChange = (t: RibbonTab) => setRibbonTab(t);

  return (
    <div className="flex flex-col h-full bg-[#07111e]">
      {/* ── Slim header ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#142235] flex-shrink-0 bg-[#07111e]">
        <button
          onClick={() => navigate('/simulation')}
          className="text-slate-600 hover:text-slate-300 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <span className="text-sm font-semibold text-slate-200">{plan?.plan_name ?? planId}</span>
          <span className={cn(
            'text-[10px] px-2 py-0.5 rounded-full border',
            isReady
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              : 'bg-slate-700/50 text-slate-400 border-slate-600',
          )}>
            {isReady ? '就绪' : '草稿'}
          </span>
          <span className="text-slate-700 text-xs">·</span>
          <span className="text-[11px] text-slate-600 font-mono">{planId}</span>
        </div>
        {/* Completeness indicators */}
        <div className="flex items-center gap-3 text-[10px] text-slate-600">
          {[
            { label: '输入', pct: 67 },
            { label: '参数', pct: 100 },
            { label: '约束', pct: 100 },
          ].map(({ label, pct }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span>{label}</span>
              <div className="w-14 h-1 bg-[#0a1929] rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', pct === 100 ? 'bg-emerald-500' : 'bg-blue-500')} style={{ width: `${pct}%` }} />
              </div>
              <span className={pct === 100 ? 'text-emerald-500' : ''}>{pct}%</span>
            </div>
          ))}
        </div>
        <Button variant="ghost" size="sm">
          <Save size={12} />保存
        </Button>
        {!isReady ? (
          <Button variant="primary" size="sm" onClick={handleSaveReady}>
            <CheckCircle2 size={12} />保存并就绪
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={handleLaunch}>
            <Play size={12} />启动仿真
          </Button>
        )}
      </div>

      {/* ── Ribbon ── */}
      <Ribbon activeTab={ribbonTab} onTabChange={handleTabChange} onOpenVersionManager={handleRibbonVersionManager} isReady={isReady} onLaunch={handleLaunch} />

      {/* ── Main area ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Params tab: viewport with floating panels ── */}
        {showViewport && (
          <div className="flex-1 overflow-hidden relative">
            <FactoryViewport selectedId={selectedId} onSelect={handleSelect} />
            <AssetTreePanel
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={handleSelect}
              onToggle={toggleExpand}
            />
            <FloatingParamsPanel selectedId={selectedId} onClear={() => setSelectedId(null)} />
          </div>
        )}

        {/* ── Input / Constraints tab: 3-column panel layout ── */}
        {ribbonTab === 'input' && (
          <div className="flex-1 overflow-hidden flex flex-col min-w-0">
            <DataTablePanel />
          </div>
        )}

        {ribbonTab === 'constraints' && (
          <div className="flex-1 overflow-hidden flex flex-col min-w-0">
            <ConstraintsPanel onOpenVersionManager={handleOpenVersionManager} />
          </div>
        )}
      </div>

      {/* ── Constraint Version Manager Modal ── */}
      {versionModalOpen && (
        <ConstraintVersionModal
          current={versionGetterRef[0] ? versionGetterRef[0]() : {}}
          onLoad={(cfg) => { versionLoaderRef[0]?.(cfg); }}
          onSave={() => {}}
          onClose={() => setVersionModalOpen(false)}
        />
      )}
    </div>
  );
}
