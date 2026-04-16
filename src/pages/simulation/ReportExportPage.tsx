import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ChevronLeft, FileText, Table2, Download, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { planApi } from '@/lib/api';
import { Input, Select } from '@/components/ui/Input';

const CONTENT_MODULES = [
  { id: 'basic', label: '方案基础信息', desc: '方案名称、仿真时间范围、参与产线、参数摘要', default: true },
  { id: 'output', label: '生产产出总览', desc: '产出量、工单完成率、甘特图', default: true },
  { id: 'lbr', label: '产线平衡率（LBR）', desc: 'LBR时序曲线、热力图、瓶颈识别', default: true },
  { id: 'device', label: '设备利用率分析', desc: '利用率条形图、OEE分解、甘特图', default: true },
  { id: 'material', label: '库存与物料状态', desc: '库存曲线、短缺事件', default: false },
  { id: 'events', label: '事件日志', desc: '完整事件列表（可能较大）', default: false },
  { id: 'params', label: '参数配置明细', desc: 'CT、良率、故障率等参数详情', default: false },
  { id: 'constraints', label: '约束配置说明', desc: '启用的软约束及子参数', default: false },
  { id: 'anomaly', label: '异常注入事件列表', desc: '注入的故障/短缺事件清单', default: false },
];

export function ReportExportPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(new Set(CONTENT_MODULES.filter(m => m.default).map(m => m.id)));
  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf');
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  const toggleModule = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleExport = async () => {
    if (!planId) return;
    setExporting(true);
    try {
      const report = await planApi.exportReport(planId, {
        modules: Array.from(selected),
        format,
        title: 'Simulation Report',
      });
      // Download as JSON file
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${planId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExported(true);
    } catch (e) {
      console.error('Export failed', e);
    } finally {
      setExporting(false);
    }
  };

  const estimatedTime = Math.ceil(selected.size * 2.5);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 px-6 py-4 border-b border-[#142235] flex-shrink-0">
        <button onClick={() => navigate(`/simulation/plan/${planId}/result`)} className="text-slate-600 hover:text-slate-300 transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div>
          <h1 className="text-base font-bold text-slate-200">导出仿真报表</h1>
          <p className="text-xs text-slate-500 mt-0.5">SMT产线A-新品导入产能评估</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-6">
          {/* Report Info */}
          <div className="bg-[#0b1d30] border border-[#142235] rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-300">报告基本信息</h3>
            <Input label="报告标题" defaultValue="SMT产线A-新品导入产能评估_仿真分析报告_20260410" />
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400 font-medium">报告摘要（选填）</label>
              <textarea
                className="bg-[#07111e] border border-[#1e3a55] rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500/60 resize-none h-16 placeholder:text-slate-600"
                placeholder="添加报告摘要，展示在首页（最多500字）"
              />
            </div>
            <Select label="报告语言">
              <option>中文</option>
              <option>English</option>
            </Select>
          </div>

          {/* Content Selection */}
          <div className="bg-[#0b1d30] border border-[#142235] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">内容模块选择</h3>
            <div className="space-y-2">
              {CONTENT_MODULES.map(m => (
                <div
                  key={m.id}
                  onClick={() => toggleModule(m.id)}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all',
                    selected.has(m.id) ? 'bg-blue-600/10 border border-blue-500/20' : 'border border-transparent hover:bg-[#0d2035]/50',
                  )}
                >
                  <div className={cn(
                    'w-4 h-4 rounded border-2 flex items-center justify-center mt-0.5 flex-shrink-0',
                    selected.has(m.id) ? 'border-blue-500 bg-blue-600' : 'border-slate-600',
                  )}>
                    {selected.has(m.id) && <CheckCircle2 size={10} className="text-white" />}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-300">{m.label}</div>
                    <div className="text-[11px] text-slate-600">{m.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Format Selection */}
          <div className="bg-[#0b1d30] border border-[#142235] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">导出格式</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'pdf' as const, icon: <FileText size={18} />, label: 'PDF', desc: '图文混排，适合正式汇报和归档，A4格式' },
                { id: 'excel' as const, icon: <Table2 size={18} />, label: 'Excel', desc: '数据表格为主，适合进一步数据分析，含多Sheet' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={cn(
                    'flex items-start gap-3 p-4 rounded-xl border text-left transition-all',
                    format === f.id ? 'bg-blue-600/10 border-blue-500/30' : 'border-[#142235] hover:border-[#1e3a55]',
                  )}
                >
                  <div className={cn('mt-0.5', format === f.id ? 'text-blue-400' : 'text-slate-500')}>{f.icon}</div>
                  <div>
                    <div className={cn('text-sm font-semibold', format === f.id ? 'text-blue-300' : 'text-slate-400')}>{f.label}</div>
                    <div className="text-[11px] text-slate-600 mt-0.5">{f.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Export Action */}
          {exported ? (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-5 py-4 flex items-center gap-3">
              <CheckCircle2 size={18} className="text-emerald-400" />
              <div>
                <div className="text-sm font-semibold text-emerald-300">报告已生成，正在下载...</div>
                <div className="text-xs text-slate-500 mt-0.5">下载链接有效期 7 天</div>
              </div>
              <Button size="sm" variant="secondary" className="ml-auto">重新导出</Button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="text-xs text-slate-500 flex items-center gap-1">
                <Clock size={11} /> 预计生成时间: 约 {estimatedTime} 秒
              </div>
              <Button
                variant="primary"
                size="md"
                onClick={handleExport}
                disabled={selected.size === 0 || exporting}
                className="ml-auto"
              >
                {exporting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    正在生成报告...
                  </>
                ) : (
                  <>
                    <Download size={14} /> 导出 {format.toUpperCase()}
                  </>
                )}
              </Button>
            </div>
          )}

          {selected.size === 0 && (
            <p className="text-xs text-red-400">请至少选择一个内容模块</p>
          )}
        </div>
      </div>
    </div>
  );
}
