import { useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { smtCapacityData } from '@/mock/data';
import { BarChart3, Info, Download } from 'lucide-react';

export function SMTCapacityPage() {
  const [placementRate, setPlacementRate] = useState(35);
  const [lineCount, setLineCount] = useState(4);

  const adjustedData = smtCapacityData.map(d => ({
    ...d,
    capacity: Math.round(d.capacity * (placementRate / 35) * (lineCount / 4)),
    util: Math.round((d.demand / (d.capacity * (placementRate / 35) * (lineCount / 4))) * 100),
    gap: Math.round(d.demand - d.capacity * (placementRate / 35) * (lineCount / 4)),
  }));

  const criticalMonths = adjustedData.filter(d => d.util >= 100).length;
  const maxUtil = Math.max(...adjustedData.map(d => d.util));

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">SMT产能规划分析</h1>
          <p className="text-xs text-slate-500 mt-0.5">基于BOM与产线置件能力，静态推算各期置件点数需求与有效产能，计算产能缺口</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">运行分析</Button>
          <Button variant="outline" size="sm"><Download size={13} /> 导出报告</Button>
        </div>
      </div>

      {/* Input Parameters */}
      <div className="bg-[#0b1d30] border border-[#142235] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">需求与产能参数</h3>
        <div className="grid grid-cols-5 gap-4">
          <Select label="时间粒度">
            <option>月度（最多24期）</option>
            <option>周度（最多52期）</option>
          </Select>
          <Input label="现有SMT产线数量" type="number" value={lineCount} onChange={e => setLineCount(Number(e.target.value))} />
          <Input label="产线置件能力 PPH（点/小时）" type="number" defaultValue="45000" />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400 font-medium flex items-center gap-1">
              置件率（%）
              <span title="综合考虑换料停机、换线准备、设备故障等非纯贴装时间折算系数，典型值33-35%" className="cursor-help">
                <Info size={11} className="text-slate-600" />
              </span>
            </label>
            <input
              type="range" min="25" max="45" value={placementRate}
              onChange={e => setPlacementRate(Number(e.target.value))}
              className="accent-blue-500 cursor-pointer mt-2"
            />
            <div className="text-xs text-blue-400 font-bold text-center">{placementRate}%</div>
          </div>
          <Select label="产品选择">
            <option>全部产品</option>
            <option>A32X</option>
            <option>B15Y</option>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: '产能超载月份', value: criticalMonths.toString(), unit: '个月', color: criticalMonths > 0 ? 'text-red-400' : 'text-emerald-400' },
          { label: '最高利用率', value: `${maxUtil}%`, unit: '', color: maxUtil >= 100 ? 'text-red-400' : maxUtil >= 90 ? 'text-amber-400' : 'text-emerald-400' },
          { label: '年度需求点数', value: `${(adjustedData.reduce((s, d) => s + d.demand, 0) / 1e6).toFixed(1)}M`, unit: '点', color: 'text-slate-200' },
          { label: '当前年产能', value: `${(adjustedData.reduce((s, d) => s + d.capacity, 0) / 1e6).toFixed(1)}M`, unit: '点', color: 'text-cyan-400' },
        ].map(m => (
          <div key={m.label} className="bg-[#0b1d30] border border-[#142235] rounded-xl p-4">
            <div className="text-[11px] text-slate-600 mb-1">{m.label}</div>
            <div className={cn('text-2xl font-bold', m.color)}>{m.value}<span className="text-sm font-normal text-slate-500 ml-1">{m.unit}</span></div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-5">
        {/* Demand vs Capacity */}
        <div className="bg-[#0b1d30] border border-[#142235] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">各期需求量 vs 有效产能（万点）</h3>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={adjustedData.slice(0, 12)} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#142235" />
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => v.slice(5)} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => `${(v/10000).toFixed(0)}w`} />
              <Tooltip
                formatter={(v: number) => [`${(v / 10000).toFixed(0)}万点`]}
                contentStyle={{ background: '#0b1d30', border: '1px solid #1e3a55', borderRadius: 8, fontSize: 11 }}
              />
              <Bar dataKey="demand" fill="#3b82f6" radius={[3, 3, 0, 0]} name="需求点数" />
              <Line type="monotone" dataKey="capacity" stroke="#10b981" strokeWidth={2} dot={false} name="有效产能" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Utilization */}
        <div className="bg-[#0b1d30] border border-[#142235] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">产能利用率趋势（%）</h3>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={adjustedData.slice(0, 12)} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#142235" />
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => v.slice(5)} />
              <YAxis domain={[0, 150]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number) => [`${v}%`]}
                contentStyle={{ background: '#0b1d30', border: '1px solid #1e3a55', borderRadius: 8, fontSize: 11 }}
              />
              <ReferenceLine y={100} stroke="#ef4444" strokeDasharray="3 3" label={{ value: '满载', fill: '#ef4444', fontSize: 10 }} />
              <ReferenceLine y={90} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: '预警', fill: '#f59e0b', fontSize: 10 }} />
              <Bar dataKey="util" radius={[3, 3, 0, 0]} name="利用率%">
                {adjustedData.slice(0, 12).map((d, i) => (
                  <Cell key={i} fill={d.util >= 100 ? '#ef4444' : d.util >= 90 ? '#f59e0b' : '#10b981'} />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detail Table */}
      <div className="bg-[#0b1d30] border border-[#142235] rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#142235]">
          <h3 className="text-sm font-semibold text-slate-300">逐期明细</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#0a1929] text-[11px] text-slate-600">
              <tr className="border-b border-[#0e1e2e]">
                <th className="text-left px-5 py-3">期次</th>
                <th className="text-right px-4 py-3">需求点数（万）</th>
                <th className="text-right px-4 py-3">有效产能（万）</th>
                <th className="text-right px-4 py-3">差异点数（万）</th>
                <th className="text-right px-4 py-3">差异线体数</th>
                <th className="text-right px-4 py-3">利用率</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#0e1e2e]">
              {adjustedData.map(d => {
                const gapLines = Math.ceil(Math.abs(d.gap) / (d.capacity / lineCount));
                return (
                  <tr key={d.month} className={cn('hover:bg-[#0d2035]/50 transition-colors', d.util >= 100 && 'bg-red-500/5')}>
                    <td className="px-5 py-2.5 text-slate-300 font-medium">{d.month}</td>
                    <td className="px-4 py-2.5 text-right text-slate-400">{(d.demand/10000).toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-400">{(d.capacity/10000).toFixed(1)}</td>
                    <td className={cn('px-4 py-2.5 text-right font-medium', d.gap > 0 ? 'text-red-400' : 'text-emerald-400')}>
                      {d.gap > 0 ? '+' : ''}{(d.gap/10000).toFixed(1)}
                    </td>
                    <td className={cn('px-4 py-2.5 text-right font-bold', d.gap > 0 ? 'text-red-400' : 'text-emerald-400')}>
                      {d.gap > 0 ? `+${gapLines}` : gapLines > 0 ? `-${gapLines}` : '平衡'}
                    </td>
                    <td className={cn('px-4 py-2.5 text-right font-bold',
                      d.util >= 100 ? 'text-red-400' : d.util >= 90 ? 'text-amber-400' : 'text-emerald-400',
                    )}>
                      {d.util}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
