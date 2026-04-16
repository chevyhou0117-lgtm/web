import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ChevronLeft, FileBarChart, Brain, Box, Download, AlertTriangle, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine, PieChart, Pie,
} from 'recharts';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { planApi } from '@/lib/api';
import type { SimResultOut, LineBalanceOut, OperationLoadDetail } from '@/types/api';
import {
  deviceUtilizationData, productionOutputData, materialStockData, eventLogData,
} from '@/mock/data';

const RESULT_TABS = [
  { id: 'output', label: '生产产出总览' },
  { id: 'lbr', label: '产线平衡率' },
  { id: 'device', label: '设备利用率' },
  { id: 'material', label: '库存与物料' },
  { id: 'events', label: '事件日志' },
];

const pieData = [
  { name: 'A32X', value: 1842, fill: '#3b82f6' },
  { name: 'B15Y', value: 987, fill: '#06b6d4' },
  { name: 'C08Z', value: 621, fill: '#8b5cf6' },
  { name: 'D22W', value: 392, fill: '#10b981' },
];

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: unknown[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0b1d30] border border-[#1e3a55] rounded-xl px-3 py-2 text-xs shadow-xl">
      <div className="text-slate-400 mb-1">{label}</div>
      {(payload as Array<{ name: string; value: number; color: string }>).map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="text-slate-200 font-medium">{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

// Tab 1: Production Output
function OutputTab({ result }: { result: SimResultOut | null }) {
  const totalOutput = result?.total_output ?? 0;
  const outputPerHour = result?.output_per_hour ? Number(result.output_per_hour) : 0;
  const overallLbr = result?.overall_lbr ? (Number(result.overall_lbr) * 100).toFixed(1) : '—';
  const failureCount = result?.equipment_failure_count ?? 0;

  return (
    <div className="space-y-5">
      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: '总产出量', value: totalOutput.toLocaleString(), sub: `${outputPerHour.toFixed(0)} pcs/h`, status: totalOutput > 0 ? 'good' : 'warn', icon: <TrendingUp size={14} /> },
          { label: '综合LBR', value: `${overallLbr}%`, sub: overallLbr !== '—' && Number(overallLbr) < 85 ? '低于目标 85%' : '达标', status: overallLbr !== '—' && Number(overallLbr) >= 85 ? 'good' : 'warn', icon: Number(overallLbr) >= 85 ? <TrendingUp size={14} /> : <AlertTriangle size={14} /> },
          { label: '设备故障次数', value: String(failureCount), sub: failureCount === 0 ? '无故障' : 'has failures', status: failureCount === 0 ? 'good' : 'warn', icon: failureCount === 0 ? <TrendingUp size={14} /> : <AlertTriangle size={14} /> },
          { label: '瓶颈设备利用率', value: result?.bottleneck_utilization ? `${(Number(result.bottleneck_utilization) * 100).toFixed(1)}%` : '—', sub: 'Bottleneck equipment', status: 'good', icon: <TrendingUp size={14} /> },
        ].map(m => (
          <div key={m.label} className="bg-[#0a1929] border border-[#142235] rounded-xl p-4">
            <div className="text-[11px] text-slate-600 mb-1">{m.label}</div>
            <div className={cn('text-2xl font-bold',
              m.status === 'good' ? 'text-emerald-400' : m.status === 'warn' ? 'text-amber-400' : 'text-red-400'
            )}>{m.value}</div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              {m.icon}
              {m.sub}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Hourly Output */}
        <div className="col-span-2 bg-[#0a1929] border border-[#142235] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-300">各时段产出量</h3>
            <div className="flex items-center gap-2 text-[11px]">
              <div className="flex items-center gap-1"><div className="w-3 h-0.5 bg-blue-500 rounded" /><span className="text-slate-500">实际产出</span></div>
              <div className="flex items-center gap-1"><div className="w-3 h-0.5 bg-slate-600 rounded dashed" style={{borderTop:'2px dashed #475569',height:0}} /><span className="text-slate-500">计划产量</span></div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={productionOutputData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#142235" />
              <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="actual" fill="#3b82f6" radius={[3, 3, 0, 0]} name="实际产出" />
              <Line type="monotone" dataKey="plan" stroke="#475569" strokeDasharray="5 5" dot={false} name="计划产量" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Product Mix Pie */}
        <div className="bg-[#0a1929] border border-[#142235] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">产品型号分布</h3>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" paddingAngle={3}>
                {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Tooltip formatter={(v) => [`${v} pcs`]} contentStyle={{ background: '#0b1d30', border: '1px solid #1e3a55', borderRadius: 8, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {pieData.map(d => (
              <div key={d.name} className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.fill }} />
                <span className="text-slate-400 flex-1">{d.name}</span>
                <span className="text-slate-300 font-medium">{d.value} pcs</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Uncompleted Orders */}
      <div className="bg-[#0a1929] border border-[#142235] rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#142235]">
          <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
            <AlertTriangle size={13} /> 未完工工单分析（5条）
          </h3>
        </div>
        <table className="w-full text-xs">
          <thead className="text-[11px] text-slate-600">
            <tr className="border-b border-[#0e1e2e]">
              <th className="text-left px-5 py-2.5">工单号</th>
              <th className="text-left px-4 py-2.5">产品</th>
              <th className="text-left px-4 py-2.5">计划完工</th>
              <th className="text-left px-4 py-2.5">当前进度</th>
              <th className="text-left px-4 py-2.5">阻塞原因</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#0e1e2e]">
            {[
              ['WO-20260410-046', 'A32X', '19:00', '78%', '物料不足'],
              ['WO-20260410-048', 'B15Y', '19:30', '55%', '设备停机'],
              ['WO-20260410-050', 'C08Z', '20:00', '32%', '人力不足'],
            ].map(([id, prod, time, prog, reason]) => (
              <tr key={id} className="hover:bg-[#0d2035]/50 transition-colors">
                <td className="px-5 py-2.5 font-mono text-slate-400">{id}</td>
                <td className="px-4 py-2.5 text-slate-300">{prod}</td>
                <td className="px-4 py-2.5 text-slate-500">{time}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-[#142235] rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: prog }} />
                    </div>
                    <span className="text-amber-400 font-mono">{prog}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-red-400 flex items-center gap-1.5">
                  <AlertTriangle size={11} />{reason}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Tab 2: LBR — fed from real API data
function LBRTab({ lbResults }: { lbResults: LineBalanceOut[] }) {
  // Build operation load data from all line balance results
  const operationLoadData: Array<{ name: string; ct: number; takt: number; util: number; workers: number }> = [];
  let overallLbr = 0;
  let bottleneckName = '—';
  let bottleneckCt = 0;
  let bottleneckTakt = 0;

  for (const lb of lbResults) {
    overallLbr = Math.max(overallLbr, Number(lb.lbr));
    if (lb.operation_load_detail) {
      const details = Object.values(lb.operation_load_detail) as OperationLoadDetail[];
      for (const d of details) {
        const util = d.utilization * 100;
        operationLoadData.push({
          name: d.operation_name,
          ct: d.effective_ct,
          takt: Number(lb.takt_time),
          util: Math.round(util),
          workers: d.worker_count,
        });
        if (d.is_bottleneck) {
          bottleneckName = d.operation_name;
          bottleneckCt = d.effective_ct;
          bottleneckTakt = Number(lb.takt_time);
        }
      }
    }
  }
  const lbrPct = (overallLbr * 100).toFixed(1);

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className={cn("bg-[#0a1929] border rounded-xl p-4", Number(lbrPct) < 85 ? "border-amber-500/20" : "border-emerald-500/20")}>
          <div className="text-[11px] text-slate-600 mb-1">加权平均LBR</div>
          <div className={cn("text-3xl font-bold", Number(lbrPct) < 85 ? "text-amber-400" : "text-emerald-400")}>{lbrPct}%</div>
          <div className="text-[11px] text-amber-500 mt-1">{Number(lbrPct) < 85 ? `⚠ 低于目标值85%` : '✓ 达标'}</div>
        </div>
        <div className="bg-[#0a1929] border border-[#142235] rounded-xl p-4">
          <div className="text-[11px] text-slate-600 mb-1">产线数量</div>
          <div className="text-xl font-bold text-blue-400">{lbResults.length}</div>
          <div className="text-[11px] text-slate-600 mt-1">{operationLoadData.length} operations total</div>
        </div>
        <div className="bg-[#0a1929] border border-[#142235] rounded-xl p-4">
          <div className="text-[11px] text-slate-600 mb-1">主要瓶颈工序</div>
          <div className="text-xl font-bold text-red-400 truncate" title={bottleneckName}>{bottleneckName}</div>
          <div className="text-[11px] text-slate-600 mt-1">CT={bottleneckCt}s, Takt={bottleneckTakt.toFixed(1)}s</div>
        </div>
      </div>

      {/* Per-line LBR cards */}
      {lbResults.map(lb => (
        <div key={lb.lb_result_id} className="bg-[#0a1929] border border-[#142235] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-slate-300">Line {lb.line_id.slice(0, 8)}...</h4>
            <span className={cn("text-sm font-bold", Number(lb.lbr) * 100 < 85 ? "text-amber-400" : "text-emerald-400")}>
              LBR {(Number(lb.lbr) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="text-xs text-slate-500">
            Takt={Number(lb.takt_time).toFixed(1)}s · Bottleneck CT={Number(lb.bottleneck_ct).toFixed(1)}s · Balance Loss={( Number(lb.balance_loss_rate) * 100).toFixed(1)}%
          </div>
        </div>
      ))}

      {/* Operation Load Chart */}
      {operationLoadData.length > 0 && (
        <div className="bg-[#0a1929] border border-[#142235] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-300">工序负荷率（瓶颈识别）</h3>
            <div className="text-[11px] text-red-400 flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              红色为瓶颈工序（利用率 &gt;100%）
            </div>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(220, operationLoadData.length * 28)}>
            <BarChart data={operationLoadData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#142235" horizontal={false} />
              <XAxis type="number" domain={[0, 140]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={180} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine x={100} stroke="#ef4444" strokeDasharray="3 3" label={{ value: '100%', fill: '#ef4444', fontSize: 10 }} />
              <Bar dataKey="util" radius={[0, 3, 3, 0]} name="利用率%">
                {operationLoadData.map((entry, i) => (
                  <Cell key={i} fill={entry.util > 100 ? '#ef4444' : entry.util > 85 ? '#f59e0b' : '#3b82f6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// Tab 3: Device Utilization
function DeviceTab() {
  return (
    <div className="space-y-5">
      <div className="bg-[#0a1929] border border-[#142235] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-300">设备利用率总览</h3>
          <div className="flex items-center gap-4 text-[11px]">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-red-500" /><span className="text-slate-500">&gt;85% 过负荷</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-emerald-500" /><span className="text-slate-500">60~85% 正常</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-slate-600" /><span className="text-slate-500">&lt;60% 低利用</span></div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={deviceUtilizationData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#142235" />
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={85} stroke="#ef4444" strokeDasharray="3 3" />
            <Bar dataKey="util" radius={[3, 3, 0, 0]} name="利用率%">
              {deviceUtilizationData.map((d, i) => (
                <Cell key={i} fill={d.util > 85 ? '#ef4444' : d.util >= 60 ? '#10b981' : '#475569'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* OEE Table */}
      <div className="bg-[#0a1929] border border-[#142235] rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#142235]">
          <h3 className="text-sm font-semibold text-slate-300">OEE分解明细</h3>
        </div>
        <table className="w-full text-xs">
          <thead className="text-[11px] text-slate-600 bg-[#060e18]">
            <tr className="border-b border-[#0e1e2e]">
              <th className="text-left px-5 py-2.5">设备</th>
              <th className="text-left px-4 py-2.5">综合利用率</th>
              <th className="text-left px-4 py-2.5">可用率</th>
              <th className="text-left px-4 py-2.5">性能率</th>
              <th className="text-left px-4 py-2.5">质量率</th>
              <th className="text-left px-4 py-2.5">OEE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#0e1e2e]">
            {[
              ['SPI-L01', '91%', '93%', '96%', '98.5%', '88.0%', 'overload'],
              ['SMT-L01-01', '88%', '95%', '91%', '99.8%', '86.4%', 'overload'],
              ['SMT-L01-02', '85%', '89%', '94%', '99.6%', '83.5%', 'normal'],
              ['REFLOW-L01', '76%', '97%', '77%', '99.9%', '74.6%', 'normal'],
              ['AOI-L01', '55%', '98%', '55%', '100%', '53.9%', 'idle'],
            ].map(([name, util, avail, perf, qual, oee, status]) => (
              <tr key={name} className="hover:bg-[#0d2035]/50 transition-colors">
                <td className="px-5 py-2.5 text-slate-300 font-medium">{name}</td>
                <td className="px-4 py-2.5">
                  <span className={cn(
                    'text-xs font-bold',
                    status === 'overload' ? 'text-red-400' : status === 'normal' ? 'text-emerald-400' : 'text-slate-500'
                  )}>{util}</span>
                </td>
                <td className="px-4 py-2.5 text-slate-400">{avail}</td>
                <td className="px-4 py-2.5 text-slate-400">{perf}</td>
                <td className="px-4 py-2.5 text-slate-400">{qual}</td>
                <td className="px-4 py-2.5 text-cyan-400 font-semibold">{oee}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Tab 4: Material
function MaterialTab() {
  return (
    <div className="space-y-5">
      <div className="bg-[#0a1929] border border-[#142235] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">关键物料库存曲线</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={materialStockData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#142235" />
            <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="IC主控" stroke="#3b82f6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="电容0402" stroke="#06b6d4" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="连接器" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Material Shortage Events */}
      <div className="bg-[#0a1929] border border-[#142235] rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#142235]">
          <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
            <AlertTriangle size={13} /> 物料短缺事件（3次）
          </h3>
        </div>
        <table className="w-full text-xs">
          <thead className="text-[11px] text-slate-600">
            <tr className="border-b border-[#0e1e2e]">
              <th className="text-left px-5 py-2.5">物料</th>
              <th className="text-left px-4 py-2.5">短缺开始</th>
              <th className="text-left px-4 py-2.5">持续时长</th>
              <th className="text-left px-4 py-2.5">影响工单数</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#0e1e2e]">
            {[
              ['IC主控 (IC-12345)', 'T+04:30', '45 分钟', '3 条'],
              ['电容0402', 'T+07:15', '20 分钟', '1 条'],
              ['连接器', 'T+09:00', '90 分钟', '5 条'],
            ].map(([mat, start, dur, count]) => (
              <tr key={mat} className="hover:bg-[#0d2035]/50 transition-colors">
                <td className="px-5 py-2.5 text-slate-300">{mat}</td>
                <td className="px-4 py-2.5 font-mono text-slate-400">{start}</td>
                <td className="px-4 py-2.5 text-amber-400">{dur}</td>
                <td className="px-4 py-2.5 text-red-400">{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Tab 5: Event Log
function EventLogTab() {
  const [filter, setFilter] = useState('ALL');
  const filtered = filter === 'ALL' ? eventLogData : eventLogData.filter(e => e.type === filter);
  const types = ['ALL', ...Array.from(new Set(eventLogData.map(e => e.type)))];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {types.map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={cn(
              'px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all',
              filter === t ? 'bg-blue-600/20 text-blue-400 border-blue-500/30' : 'text-slate-500 border-transparent hover:bg-[#0b1d30]',
            )}
          >
            {t}
          </button>
        ))}
        <div className="flex-1" />
        <Button size="xs" variant="outline"><Download size={11} /> 导出CSV</Button>
      </div>

      <div className="bg-[#0a1929] border border-[#142235] rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="text-[11px] text-slate-600 bg-[#060e18]">
            <tr className="border-b border-[#0e1e2e]">
              <th className="text-left px-5 py-3">仿真时间</th>
              <th className="text-left px-4 py-3">事件类型</th>
              <th className="text-left px-4 py-3">级别</th>
              <th className="text-left px-4 py-3">对象</th>
              <th className="text-left px-4 py-3">事件详情</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#0e1e2e]">
            {filtered.map((evt, i) => (
              <tr key={i} className="hover:bg-[#0d2035]/50 transition-colors">
                <td className="px-5 py-2.5 font-mono text-slate-500">{evt.time}</td>
                <td className="px-4 py-2.5">
                  <span className="text-[11px] bg-[#0b1d30] border border-[#1e3a55] px-2 py-0.5 rounded text-slate-400">{evt.type}</span>
                </td>
                <td className="px-4 py-2.5">
                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded',
                    evt.level === 'INFO' ? 'bg-blue-500/15 text-blue-400' :
                    evt.level === 'WARN' ? 'bg-amber-500/15 text-amber-400' :
                    'bg-red-500/15 text-red-400'
                  )}>{evt.level}</span>
                </td>
                <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">{evt.obj}</td>
                <td className="px-4 py-2.5 text-slate-400">{evt.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ResultAnalysisPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('output');
  const [result, setResult] = useState<SimResultOut | null>(null);
  const [lbResults, setLbResults] = useState<LineBalanceOut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!planId) return;
    setLoading(true);
    Promise.all([
      planApi.result(planId).catch(() => null),
      planApi.lineBalance(planId).catch(() => []),
    ]).then(([res, lb]) => {
      setResult(res);
      setLbResults(lb);
    }).finally(() => setLoading(false));
  }, [planId]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-[#142235] flex-shrink-0">
        <button onClick={() => navigate('/simulation')} className="text-slate-600 hover:text-slate-300 transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-200">{result ? 'Simulation Result' : 'Loading...'}</h1>
            <span className={cn("text-[11px] px-2 py-0.5 rounded-full border",
              result?.computation_status === 'SUCCESS' ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-slate-500/20 text-slate-400 border-slate-500/30"
            )}>{result?.computation_status ?? '...'}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {result?.computation_start ? `Started: ${result.computation_start.slice(0,19).replace('T',' ')}` : ''}
            {result?.computation_end ? ` · Ended: ${result.computation_end.slice(0,19).replace('T',' ')}` : ''}
          </p>
        </div>
        <div className="flex-1" />
        <Button variant="secondary" size="sm" onClick={() => navigate(`/simulation/plan/${planId}/anomaly`)}>
          <AlertTriangle size={13} /> 异常注入
        </Button>
        <Button variant="secondary" size="sm" onClick={() => navigate(`/simulation/plan/${planId}/ai`)}>
          <Brain size={13} /> AI建议
        </Button>
        <Button variant="secondary" size="sm">
          <Box size={13} /> 3D回放
        </Button>
        <Button variant="primary" size="sm" onClick={() => navigate(`/simulation/plan/${planId}/export`)}>
          <Download size={13} /> 导出报表
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#142235] px-6 flex-shrink-0">
        {RESULT_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-5 py-3.5 text-xs font-medium transition-all border-b-2 -mb-px',
              activeTab === tab.id ? 'text-blue-400 border-blue-500' : 'text-slate-500 border-transparent hover:text-slate-300',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Alert Banner */}
        {activeTab === 'output' && result && Number(result.overall_lbr ?? 0) * 100 < 85 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 flex items-start gap-2 mb-5">
            <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-300">
              <span className="font-semibold">关键发现：</span>
              产线LBR={(Number(result.overall_lbr) * 100).toFixed(1)}%（低于目标85%）。建议查看「AI优化建议」。
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading results...
          </div>
        )}

        {!loading && activeTab === 'output' && <OutputTab result={result} />}
        {!loading && activeTab === 'lbr' && <LBRTab lbResults={lbResults} />}
        {activeTab === 'device' && <DeviceTab />}
        {activeTab === 'material' && <MaterialTab />}
        {activeTab === 'events' && <EventLogTab />}
      </div>
    </div>
  );
}
