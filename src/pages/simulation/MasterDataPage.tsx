import { useState } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, Clock, Database, Factory, Cpu, GitBranch, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { masterDataStats } from '@/mock/data';

const DATA_CATEGORIES = [
  { id: 'factory', icon: <Factory size={15} />, label: '工厂信息', count: 1, status: 'synced', lastSync: '08:30:00' },
  { id: 'lines', icon: <GitBranch size={15} />, label: '产线数据', count: 8, status: 'synced', lastSync: '08:30:01' },
  { id: 'equipment', icon: <Cpu size={15} />, label: '设备/工位', count: 64, status: 'synced', lastSync: '08:30:03' },
  { id: 'bop', icon: <Database size={15} />, label: 'BOP工艺路线', count: 23, status: 'synced', lastSync: '08:30:05' },
  { id: 'calendar', icon: <Calendar size={15} />, label: '工作日历', count: 4, status: 'synced', lastSync: '08:30:06' },
  { id: 'staffing', icon: <Factory size={15} />, label: '人员配置', count: 12, status: 'warn', lastSync: '2天前' },
];

export function MasterDataPage() {
  const [syncing, setSyncing] = useState(false);

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => setSyncing(false), 2000);
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">基础数据管理</h1>
          <p className="text-xs text-slate-500 mt-0.5">从主数据平台同步工厂建模数据，版本检测与本地缓存管理</p>
        </div>
        <Button variant="primary" size="sm" onClick={handleSync} disabled={syncing}>
          <RefreshCw size={13} className={cn(syncing && 'animate-spin')} />
          {syncing ? '同步中...' : '手动触发同步'}
        </Button>
      </div>

      {/* Status Banner */}
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-5 py-4 flex items-center gap-4">
        <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
        <div>
          <div className="text-sm font-semibold text-emerald-300">主数据已同步 · 状态正常</div>
          <div className="text-xs text-slate-500 mt-0.5">最近同步时间: 2026-04-10 08:30:00 · 数据版本: v1.2.8</div>
        </div>
        <div className="flex-1" />
        <div className="text-[11px] text-slate-500 flex items-center gap-1">
          <Clock size={11} /> 下次自动同步: 约 6 小时后
        </div>
      </div>

      {/* Data Category Cards */}
      <div className="grid grid-cols-3 gap-4">
        {DATA_CATEGORIES.map(cat => (
          <div key={cat.id} className="bg-[#0b1d30] border border-[#142235] rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center',
                cat.status === 'synced' ? 'bg-blue-600/10 text-blue-400' : 'bg-amber-600/10 text-amber-400',
              )}>
                {cat.icon}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-300">{cat.label}</div>
                <div className="text-[11px] text-slate-500">{cat.count} 条记录</div>
              </div>
              <div className="ml-auto">
                {cat.status === 'synced' ? (
                  <CheckCircle2 size={14} className="text-emerald-400" />
                ) : (
                  <AlertCircle size={14} className="text-amber-400" />
                )}
              </div>
            </div>
            <div className="text-[11px] text-slate-600 flex items-center gap-1">
              <Clock size={10} /> 最近同步: {cat.lastSync}
            </div>
            {cat.status === 'warn' && (
              <div className="mt-2 text-[11px] text-amber-400 flex items-center gap-1">
                <AlertCircle size={11} /> 数据可能已过期，建议更新
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Data Preview Table */}
      <div className="bg-[#0b1d30] border border-[#142235] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#142235] flex items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-300">产线数据预览</h3>
          <span className="text-xs text-slate-500">仅展示，不可编辑（来自主数据平台）</span>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-[#0a1929] text-[11px] text-slate-600">
            <tr className="border-b border-[#0e1e2e]">
              <th className="text-left px-5 py-3">产线ID</th>
              <th className="text-left px-4 py-3">产线名称</th>
              <th className="text-left px-4 py-3">制程类型</th>
              <th className="text-left px-4 py-3">工序数</th>
              <th className="text-left px-4 py-3">设备数</th>
              <th className="text-left px-4 py-3">SMT PPH</th>
              <th className="text-left px-4 py-3">BOP状态</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#0e1e2e]">
            {[
              ['L01', 'SMT产线 L01', 'SMT', '7', '9', '45,000', '已激活'],
              ['L02', 'SMT产线 L02', 'SMT', '7', '9', '42,000', '已激活'],
              ['L03', 'SMT产线 L03', 'SMT', '7', '8', '38,000', '已激活'],
              ['T01', 'THT产线 T01', 'THT', '5', '7', '—', '已激活'],
              ['T02', 'THT产线 T02', 'THT', '5', '6', '—', '草稿'],
              ['Q01', '测试产线 Q01', '测试', '4', '5', '—', '已激活'],
            ].map(([id, name, type, ops, eqs, pph, bop]) => (
              <tr key={id} className="hover:bg-[#0d2035]/50 transition-colors">
                <td className="px-5 py-2.5 font-mono text-slate-400">{id}</td>
                <td className="px-4 py-2.5 text-slate-300 font-medium">{name}</td>
                <td className="px-4 py-2.5">
                  <span className={cn('text-[11px] px-1.5 py-0.5 rounded font-medium',
                    type === 'SMT' ? 'bg-blue-500/15 text-blue-400' :
                    type === 'THT' ? 'bg-purple-500/15 text-purple-400' :
                    'bg-slate-500/15 text-slate-400',
                  )}>{type}</span>
                </td>
                <td className="px-4 py-2.5 text-slate-400">{ops}</td>
                <td className="px-4 py-2.5 text-slate-400">{eqs}</td>
                <td className="px-4 py-2.5 font-mono text-cyan-400">{pph}</td>
                <td className="px-4 py-2.5">
                  <span className={cn('text-[11px] px-1.5 py-0.5 rounded font-medium',
                    bop === '已激活' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400',
                  )}>{bop}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sync History */}
      <div className="bg-[#0b1d30] border border-[#142235] rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#142235]">
          <h3 className="text-sm font-semibold text-slate-300">同步历史</h3>
        </div>
        <div className="divide-y divide-[#0e1e2e]">
          {[
            { time: '2026-04-10 08:30:00', by: '系统自动', result: '成功', changes: '更新 3 条设备参数', version: 'v1.2.8' },
            { time: '2026-04-09 20:30:00', by: '系统自动', result: '成功', changes: '无变更', version: 'v1.2.7' },
            { time: '2026-04-09 08:31:22', by: '李明', result: '成功', changes: '新增 2 条BOP', version: 'v1.2.7' },
            { time: '2026-04-08 15:20:00', by: '系统自动', result: '失败', changes: '接口超时', version: 'v1.2.6' },
          ].map((h, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3">
              <div className="w-32 text-[11px] font-mono text-slate-600">{h.time}</div>
              <div className={cn(
                'w-14 text-[11px] font-medium',
                h.result === '成功' ? 'text-emerald-400' : 'text-red-400',
              )}>{h.result}</div>
              <div className="text-xs text-slate-400 flex-1">{h.changes}</div>
              <div className="text-[11px] text-slate-600">{h.by}</div>
              <div className="font-mono text-[11px] text-slate-600 bg-[#0a1929] px-1.5 py-0.5 rounded">{h.version}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
