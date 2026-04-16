import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ChevronLeft, Brain, Lightbulb, TrendingUp, Users, Wrench, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

interface Suggestion {
  id: string;
  category: '设备优化' | '人员调整' | '工艺改善' | '物料优化';
  priority: 'P0' | 'P1' | 'P2';
  title: string;
  desc: string;
  impact: string;
  effort: '低' | '中' | '高';
  expanded?: boolean;
}

const SUGGESTIONS: Suggestion[] = [
  {
    id: 'S001', category: '设备优化', priority: 'P0',
    title: '增加选择焊工位（或外包）',
    desc: '选择焊工序CT=55s，Takt=42s，利用率高达131%，是最严重的瓶颈。建议增加1台选择焊设备或将超出部分外包至协作工厂，可将瓶颈工序CT降至<42s。',
    impact: '预计LBR从73.2%提升至86.5%，总产量提升约18%',
    effort: '高',
  },
  {
    id: 'S002', category: '工艺改善', priority: 'P0',
    title: '优化贴片工序节拍均衡',
    desc: '贴片前(CT=48s)与贴片后(CT=45s)均超过Takt(42s)，建议通过优化贴装程序、合理分配元件到前后两台贴片机，实现节拍均衡至42s以内。',
    impact: '预计贴片工序利用率从107/114%降至≤100%，解除瓶颈',
    effort: '中',
  },
  {
    id: 'S003', category: '人员调整', priority: 'P1',
    title: '增加选择焊工序作业人员',
    desc: 'ICT测试工序利用率仅52%，而选择焊严重过负荷。建议将ICT工序多余1名操作人员临时调配至选择焊工序协助作业，可提升选择焊有效产出。',
    impact: '在无法增设设备的短期内，可降低选择焊等待时间约15%',
    effort: '低',
  },
  {
    id: 'S004', category: '物料优化', priority: 'P1',
    title: '提前IC主控物料备货时间',
    desc: '仿真中T+04:30出现IC主控短缺，持续45分钟，影响3条工单。建议将IC主控到货计划提前2小时，并设置安全库存预警线至600pcs（当前500pcs）。',
    impact: '消除物料短缺缺口，预计减少3条工单延误',
    effort: '低',
  },
  {
    id: 'S005', category: '工艺改善', priority: 'P2',
    title: 'AOI检测工序产能释放至下游缓冲',
    desc: 'AOI检测工序利用率仅67%，存在大量空闲时间。建议在AOI后增设线边仓（2托盘容量），作为后续选择焊工序的缓冲，减少上下游等待。',
    impact: '预计减少因线边仓满仓导致的AOI停线时间约12%',
    effort: '低',
  },
];

const CATEGORY_CONFIG: Record<Suggestion['category'], { icon: React.ReactNode; color: string; bg: string }> = {
  '设备优化': { icon: <Wrench size={12} />, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  '人员调整': { icon: <Users size={12} />, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
  '工艺改善': { icon: <TrendingUp size={12} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  '物料优化': { icon: <Lightbulb size={12} />, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
};

const PRIORITY_CONFIG = {
  P0: { label: '紧急', cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
  P1: { label: '重要', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  P2: { label: '建议', cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
};

export function AIAnalysisPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<string[]>(['S001']);
  const [accepted, setAccepted] = useState<string[]>([]);

  const toggle = (id: string) => setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const accept = (id: string) => setAccepted(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-[#142235] flex-shrink-0">
        <button onClick={() => navigate(`/simulation/plan/${planId}/result`)} className="text-slate-600 hover:text-slate-300 transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <Brain size={16} className="text-violet-400" />
            <h1 className="text-base font-bold text-slate-200">AI优化建议</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">基于精益生产知识库，针对仿真结果自动生成改善建议</p>
        </div>
        <div className="flex-1" />
        <Button variant="primary" size="sm">
          导出建议报告
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Summary */}
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <Brain size={20} className="text-violet-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-violet-300 mb-2">瓶颈根因分析</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                仿真结果显示，本次方案的核心瓶颈为<span className="text-red-400 font-semibold">「选择焊工序」</span>产能严重不足（利用率131%），导致下游工序等待积压，产线平衡率LBR=73.2%，低于行业标准85%。
                次要瓶颈为<span className="text-amber-400 font-semibold">「贴片工序」</span>（前107%、后114%），叠加物料短缺事件（T+04:30）导致5条工单延误完工。
                整体改善优先级：增加选择焊产能 &gt; 优化贴片节拍均衡 &gt; 人员灵活调配 &gt; 物料备货提前。
              </p>
            </div>
          </div>
        </div>

        {/* Improvement Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: '改善建议总数', value: SUGGESTIONS.length.toString(), unit: '条' },
            { label: 'P0紧急建议', value: SUGGESTIONS.filter(s => s.priority === 'P0').length.toString(), unit: '条', color: 'text-red-400' },
            { label: '已采纳建议', value: accepted.length.toString(), unit: '条', color: 'text-emerald-400' },
            { label: '预期LBR提升', value: '+13.3%', unit: '(如全部采纳)', color: 'text-cyan-400' },
          ].map(m => (
            <div key={m.label} className="bg-[#0a1929] border border-[#142235] rounded-xl p-4">
              <div className="text-[11px] text-slate-600 mb-1">{m.label}</div>
              <div className={cn('text-2xl font-bold', m.color || 'text-slate-200')}>{m.value}<span className="text-sm font-normal text-slate-500 ml-1">{m.unit}</span></div>
            </div>
          ))}
        </div>

        {/* Suggestions List */}
        <div className="space-y-3">
          {SUGGESTIONS.map(s => {
            const cat = CATEGORY_CONFIG[s.category];
            const pri = PRIORITY_CONFIG[s.priority];
            const isExpanded = expanded.includes(s.id);
            const isAccepted = accepted.includes(s.id);
            return (
              <div
                key={s.id}
                className={cn(
                  'border rounded-xl overflow-hidden transition-all',
                  isAccepted ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-[#142235] bg-[#0a1929]',
                )}
              >
                {/* Summary Row */}
                <div className="px-5 py-4 flex items-start gap-4">
                  <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-semibold flex-shrink-0', cat.bg, cat.color)}>
                    {cat.icon}{s.category}
                  </div>
                  <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0', pri.cls)}>{pri.label}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-200">{s.title}</span>
                      {isAccepted && <span className="text-[11px] text-emerald-400 flex items-center gap-1"><CheckCircle2 size={11} />已采纳</span>}
                    </div>
                    {!isExpanded && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{s.desc}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[11px] text-slate-600">实施难度: <span className={s.effort === '低' ? 'text-emerald-400' : s.effort === '中' ? 'text-amber-400' : 'text-red-400'}>{s.effort}</span></span>
                    <button onClick={() => toggle(s.id)} className="text-slate-600 hover:text-slate-300 transition-colors">
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="px-5 pb-4 pt-0 border-t border-[#142235]">
                    <div className="mt-3 space-y-2">
                      <p className="text-xs text-slate-400 leading-relaxed">{s.desc}</p>
                      <div className="flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                        <TrendingUp size={12} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-emerald-300">{s.impact}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-4">
                      <Button
                        size="xs"
                        variant={isAccepted ? 'secondary' : 'primary'}
                        onClick={() => accept(s.id)}
                      >
                        {isAccepted ? '取消采纳' : '采纳建议'}
                      </Button>
                      <Button size="xs" variant="ghost">
                        基于此建议创建新方案
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
