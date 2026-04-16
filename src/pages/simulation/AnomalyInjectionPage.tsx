import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ChevronLeft, Plus, Trash2, Edit2, AlertTriangle, Package, ToggleLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { planApi } from '@/lib/api';

interface AnomalyEvent {
  id: string;
  type: '设备故障' | '物料短缺';
  target: string;
  startOffset: string;
  duration: string;
  enabled: boolean;
  detail?: string;
}

const MOCK_EVENTS: AnomalyEvent[] = [
  { id: 'EVT-001', type: '设备故障', target: 'SMT-L01-02 (贴片机)', startOffset: 'T+3h', duration: '45 分钟', enabled: true, detail: '计划停机维保' },
  { id: 'EVT-002', type: '物料短缺', target: 'IC主控 (IC-12345)', startOffset: 'T+5h', duration: '2 小时', enabled: true, detail: '供应商延迟到货风险' },
  { id: 'EVT-003', type: '设备故障', target: 'REFLOW-L02 (回流焊)', startOffset: 'T+7h 30min', duration: '30 分钟', enabled: false, detail: '' },
];

function AddEventModal({ onClose }: { onClose: () => void }) {
  const [eventType, setEventType] = useState<'设备故障' | '物料短缺'>('设备故障');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0b1d30] border border-[#1e3a55] rounded-2xl p-6 w-[500px] shadow-2xl">
        <h2 className="text-base font-semibold text-slate-200 mb-5">添加异常事件</h2>
        <div className="space-y-4">
          {/* Event Type */}
          <div>
            <div className="text-xs text-slate-400 font-medium mb-2">事件类型 *</div>
            <div className="flex gap-3">
              {['设备故障', '物料短缺'].map(t => (
                <button
                  key={t}
                  onClick={() => setEventType(t as '设备故障' | '物料短缺')}
                  className={cn(
                    'flex-1 flex items-center gap-2 px-4 py-3 rounded-xl border text-sm transition-all',
                    eventType === t
                      ? 'bg-red-500/10 border-red-500/30 text-red-400'
                      : 'border-[#142235] text-slate-500 hover:border-[#1e3a55]',
                  )}
                >
                  {t === '设备故障' ? <AlertTriangle size={14} /> : <Package size={14} />}
                  {t}
                </button>
              ))}
            </div>
          </div>

          {eventType === '设备故障' ? (
            <>
              <Select label="故障设备 *">
                <option>SMT-L01-01 (贴片机前)</option>
                <option>SMT-L01-02 (贴片机后)</option>
                <option>SPI-L01 (锡膏印刷机)</option>
                <option>REFLOW-L01 (回流焊)</option>
                <option>AOI-L01 (AOI检测)</option>
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <Input label="故障开始偏移 *" placeholder="如 T+3h 或 T+1d 2h" defaultValue="T+3h" />
                <Input label="故障持续时长（分钟）*" type="number" defaultValue="45" />
              </div>
              <Select label="故障类型">
                <option>完全停机</option>
                <option>降速运行（需填写降速比例）</option>
              </Select>
            </>
          ) : (
            <>
              <Select label="短缺物料 *">
                <option>IC主控 (IC-12345)</option>
                <option>电容0402 (CAP-0402-100N)</option>
                <option>连接器 (CON-USB-B)</option>
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <Input label="短缺开始偏移 *" placeholder="如 T+5h" defaultValue="T+5h" />
                <Input label="短缺持续时长（分钟）*" type="number" defaultValue="120" />
              </div>
              <div>
                <div className="text-xs text-slate-400 font-medium mb-2">短缺程度 *</div>
                <div className="flex gap-3">
                  <button className="flex-1 px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-xs text-red-400">完全断供</button>
                  <button className="flex-1 px-3 py-2 rounded-lg border border-[#142235] text-xs text-slate-500 hover:border-[#1e3a55]">部分短缺</button>
                </div>
              </div>
            </>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400 font-medium">事件说明</label>
            <input placeholder="记录原因或场景背景（选填）" className="bg-[#07111e] border border-[#1e3a55] rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500/60 placeholder:text-slate-600" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button variant="primary" onClick={onClose}>保存事件</Button>
        </div>
      </div>
    </div>
  );
}

export function AnomalyInjectionPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [events, setEvents] = useState(MOCK_EVENTS);
  const [showModal, setShowModal] = useState(false);

  // Load anomalies from API
  useEffect(() => {
    if (!planId) return;
    planApi.anomalies(planId).then((data: any[]) => {
      if (data.length > 0) {
        setEvents(data.map((a: any) => ({
          id: a.anomaly_id,
          type: a.anomaly_type === 'EQUIPMENT_DOWNTIME' ? '设备故障' as const : '物料短缺' as const,
          target: a.target_id,
          startOffset: `T+${a.start_sim_hour}h`,
          duration: `${a.duration_minutes} 分钟`,
          enabled: true,
          detail: a.description,
        })));
      }
    }).catch(() => {});
  }, [planId]);

  const toggleEvent = (id: string) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, enabled: !e.enabled } : e));
  };

  const handleDeleteEvent = async (id: string) => {
    if (!planId) return;
    await planApi.deleteAnomaly(planId, id).catch(() => {});
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  // Simple Gantt visualization
  const simDuration = 12; // hours
  const getOffset = (offset: string): number => {
    const match = offset.match(/T\+(\d+)h(?:\s+(\d+)min)?/);
    if (!match) return 0;
    return parseInt(match[1]) + (parseInt(match[2] || '0') / 60);
  };
  const getDuration = (dur: string): number => {
    const match = dur.match(/(\d+)\s*(分钟|小时)/);
    if (!match) return 0;
    return match[2] === '小时' ? parseInt(match[1]) : parseInt(match[1]) / 60;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-[#142235] flex-shrink-0">
        <button onClick={() => navigate(`/simulation/plan/${planId}/config`)} className="text-slate-600 hover:text-slate-300 transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div>
          <h1 className="text-base font-bold text-slate-200">异常注入配置</h1>
          <p className="text-xs text-slate-500 mt-0.5">在仿真方案上叠加特定异常事件，评估应急应对能力</p>
        </div>
        <div className="flex-1" />
        <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
          <Plus size={13} /> 添加异常事件
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Events List */}
        <div className="bg-[#0b1d30] border border-[#142235] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#142235] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-300">已配置异常事件</h3>
            <span className="text-xs text-slate-500">{events.filter(e => e.enabled).length} 个启用 · {events.filter(e => !e.enabled).length} 个禁用</span>
          </div>

          {events.length === 0 ? (
            <div className="py-12 text-center text-slate-600 text-sm">
              当前无异常注入事件，点击「添加事件」配置仿真异常场景
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-[11px] text-slate-600 border-b border-[#0e1e2e] bg-[#0a1929]">
                  <th className="text-left px-5 py-3">事件编号</th>
                  <th className="text-left px-4 py-3">类型</th>
                  <th className="text-left px-4 py-3">影响对象</th>
                  <th className="text-left px-4 py-3">开始时间（相对）</th>
                  <th className="text-left px-4 py-3">持续时长</th>
                  <th className="text-left px-4 py-3">说明</th>
                  <th className="text-left px-4 py-3">状态</th>
                  <th className="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#0e1e2e]">
                {events.map(evt => (
                  <tr key={evt.id} className={cn('hover:bg-[#0d2035]/50 transition-colors', !evt.enabled && 'opacity-50')}>
                    <td className="px-5 py-3 font-mono text-xs text-slate-400">{evt.id}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md w-fit',
                        evt.type === '设备故障' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400',
                      )}>
                        {evt.type === '设备故障' ? <AlertTriangle size={10} /> : <Package size={10} />}
                        {evt.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">{evt.target}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-400">{evt.startOffset}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{evt.duration}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{evt.detail || '—'}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleEvent(evt.id)}
                        className={cn(
                          'relative inline-flex h-5 w-9 items-center rounded-full transition-all',
                          evt.enabled ? 'bg-blue-600' : 'bg-slate-700',
                        )}
                      >
                        <span className={cn('w-3.5 h-3.5 bg-white rounded-full transition-all', evt.enabled ? 'translate-x-4.5' : 'translate-x-0.5')} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button size="xs" variant="ghost"><Edit2 size={11} /></Button>
                        <Button size="xs" variant="ghost" onClick={() => handleDeleteEvent(evt.id)}>
                          <Trash2 size={11} className="text-red-400" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Gantt Timeline */}
        <div className="bg-[#0b1d30] border border-[#142235] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">事件时间轴</h3>
          <div className="relative">
            {/* Time axis */}
            <div className="flex border-b border-[#142235] pb-2 mb-3">
              {Array.from({ length: simDuration + 1 }, (_, i) => (
                <div key={i} className="flex-1 text-[10px] text-slate-600 text-center">{`T+${i}h`}</div>
              ))}
            </div>
            {/* Event bars */}
            <div className="space-y-2">
              {events.map(evt => {
                const left = (getOffset(evt.startOffset) / simDuration) * 100;
                const width = Math.max((getDuration(evt.duration) / simDuration) * 100, 2);
                return (
                  <div key={evt.id} className="relative h-7">
                    <div className="absolute inset-0 flex items-center">
                      <span className="text-[10px] text-slate-600 w-20 flex-shrink-0">{evt.id}</span>
                      <div className="flex-1 relative h-5">
                        <div
                          className={cn(
                            'absolute h-full rounded flex items-center px-2 text-[10px] font-medium transition-opacity',
                            evt.type === '设备故障' ? 'bg-red-500/40 text-red-300 border border-red-500/30' : 'bg-amber-500/40 text-amber-300 border border-amber-500/30',
                            !evt.enabled && 'opacity-40',
                          )}
                          style={{ left: `${left}%`, width: `${width}%` }}
                        >
                          {width > 8 ? evt.target.split(' ')[0] : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {showModal && <AddEventModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
