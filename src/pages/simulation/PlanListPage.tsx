import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import {
  Plus, Search, Filter, Download, Archive, Trash2,
  PlayCircle, Eye, FileBarChart, MoreHorizontal, ChevronDown, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { planApi, masterApi, simulatorsToFrontend } from '@/lib/api';
import { STATUS_CONFIG, SIMULATOR_LABELS, type SimPlan, type PlanStatus } from '@/mock/data';
import type { PlanOut } from '@/types/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

/** Convert backend PlanOut to frontend SimPlan shape */
function toPlan(p: PlanOut): SimPlan {
  return {
    id: p.plan_id,
    name: p.plan_name,
    description: p.plan_description ?? undefined,
    simulators: simulatorsToFrontend(p.enabled_simulators) as SimPlan['simulators'],
    status: p.status as PlanStatus,
    timeRange: `${p.simulation_duration_hours}h`,
    creator: p.created_by,
    creatorId: '',
    lastRunTime: p.updated_at?.slice(0, 16).replace('T', ' ') ?? null,
    createdAt: p.created_at?.slice(0, 10) ?? '',
  };
}

function SimulatorTags({ simulators }: { simulators?: string[] }) {
  if (!simulators?.length) return <span className="text-[11px] text-slate-600">未配置</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {simulators.map(s => (
        <span key={s} className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', SIMULATOR_LABELS[s]?.cls ?? 'bg-slate-500/15 text-slate-400')}>
          {SIMULATOR_LABELS[s]?.label ?? s}
        </span>
      ))}
    </div>
  );
}

function NewPlanModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (name: string, desc: string) => void }) {
  const [name, setName] = useState(`仿真方案_${new Date().toISOString().slice(0,10).replace(/-/g,'')}`);
  const [desc, setDesc] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0b1d30] border border-[#1e3a55] rounded-2xl p-6 w-[440px] shadow-2xl">
        <h2 className="text-base font-semibold text-slate-200 mb-1">新建仿真方案</h2>
        <p className="text-xs text-slate-500 mb-5">填写名称后进入配置页，在配置页中选择模拟类型</p>
        <div className="space-y-4">
          <Input label="方案名称 *" value={name} onChange={e => setName(e.target.value)} placeholder="请输入方案名称" />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400 font-medium">备注（选填）</label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="说明本次仿真目的与背景"
              className="bg-[#07111e] border border-[#1e3a55] rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500/60 placeholder:text-slate-600 resize-none h-20"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!name.trim()} onClick={() => onConfirm(name.trim(), desc)}>
            确认，进入配置
          </Button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ title, warning, strong, onClose, onConfirm }: {
  title: string;
  warning: string;
  strong?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0b1d30] border border-[#1e3a55] rounded-2xl p-6 w-[420px] shadow-2xl">
        <h2 className="text-base font-semibold text-slate-200 mb-2">{title}</h2>
        <p className={cn('text-xs leading-relaxed', strong ? 'text-amber-300' : 'text-slate-400')}>
          {warning}
        </p>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button variant="danger" onClick={onConfirm}>确认删除</Button>
        </div>
      </div>
    </div>
  );
}

const STATUS_FILTER_OPTIONS: Array<{ label: string; value: PlanStatus | 'ALL' }> = [
  { label: '全部状态', value: 'ALL' },
  { label: '草稿', value: 'DRAFT' },
  { label: '就绪', value: 'READY' },
  { label: '运行中', value: 'RUNNING' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '已归档', value: 'ARCHIVED' },
];

