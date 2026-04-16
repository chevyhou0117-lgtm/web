import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  XCircle, AlertCircle, CheckCircle2, Loader2, ChevronLeft,
  ChevronDown, ChevronRight, Building2, Cpu, Truck, Layers,
  Sliders, RefreshCw, FileText, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { planApi } from '@/lib/api';

// ── Shared helpers (mirrors PlanConfigPage) ────────────────────────────────────
function formatSimTime(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.floor(totalMinutes % 60);
  const s = Math.floor((totalMinutes * 60) % 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

const TIMELINE_EVENTS = [
  { hourOffset: 0.08,  label: '投产',    color: '#3b82f6' },
  { hourOffset: 1.37,  label: '物料预警', color: '#f59e0b' },
  { hourOffset: 3.25,  label: '设备故障', color: '#ef4444' },
  { hourOffset: 5.0,   label: '换线',    color: '#8b5cf6' },
  { hourOffset: 5.83,  label: '完工',    color: '#10b981' },
];

type NodeType   = 'factory' | 'group' | 'line' | 'operation' | 'agv';
type NodeStatus = 'normal' | 'bottleneck' | 'idle' | 'warning';

interface RunTreeNode {
  id: string; label: string; type: NodeType; status?: NodeStatus;
  sublabel?: string; children?: RunTreeNode[];
}

const RUN_TREE: RunTreeNode[] = [
  {
    id: 'factory', label: 'Houston P9', type: 'factory',
    children: [
      {
        id: 'lines', label: '参与产线', type: 'group',
        children: [
          {
            id: 'L01', label: 'SMT产线 L01', type: 'line', status: 'warning',
            children: [
              { id: 'L01-SPI',    label: '锡膏印刷', sublabel: 'SPI-L01',    type: 'operation', status: 'normal'     },
              { id: 'L01-SMT1',   label: '贴片(前)', sublabel: 'SMT-L01-01', type: 'operation', status: 'bottleneck' },
              { id: 'L01-SMT2',   label: '贴片(后)', sublabel: 'SMT-L01-02', type: 'operation', status: 'bottleneck' },
              { id: 'L01-REFLOW', label: '回流焊',   sublabel: 'REFLOW-L01', type: 'operation', status: 'normal'     },
              { id: 'L01-AOI',    label: 'AOI检测',  sublabel: 'AOI-L01',    type: 'operation', status: 'idle'       },
            ],
          },
          {
            id: 'L02', label: 'SMT产线 L02', type: 'line', status: 'normal',
            children: [
              { id: 'L02-SPI',  label: '锡膏印刷', sublabel: 'SPI-L02',    type: 'operation', status: 'normal' },
              { id: 'L02-SMT1', label: '贴片',     sublabel: 'SMT-L02-01', type: 'operation', status: 'normal' },
              { id: 'L02-AOI',  label: 'AOI检测',  sublabel: 'AOI-L02',    type: 'operation', status: 'normal' },
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
    ],
  },
];

const VIEWPORT_LINES = [
  {
    id: 'L01', label: 'SMT产线 L01',
    machines: [
      { id: 'L01-SPI',    label: 'SPI印刷', status: 'normal'     as NodeStatus, baseCt: 32 },
      { id: 'L01-SMT1',   label: '贴片(前)', status: 'bottleneck' as NodeStatus, baseCt: 48 },
      { id: 'L01-SMT2',   label: '贴片(后)', status: 'bottleneck' as NodeStatus, baseCt: 45 },
      { id: 'L01-REFLOW', label: '回流焊',   status: 'normal'     as NodeStatus, baseCt: 38 },
      { id: 'L01-AOI',    label: 'AOI检测',  status: 'idle'       as NodeStatus, baseCt: 28 },
    ],
  },
  {
    id: 'L02', label: 'SMT产线 L02',
    machines: [
      { id: 'L02-SPI',  label: 'SPI印刷', status: 'normal' as NodeStatus, baseCt: 30 },
      { id: 'L02-SMT1', label: '贴片',    status: 'normal' as NodeStatus, baseCt: 50 },
      { id: 'L02-AOI',  label: 'AOI检测', status: 'normal' as NodeStatus, baseCt: 25 },
    ],
  },
];

function machineStyle(status: NodeStatus | undefined, selected: boolean) {
  if (selected)                return { border: '#3b82f6', bg: '#0d2035ee', text: '#93c5fd', dot: '#3b82f6', glow: true  };
  if (status === 'bottleneck') return { border: '#ef4444', bg: '#1a0808ee', text: '#f87171', dot: '#ef4444', glow: false };
  if (status === 'idle')       return { border: '#243548', bg: '#080f18ee', text: '#64748b', dot: '#334155', glow: false };
  return                               { border: '#1e3a55', bg: '#071520ee', text: '#94a3b8', dot: '#22c55e', glow: false };
}

function findNode(nodes: RunTreeNode[], id: string): RunTreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) { const f = findNode(n.children, id); if (f) return f; }
  }
  return null;
}

// ── Running Asset Tree ─────────────────────────────────────────────────────────
function RunTreeItem({ node, depth, selectedId, expandedIds, onSelect, onToggle }: {
  node: RunTreeNode; depth: number;
  selectedId: string | null; expandedIds: string[];
  onSelect: (id: string) => void; onToggle: (id: string) => void;
}) {
  const expanded  = expandedIds.includes(node.id);
  const selected  = selectedId === node.id;
  const hasKids   = !!node.children?.length;
  const isGroup   = node.type === 'group';
  const isFactory = node.type === 'factory';

  const icon: Record<NodeType, React.ReactNode> = {
    factory:   <Building2 size={12} className="text-cyan-400 flex-shrink-0" />,
    group:     <Layers    size={11} className="text-slate-600 flex-shrink-0" />,
    line:      <Building2 size={11} className={cn('flex-shrink-0', node.status === 'warning' ? 'text-amber-400' : 'text-blue-400')} />,
    operation: <Cpu       size={11} className={cn('flex-shrink-0', node.status === 'bottleneck' ? 'text-red-400' : node.status === 'idle' ? 'text-slate-600' : 'text-emerald-400')} />,
    agv:       <Truck     size={11} className="text-violet-400 flex-shrink-0" />,
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
        {icon[node.type]}
        <span className="flex-1 truncate">{node.label}</span>
        {node.status === 'bottleneck' && <AlertCircle size={9} className="text-red-400 flex-shrink-0" />}
        {node.type === 'operation' && (
          <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0 ml-1 animate-pulse',
            node.status === 'bottleneck' ? 'bg-red-500' : node.status === 'idle' ? 'bg-slate-700' : 'bg-emerald-500',
          )} />
        )}
      </div>
      {hasKids && expanded && node.children!.map(c => (
        <RunTreeItem key={c.id} node={c} depth={depth + 1} selectedId={selectedId}
          expandedIds={expandedIds} onSelect={onSelect} onToggle={onToggle} />
      ))}
    </div>
  );
}

function RunningAssetPanel({ selectedId, expandedIds, onSelect, onToggle }: {
  selectedId: string | null; expandedIds: string[];
  onSelect: (id: string) => void; onToggle: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div
      className="absolute top-3 left-3 z-20 flex flex-col rounded-xl border border-[#1e3a55] bg-[#07111e]/92 backdrop-blur shadow-2xl transition-all overflow-hidden"
      style={{ width: collapsed ? 36 : 232, maxHeight: 'calc(100% - 80px)' }}
    >
      <div className="flex items-center gap-2 px-2.5 py-2 border-b border-[#142235] flex-shrink-0">
        <button onClick={() => setCollapsed(v => !v)} className="text-slate-500 hover:text-slate-200 transition-colors flex-shrink-0">
          <Layers size={13} />
        </button>
        {!collapsed && (
          <>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex-1">资产结构</span>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
            <button onClick={() => setCollapsed(true)} className="text-slate-700 hover:text-slate-400 transition-colors">
              <ChevronLeft size={12} />
            </button>
          </>
        )}
      </div>
      {!collapsed && (
        <div className="flex-1 overflow-y-auto py-1 px-1 min-h-0">
          {RUN_TREE.map(node => (
            <RunTreeItem key={node.id} node={node} depth={0} selectedId={selectedId}
              expandedIds={expandedIds} onSelect={onSelect} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Running Metrics Panel (right, real-time, read-only) ────────────────────────
function RunningMetricsPanel({ selectedId, progress }: { selectedId: string | null; progress: number }) {
  const [collapsed, setCollapsed] = useState(false);
  const node = selectedId ? findNode(RUN_TREE, selectedId) : null;

  const lbr    = (72 + Math.sin(progress * 0.08) * 8).toFixed(1);
  const util   = (81 + Math.cos(progress * 0.05) * 5).toFixed(1);
  const output = Math.floor(progress * 18.5);
  const faults = Math.floor(progress * 0.02);

  const renderContent = () => {
    if (!node || node.type === 'group') {
      return <p className="text-[11px] text-slate-600 text-center py-4">点击资产树节点<br/>查看实时指标</p>;
    }

    if (node.type === 'factory') {
      return (
        <div className="space-y-2 p-3">
          {[
            { label: '累计产出',  value: output.toLocaleString(), unit: 'pcs', color: 'text-slate-200' },
            { label: '当前LBR',   value: lbr,   unit: '%',   color: Number(lbr) >= 85 ? 'text-emerald-400' : 'text-amber-400' },
            { label: '设备稼动率', value: util,  unit: '%',   color: 'text-cyan-400' },
            { label: '已触发异常', value: faults, unit: '条', color: faults > 0 ? 'text-amber-400' : 'text-slate-500' },
          ].map(m => (
            <div key={m.label} className="bg-[#0a1929] border border-[#142235] rounded-lg px-3 py-2.5">
              <div className="text-[10px] text-slate-600 mb-1">{m.label}</div>
              <div className={cn('text-lg font-bold font-mono', m.color)}>
                {m.value}<span className="text-xs font-normal text-slate-500 ml-0.5">{m.unit}</span>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (node.type === 'line') {
      const lineLbr = (Number(lbr) - 5 + Math.random() * 2).toFixed(1);
      return (
        <div className="space-y-2 p-3">
          <div className="text-[11px] text-slate-500 pb-1 border-b border-[#142235]">{node.label}</div>
          {[
            { label: '产线LBR',  value: lineLbr, unit: '%', color: Number(lineLbr) >= 85 ? 'text-emerald-400' : 'text-amber-400' },
            { label: 'Takt Time', value: '42', unit: 's', color: 'text-cyan-400' },
            { label: '瓶颈工序', value: node.id === 'L01' ? '贴片(前)' : '—', unit: '', color: 'text-red-400' },
            { label: '运行工序数', value: node.children?.filter(c => c.type === 'operation').length ?? 0, unit: '道', color: 'text-slate-300' },
          ].map(m => (
            <div key={m.label} className="bg-[#0a1929] border border-[#142235] rounded-lg px-3 py-2">
              <div className="text-[10px] text-slate-600 mb-0.5">{m.label}</div>
              <div className={cn('text-sm font-bold font-mono', m.color)}>
                {m.value}{m.unit && <span className="text-xs font-normal text-slate-500 ml-0.5">{m.unit}</span>}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (node.type === 'operation') {
      const baseCt = node.id.includes('SMT1') ? 48 : node.id.includes('SMT2') ? 45 : node.id.includes('SPI') ? 32 : node.id.includes('REFLOW') ? 38 : 28;
      const liveCt = (baseCt + Math.sin(progress * 0.15) * 2).toFixed(1);
      const takt = 42;
      const utilPct = Math.min(130, Math.round((Number(liveCt) / takt) * 100));
      const isBottleneck = node.status === 'bottleneck';
      return (
        <div className="space-y-2 p-3">
          <div className="text-[11px] text-slate-500 pb-1 border-b border-[#142235]">{node.label}</div>
          <div className="bg-[#0a1929] border border-[#142235] rounded-lg px-3 py-2.5">
            <div className="text-[10px] text-slate-600 mb-1">当前CT</div>
            <div className={cn('text-xl font-bold font-mono', isBottleneck ? 'text-red-400' : 'text-slate-200')}>
              {liveCt}<span className="text-xs font-normal text-slate-500 ml-0.5">s</span>
            </div>
            <div className="text-[10px] text-slate-600 mt-1">Takt: {takt}s</div>
          </div>
          <div className="bg-[#0a1929] border border-[#142235] rounded-lg px-3 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-slate-600">利用率</span>
              <span className={cn('text-[11px] font-mono font-semibold', utilPct > 100 ? 'text-red-400' : utilPct > 85 ? 'text-amber-400' : 'text-emerald-400')}>
                {utilPct}%
              </span>
            </div>
            <div className="h-1.5 bg-[#040d16] rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full transition-all', utilPct > 100 ? 'bg-red-500' : utilPct > 85 ? 'bg-amber-500' : 'bg-emerald-500')}
                style={{ width: `${Math.min(utilPct, 100)}%` }} />
            </div>
          </div>
          <div className={cn('rounded-lg px-3 py-2 text-[11px] font-medium flex items-center gap-1.5',
            node.status === 'bottleneck' ? 'bg-red-900/20 text-red-400' :
            node.status === 'idle'       ? 'bg-slate-800/50 text-slate-500' :
            'bg-emerald-900/15 text-emerald-400',
          )}>
            <div className={cn('w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0',
              node.status === 'bottleneck' ? 'bg-red-500' : node.status === 'idle' ? 'bg-slate-600' : 'bg-emerald-500',
            )} />
            {node.status === 'bottleneck' ? '瓶颈 · 持续占用' : node.status === 'idle' ? '低负荷运行' : '正常运行中'}
          </div>
        </div>
      );
    }

    if (node.type === 'agv') {
      return (
        <div className="p-3 space-y-2">
          <div className="text-[11px] text-slate-500 pb-1 border-b border-[#142235]">{node.label}</div>
          {[
            { label: '当前任务', value: '搬运 IC主控', color: 'text-violet-400' },
            { label: '已完成趟次', value: Math.floor(progress * 0.12), unit: '趟', color: 'text-slate-200' },
          ].map(m => (
            <div key={m.label} className="bg-[#0a1929] border border-[#142235] rounded-lg px-3 py-2">
              <div className="text-[10px] text-slate-600 mb-0.5">{m.label}</div>
              <div className={cn('text-sm font-semibold', m.color)}>
                {m.value}{'unit' in m && <span className="text-xs font-normal text-slate-500 ml-0.5">{m.unit}</span>}
              </div>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div
      className="absolute top-3 right-3 z-20 flex flex-col rounded-xl border border-[#1e3a55] bg-[#07111e]/92 backdrop-blur shadow-2xl transition-all overflow-hidden"
      style={{ width: collapsed ? 36 : 240, maxHeight: 'calc(100% - 80px)' }}
    >
      <div className="flex items-center gap-2 px-2.5 py-2 border-b border-[#142235] flex-shrink-0">
        <button onClick={() => setCollapsed(v => !v)} className="text-slate-500 hover:text-slate-200 transition-colors flex-shrink-0">
          <Sliders size={13} />
        </button>
        {!collapsed && (
          <>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex-1">实时指标</span>
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
          </>
        )}
      </div>
      {!collapsed && (
        <div className="flex-1 overflow-y-auto min-h-0">
          {renderContent()}
        </div>
      )}
    </div>
  );
}

// ── Read-only running timeline ─────────────────────────────────────────────────
function RunningTimeline({ progress, durationHours }: { progress: number; durationHours: number }) {
  const playheadPct = progress / 100;
  const durationMin = durationHours * 60;
  const currentMin  = playheadPct * durationMin;

  const wallLabel = (() => {
    const base = new Date('2026-04-10T08:00:00');
    base.setMinutes(base.getMinutes() + Math.round(currentMin));
    return `${base.getMonth()+1}/${base.getDate()} ${String(base.getHours()).padStart(2,'0')}:${String(base.getMinutes()).padStart(2,'0')}`;
  })();

  const endLabel = (() => {
    const e = new Date('2026-04-10T08:00:00');
    e.setHours(e.getHours() + durationHours);
    return `${e.getMonth()+1}/${e.getDate()} ${String(e.getHours()).padStart(2,'0')}:00`;
  })();

  const tickInterval = durationHours <= 12 ? 1 : durationHours <= 24 ? 2 : 6;
  const ticks: number[] = [];
  for (let h = 0; h <= durationHours; h += tickInterval) ticks.push(h);

  const shiftZones: Array<{ start: number; end: number }> = [];
  for (let d = 0; d * 24 < durationHours; d++) {
    shiftZones.push({ start: d * 24 + 8, end: Math.min(d * 24 + 20, durationHours) });
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 bg-[#020a12]/96 border-t border-[#1e3a55]/60 backdrop-blur-sm select-none">
      {/* Ruler */}
      <div className="relative h-5 mx-4 mt-1.5">
        <div className="absolute inset-y-0 left-0 right-0 rounded-sm bg-[#07111e] border border-[#142235]" />

        {shiftZones.map((z, i) => {
          const left  = (z.start / durationHours) * 100;
          const width = ((z.end - z.start) / durationHours) * 100;
          return <div key={i} className="absolute inset-y-0 bg-blue-500/10" style={{ left: `${left}%`, width: `${width}%` }} />;
        })}

        {/* Elapsed fill */}
        <div className="absolute inset-y-0 left-0 bg-blue-600/20 rounded-l-sm transition-all duration-300"
          style={{ width: `${playheadPct * 100}%` }} />

        {ticks.map(h => {
          const pct = (h / durationHours) * 100;
          if (pct > 100.1) return null;
          const isMajor = h % (tickInterval * 2) === 0 || durationHours <= 12;
          const wallH = (8 + h) % 24;
          const label = h > 0 && h % 24 === 0 ? `+${h/24}d` : `${String(wallH).padStart(2,'0')}:00`;
          return (
            <div key={h} className="absolute top-0 bottom-0 flex flex-col justify-start items-start" style={{ left: `${pct}%` }}>
              <div className={cn('w-px', isMajor ? 'h-2 bg-[#2a4a6a]' : 'h-1.5 bg-[#1a2e42]')} />
              {isMajor && <span className="text-[8px] font-mono text-slate-500 whitespace-nowrap" style={{ marginLeft: 2 }}>{label}</span>}
            </div>
          );
        })}

        {TIMELINE_EVENTS.map(ev => {
          const pct = (ev.hourOffset / durationHours) * 100;
          const isPast = (ev.hourOffset / durationHours) < playheadPct;
          if (pct > 100) return null;
          return (
            <div key={ev.label} className="absolute top-0 bottom-0 flex items-center group cursor-default" style={{ left: `${pct}%` }}>
              <div className="w-2 h-2 rotate-45 border flex-shrink-0 -translate-x-1/2 transition-opacity"
                style={{ background: ev.color + (isPast ? '66' : '33'), borderColor: ev.color, opacity: isPast ? 1 : 0.4 }} />
              <div className="hidden group-hover:flex absolute bottom-full mb-1.5 -translate-x-1/2 bg-[#0b1d30] border border-[#1e3a55] rounded px-2 py-1 flex-col items-center z-20 pointer-events-none" style={{ minWidth: 56 }}>
                <span className="text-[9px] font-medium whitespace-nowrap" style={{ color: ev.color }}>{ev.label}</span>
                <span className="text-[8px] font-mono text-slate-500">{formatSimTime(ev.hourOffset * 60)}</span>
              </div>
            </div>
          );
        })}

        {/* Playhead — not draggable, auto-advances */}
        <div className="absolute top-0 bottom-0 flex flex-col items-center z-10 transition-all duration-300"
          style={{ left: `${playheadPct * 100}%` }}>
          <div className="w-px flex-1 bg-white/80" />
          <div className="w-0 h-0 flex-shrink-0"
            style={{ borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '6px solid rgba(255,255,255,0.85)' }} />
        </div>
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-3 px-4 py-1.5">
        <div className="flex items-center gap-1.5 bg-[#040d16] border border-[#142235] rounded px-2.5 py-1 flex-shrink-0">
          <span className="text-[11px] font-mono text-slate-300 tracking-widest">{formatSimTime(currentMin)}</span>
          <span className="text-[9px] text-slate-700 mx-1">/</span>
          <span className="text-[9px] font-mono text-slate-600">{formatSimTime(durationMin)}</span>
        </div>
        <span className="text-[10px] font-mono text-slate-500">{wallLabel}</span>
        <div className="flex-1" />
        {/* LIVE indicator */}
        <div className="flex items-center gap-1.5 bg-red-600/15 border border-red-500/30 rounded px-2 py-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
          <span className="text-[9px] font-mono text-red-400 font-semibold">LIVE</span>
        </div>
        <span className="text-[9px] font-mono text-slate-600 flex-shrink-0">→ {endLabel}</span>
      </div>
    </div>
  );
}

// ── Log modal ──────────────────────────────────────────────────────────────────
const LOG_ENTRIES = [
  { time: '10:05:00', level: 'INFO',  mod: 'System',     msg: '仿真任务启动，基础数据快照 v1.2.8' },
  { time: '10:05:01', level: 'INFO',  mod: 'Loader',     msg: '正在加载工厂模型：烟台工厂，产线数: 6，设备数: 48' },
  { time: '10:05:03', level: 'INFO',  mod: 'Loader',     msg: 'BOP数据加载完成，共 23 个激活版本' },
  { time: '10:05:04', level: 'INFO',  mod: 'Loader',     msg: '工作日历加载完成，仿真区间: 2026-04-10 08:00 ~ 20:00' },
  { time: '10:05:05', level: 'INFO',  mod: 'DES',        msg: '离散事件仿真引擎初始化完成，事件队列容量: 100,000' },
  { time: '10:05:06', level: 'INFO',  mod: 'Scheduler',  msg: '工单 WO-20260410-001 开始投产，设备 SMT-L01-01，产品 A32X' },
  { time: '10:05:15', level: 'WARN',  mod: 'Material',   msg: '物料 IC主控 库存低于安全水位（剩余 200 pcs，安全库存 500 pcs）' },
  { time: '10:05:22', level: 'INFO',  mod: 'DES',        msg: '仿真时钟推进至 T+00:30:00，已处理事件: 1,230' },
  { time: '10:05:31', level: 'INFO',  mod: 'LineBalance', msg: 'LBR快照 T+01:00:00：产线L01 LBR=72.3%，瓶颈工序：贴片(前) CT=48s' },
  { time: '10:05:45', level: 'WARN',  mod: 'Device',     msg: '设备 SMT-L01-02 故障事件触发（MTBF随机），预计停机 45 分钟' },
  { time: '10:06:02', level: 'INFO',  mod: 'DES',        msg: '仿真时钟推进至 T+02:00:00，已处理事件: 5,847' },
  { time: '10:06:35', level: 'ERROR', mod: 'AGV',        msg: 'AGV 路径规划超时，使用默认搬运时间 5 分钟替代' },
];

function LogModal({ onClose, progress }: { onClose: () => void; progress: number }) {
  const visibleCount = Math.max(3, Math.floor((progress / 100) * LOG_ENTRIES.length));
  const visibleLogs  = LOG_ENTRIES.slice(0, visibleCount);
  const [filter, setFilter] = useState<string[]>(['INFO', 'WARN', 'ERROR']);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-8 bg-black/50 backdrop-blur-sm">
      <div className="bg-[#07111e] border border-[#1e3a55] rounded-2xl shadow-2xl w-[720px] max-h-[55vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#142235] flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-300">运行日志</span>
            <div className="flex items-center gap-1.5">
              {(['INFO','WARN','ERROR'] as const).map(level => (
                <button key={level} onClick={() => setFilter(prev => prev.includes(level) ? prev.filter(x => x !== level) : [...prev, level])}
                  className={cn('px-2 py-0.5 rounded text-[10px] font-semibold transition-all',
                    filter.includes(level)
                      ? level === 'INFO' ? 'bg-blue-600/20 text-blue-400' : level === 'WARN' ? 'bg-amber-600/20 text-amber-400' : 'bg-red-600/20 text-red-400'
                      : 'bg-[#0a1929] text-slate-600',
                  )}>{level}</button>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-300 transition-colors"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto font-mono text-[11px] space-y-0.5 bg-[#040d16] p-4">
          {visibleLogs.filter(l => filter.includes(l.level)).map((log, i) => (
            <div key={i} className="flex gap-3 hover:bg-[#0a1929]/50 px-1 py-0.5 rounded transition-colors">
              <span className="text-slate-700 flex-shrink-0 w-16">[{log.time}]</span>
              <span className={cn('font-bold flex-shrink-0 w-10', log.level === 'INFO' ? 'text-blue-500' : log.level === 'WARN' ? 'text-amber-500' : 'text-red-500')}>[{log.level}]</span>
              <span className="text-cyan-700 flex-shrink-0 w-24">[{log.mod}]</span>
              <span className="text-slate-400">{log.msg}</span>
            </div>
          ))}
          <div className="flex items-center gap-1 text-blue-500 mt-1"><span className="animate-pulse">▊</span></div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export function SimulationRunningPage() {
  const { planId }  = useParams();
  const navigate    = useNavigate();
  const [planName, setPlanName] = useState<string>(planId ?? '');

  const [progress, setProgress] = useState(0);
  const [elapsed,  setElapsed]  = useState(0);
  const [running,  setRunning]  = useState(true);

  const [selectedId,   setSelectedId]   = useState<string | null>('factory');
  const [expandedIds,  setExpandedIds]  = useState<string[]>(['factory', 'lines', 'L01', 'agv-group']);

  const [showLog,    setShowLog]    = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasTriggered = useRef(false);

  // Trigger simulation run on mount, then poll for status
  useEffect(() => {
    if (!planId || hasTriggered.current) return;
    hasTriggered.current = true;

    // Load plan name
    planApi.get(planId).then(p => setPlanName(p.plan_name)).catch(() => {});

    // Trigger the run
    planApi.run(planId).then(() => {
      // Start polling for status
      const poll = setInterval(async () => {
        try {
          const status = await planApi.runStatus(planId);
          if (status.computation_status === 'SUCCESS') {
            setProgress(100);
            setRunning(false);
            clearInterval(poll);
          } else if (status.computation_status === 'FAILED') {
            setProgress(100);
            setRunning(false);
            clearInterval(poll);
          }
        } catch {
          // keep polling
        }
      }, 1000);
      intervalRef.current = poll;

      // Also run a visual progress timer (since backend doesn't report %)
      const visual = setInterval(() => {
        setProgress(prev => {
          if (prev >= 95) { clearInterval(visual); return 95; } // Cap at 95 until real completion
          return prev + 2;
        });
        setElapsed(prev => prev + 1);
      }, 300);

      // Clean up visual timer when real completion happens
      return () => clearInterval(visual);
    }).catch(err => {
      console.error('Failed to start simulation:', err);
      // If already running or completed, just poll
      const poll = setInterval(async () => {
        try {
          const status = await planApi.runStatus(planId);
          if (status.computation_status === 'SUCCESS') {
            setProgress(100);
            setRunning(false);
            clearInterval(poll);
          } else if (status.computation_status === 'FAILED') {
            setRunning(false);
            clearInterval(poll);
          }
        } catch { /* ignore */ }
      }, 1000);
      intervalRef.current = poll;
    });

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [planId]);

  // Auto-navigate to result on completion
  useEffect(() => {
    if (progress >= 100) {
      const t = setTimeout(() => navigate(`/simulation/plan/${planId}/result`), 2000);
      return () => clearTimeout(t);
    }
  }, [progress, planId, navigate]);

  const handleBackToConfig = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    navigate(`/simulation/plan/${planId}/config`);
  };

  const handleCancelConfirm = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (planId) await planApi.cancel(planId).catch(() => {});
    navigate(`/simulation/plan/${planId}/config`);
  };

  const toggleExpand = (id: string) =>
    setExpandedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const formatElapsed = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;

  const simTime = `T+${String(Math.floor(progress * 0.12)).padStart(2,'0')}:${String(Math.floor((progress * 0.12 % 1) * 60)).padStart(2,'0')}:00`;

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#142235] bg-[#07111e] flex-shrink-0">
        <button
          onClick={handleBackToConfig}
          className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-200 transition-colors border border-[#1e3a55] hover:border-[#2a4a6a] rounded-lg px-2.5 py-1.5"
        >
          <ChevronLeft size={12} />返回配置
        </button>

        <div className="w-px h-4 bg-[#142235]" />

        <div className="flex items-center gap-2">
          {progress < 100
            ? <Loader2 size={14} className="text-amber-400 animate-spin" />
            : <CheckCircle2 size={14} className="text-emerald-400" />}
          <span className="text-sm font-bold text-slate-200">{planName}</span>
          <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium',
            progress >= 100 ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/15 text-amber-400 border-amber-500/30',
          )}>
            {progress >= 100 ? '已完成' : running ? '运行中' : '已暂停'}
          </span>
        </div>

        <div className="flex-1" />

        <span className="text-[11px] font-mono text-slate-500 flex-shrink-0">
          已用时 {formatElapsed(elapsed)} · 仿真时钟 {simTime}
        </span>
        <span className="text-[11px] font-mono text-slate-600">
          {progress.toFixed(1)}%
        </span>

        <Button size="sm" variant="ghost" onClick={() => setShowLog(true)}>
          <FileText size={13} /> 日志
        </Button>
        <Button size="sm" variant="danger" onClick={() => setShowCancel(true)}>
          <XCircle size={13} /> 取消仿真
        </Button>
      </div>

      {/* ── Body: factory viewport + floating panels + timeline ── */}
      <div className="flex-1 relative overflow-hidden bg-[#030c14]">
        {/* Factory background */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <img src="/images/Group 1664466895.png" alt="factory"
            className="w-full h-full object-contain"
            style={{ opacity: 0.18, filter: 'brightness(0.6) saturate(0)' }} />
        </div>
        <div className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(rgba(13,29,48,0.3) 1px,transparent 1px),linear-gradient(90deg,rgba(13,29,48,0.3) 1px,transparent 1px)',
            backgroundSize: '40px 40px',
          }} />

        {/* Watermark */}
        <div className="absolute top-2.5 left-3 text-[9px] font-mono text-slate-600 select-none pointer-events-none tracking-widest z-10">
          SIMULATION VIEWPORT · 烟台工厂 · SMT PRODUCTION
        </div>

        {/* Machine legend */}
        <div className="absolute top-2 right-3 flex items-center gap-2 z-10">
          {[
            { cls: 'bg-emerald-500 animate-pulse', label: '运行中' },
            { cls: 'bg-red-500',     label: '瓶颈' },
            { cls: 'bg-amber-500 animate-pulse', label: '故障' },
            { cls: 'bg-slate-600',   label: '低负荷' },
          ].map(({ cls, label }) => (
            <div key={label} className="flex items-center gap-1 bg-black/50 backdrop-blur border border-[#1e3a55]/50 px-2 py-0.5 rounded text-[9px] text-slate-400">
              <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', cls)} />
              {label}
            </div>
          ))}
        </div>

        {/* Production lines */}
        <div className="absolute inset-0 flex flex-col justify-center gap-8 px-8 pb-24 pt-12 z-10">
          {VIEWPORT_LINES.map(line => (
            <div key={line.id}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50 flex-shrink-0 animate-pulse" />
                <span className="text-[9px] font-mono text-blue-400/70 uppercase tracking-[0.15em] flex-shrink-0">{line.label}</span>
                <div className="flex-1 border-t border-dashed border-[#1e3a55]/60" />
              </div>
              <div className="flex items-stretch gap-0">
                {line.machines.map((machine, idx) => {
                  const st = machineStyle(machine.status, selectedId === machine.id);
                  const liveCt = (machine.baseCt + Math.sin((progress + idx * 20) * 0.1) * 1.5).toFixed(1);
                  return (
                    <div key={machine.id} className="flex items-center flex-1 min-w-0">
                      <div className="flex-1 min-w-0 cursor-pointer transition-all"
                        style={{ filter: st.glow ? 'drop-shadow(0 0 8px rgba(59,130,246,0.35))' : undefined }}
                        onClick={() => setSelectedId(machine.id)}>
                        <div className="rounded-lg px-2.5 pt-2.5 pb-2"
                          style={{ background: st.bg, border: `1px solid ${st.border}`, transition: 'all 0.15s' }}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] font-mono truncate pr-1" style={{ color: st.text }}>{machine.label}</span>
                            <div className={cn('w-2 h-2 rounded-full flex-shrink-0', machine.status === 'normal' || machine.status === undefined ? 'animate-pulse' : '')} style={{ background: st.dot }} />
                          </div>
                          <div className="text-[12px] font-bold font-mono leading-none" style={{ color: machine.status === 'bottleneck' ? '#f87171' : '#4a6070' }}>
                            {liveCt}s
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

        {/* Floating panels */}
        <RunningAssetPanel selectedId={selectedId} expandedIds={expandedIds}
          onSelect={setSelectedId} onToggle={toggleExpand} />
        <RunningMetricsPanel selectedId={selectedId} progress={progress} />

        {/* Read-only timeline */}
        <RunningTimeline progress={progress} durationHours={8} />
      </div>

      {/* ── Modals ── */}
      {showLog    && <LogModal onClose={() => setShowLog(false)} progress={progress} />}

      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#0b1d30] border border-[#1e3a55] rounded-2xl p-6 w-96 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-slate-200">确认取消仿真？</h3>
                <p className="text-xs text-slate-500 mt-1">取消后本次仿真结果将不保存，方案状态将回退至「就绪」状态。</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowCancel(false)}>继续仿真</Button>
              <Button variant="danger" size="sm" onClick={handleCancelConfirm}>确认取消</Button>
            </div>
          </div>
        </div>
      )}

      {progress >= 100 && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 text-sm font-medium z-30">
          <CheckCircle2 size={16} />
          仿真完成！正在跳转至结果分析页...
          <button onClick={() => navigate(`/simulation/plan/${planId}/result`)} className="underline text-xs">立即查看</button>
        </div>
      )}
    </div>
  );
}