export function PlanListPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<SimPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<PlanStatus | 'ALL'>('ALL');
  const [selected, setSelected] = useState<string[]>([]);
  const [factoryId, setFactoryId] = useState<string>('');
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const data = await planApi.list();
      setPlans(data.map(toPlan));
    } catch (e) {
      console.error('Failed to load plans', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
    masterApi.factories().then(fs => { if (fs.length) setFactoryId(fs[0].factory_id); });
  }, [loadPlans]);

  const filteredPlans = plans.filter(p => {
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
    if (searchText && !p.name.includes(searchText) && !p.creator.includes(searchText)) return false;
    return true;
  });

  const handleNewPlan = async (name: string, desc: string) => {
    if (!factoryId) return;
    try {
      const created = await planApi.create({
        plan_name: name,
        factory_id: factoryId,
        enabled_simulators: ['PRODUCTION', 'LINE_BALANCE'],
        simulation_duration_hours: 11,
        plan_description: desc || undefined,
        created_by: 'user',
      });
      setShowNewModal(false);
      navigate(`/simulation/plan/${created.plan_id}/config`);
    } catch (e) {
      console.error('Failed to create plan', e);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="p-6 space-y-5">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">仿真方案管理</h1>
          <p className="text-xs text-slate-500 mt-0.5">创建、配置和运行生产仿真方案，支持多方案对比分析</p>
        </div>
        <Button variant="primary" size="md" onClick={() => setShowNewModal(true)}>
          <Plus size={14} /> 新建方案
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: '全部方案', value: plans.length, color: 'text-slate-300' },
          { label: '草稿', value: plans.filter(p => p.status === 'DRAFT').length, color: 'text-slate-400' },
          { label: '就绪 / 运行中', value: plans.filter(p => ['READY','RUNNING'].includes(p.status)).length, color: 'text-blue-400' },
          { label: '已完成', value: plans.filter(p => p.status === 'COMPLETED').length, color: 'text-emerald-400' },
          { label: '已归档', value: plans.filter(p => p.status === 'ARCHIVED').length, color: 'text-purple-400' },
        ].map((s) => (
          <div key={s.label} className="bg-[#0b1d30] border border-[#142235] rounded-xl px-4 py-3">
            <div className={cn('text-2xl font-bold', s.color)}>{s.value}</div>
            <div className="text-[11px] text-slate-600 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="bg-[#0b1d30] border border-[#142235] rounded-xl px-5 py-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="搜索方案名称或创建人..."
              className="w-full bg-[#07111e] border border-[#1e3a55] rounded-lg pl-8 pr-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500/60 placeholder:text-slate-600"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            {STATUS_FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                  statusFilter === opt.value
                    ? 'bg-blue-600/20 text-blue-400 border-blue-500/30'
                    : 'text-slate-500 hover:text-slate-300 border-transparent hover:bg-[#0d2035]',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Bulk actions */}
          {selected.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">已选 {selected.length} 条</span>
              <Button size="xs" variant="ghost" onClick={async () => { await planApi.batchArchive(selected); setSelected([]); loadPlans(); }}>
                <Archive size={12} /> 批量归档
              </Button>
              <Button size="xs" variant="danger" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 size={12} /> 批量删除
              </Button>
            </div>
          )}

          <Button size="xs" variant="ghost">
            <Download size={12} /> 导出列表
          </Button>
          <Button size="xs" variant="ghost" onClick={loadPlans}>
            <RefreshCw size={12} />
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0b1d30] border border-[#142235] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#142235] bg-[#0a1929]">
              <th className="w-10 px-4 py-3">
                <input type="checkbox" className="rounded border-[#1e3a55] bg-[#07111e] accent-blue-500"
                  checked={filteredPlans.length > 0 && selected.length === filteredPlans.length}
                  onChange={() => setSelected(prev => prev.length === filteredPlans.length ? [] : filteredPlans.map(p => p.id))} />
              </th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">方案名称</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">模拟器</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">状态</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">仿真时间范围</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">创建人</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">最近运行</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#0e1e2e]">
            {filteredPlans.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-16 text-slate-600 text-sm">
                  {searchText || statusFilter !== 'ALL' ? '未找到符合条件的方案，请调整筛选条件' : '暂无仿真方案，点击「新建方案」开始您的第一次运营模拟'}
                </td>
              </tr>
            ) : (
              filteredPlans.map((plan) => {
                const sc = STATUS_CONFIG[plan.status];
                return (
                  <tr
                    key={plan.id}
                    className="hover:bg-[#0d2035]/50 transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(plan.id)}
                        onChange={() => toggleSelect(plan.id)}
                        className="rounded border-[#1e3a55] bg-[#07111e] accent-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(
                          plan.status === 'COMPLETED' || plan.status === 'ARCHIVED'
                            ? `/simulation/plan/${plan.id}/result`
                            : `/simulation/plan/${plan.id}/config`
                        )}
                        className="text-sm text-slate-200 hover:text-blue-400 transition-colors font-medium text-left"
                      >
                        {plan.name}
                      </button>
                      {plan.tags && plan.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {plan.tags.map(tag => (
                            <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-[#0a1929] rounded text-slate-600">{tag}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <SimulatorTags simulators={plan.simulators} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={sc.cls}
                        dot={sc.dot}
                        animated={plan.status === 'RUNNING'}
                      >
                        {sc.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{plan.timeRange}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      <span>{plan.creator}</span>
                      <span className="text-slate-600 ml-1">#{plan.creatorId}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {plan.lastRunTime ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <PlanActions plan={plan} navigate={navigate} onRefresh={loadPlans} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="border-t border-[#142235] px-5 py-3 flex items-center justify-between">
          <span className="text-[11px] text-slate-600">共 {filteredPlans.length} 条</span>
          <div className="flex items-center gap-1">
            {[1].map(p => (
              <button key={p} className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 text-xs font-medium">{p}</button>
            ))}
          </div>
        </div>
      </div>

      {showNewModal && (
        <NewPlanModal onClose={() => setShowNewModal(false)} onConfirm={handleNewPlan} />
      )}
      {bulkDeleteOpen && (() => {
        const selectedPlans = plans.filter(p => selected.includes(p.id));
        const completedCount = selectedPlans.filter(p => p.status === 'COMPLETED').length;
        const warning = completedCount > 0
          ? `已选 ${selected.length} 个方案，其中 ${completedCount} 个已完成仿真。删除将同步清除仿真结果、AI 分析、产线平衡结果、状态快照和归档版本，且无法恢复。确认继续？`
          : `确定删除已选的 ${selected.length} 个方案吗？此操作不可恢复。`;
        return (
          <DeleteConfirmModal
            title="批量删除方案"
            warning={warning}
            strong={completedCount > 0}
            onClose={() => setBulkDeleteOpen(false)}
            onConfirm={async () => {
              setBulkDeleteOpen(false);
              await planApi.batchDelete(selected);
              setSelected([]);
              loadPlans();
            }}
          />
        );
      })()}
    </div>
  );
}

function PlanActions({ plan, navigate, onRefresh }: { plan: SimPlan; navigate: ReturnType<typeof useNavigate>; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });

    const onClick = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('scroll', () => setOpen(false), true);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('scroll', () => setOpen(false), true);
    };
  }, [open]);

  const handleArchive = async () => { setOpen(false); await planApi.archive(plan.id); onRefresh(); };
  const handleCopy = async () => { setOpen(false); await planApi.copy(plan.id); onRefresh(); };
  const handleDelete = async () => { setConfirmOpen(false); await planApi.delete(plan.id); onRefresh(); };

  const isCompleted = plan.status === 'COMPLETED';
  const deleteWarning = isCompleted
    ? `方案「${plan.name}」已完成仿真。删除将同步清除仿真结果、AI 分析、产线平衡结果、状态快照和归档版本，且无法恢复。确认继续？`
    : `确定删除方案「${plan.name}」吗？此操作不可恢复。`;

  return (
    <div className="flex items-center gap-1">
      {plan.status === 'READY' && (
        <Button size="xs" variant="primary" onClick={() => navigate(`/simulation/plan/${plan.id}/running`)}>
          <PlayCircle size={11} /> 启动
        </Button>
      )}
      {(plan.status === 'COMPLETED' || plan.status === 'ARCHIVED') && (
        <Button size="xs" variant="secondary" onClick={() => navigate(`/simulation/plan/${plan.id}/result`)}>
          <Eye size={11} /> 查看
        </Button>
      )}
      {(plan.status === 'DRAFT' || plan.status === 'READY') && (
        <Button size="xs" variant="secondary" onClick={() => navigate(`/simulation/plan/${plan.id}/config`)}>
          配置
        </Button>
      )}
      {plan.status === 'RUNNING' && (
        <Button size="xs" variant="secondary" onClick={() => navigate(`/simulation/plan/${plan.id}/running`)}>
          监控
        </Button>
      )}
      {(plan.status === 'COMPLETED' || plan.status === 'ARCHIVED') && (
        <Button size="xs" variant="secondary" onClick={() => navigate(`/simulation/plan/${plan.id}/export`)}>
          <FileBarChart size={11} /> 报表
        </Button>
      )}
      <Button ref={triggerRef} size="xs" variant="ghost" onClick={() => setOpen(!open)}>
        <MoreHorizontal size={12} />
      </Button>
      {open && menuPos && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuPos.top, right: menuPos.right }}
          className="z-50 bg-[#0b1d30] border border-[#1e3a55] rounded-xl shadow-xl w-36 py-1"
        >
          {['DRAFT','READY','COMPLETED'].includes(plan.status) && (
            <button onClick={handleArchive} className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-[#0d2035] flex items-center gap-2">
              <Archive size={12} /> 归档
            </button>
          )}
          <button onClick={handleCopy} className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-[#0d2035] flex items-center gap-2">
            复制方案
          </button>
          {plan.status !== 'RUNNING' && plan.status !== 'ARCHIVED' && (
            <button onClick={() => { setOpen(false); setConfirmOpen(true); }} className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-[#0d2035] flex items-center gap-2">
              <Trash2 size={12} /> 删除
            </button>
          )}
        </div>,
        document.body,
      )}
      {confirmOpen && (
        <DeleteConfirmModal
          title="删除方案"
          warning={deleteWarning}
          strong={isCompleted}
          onClose={() => setConfirmOpen(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
