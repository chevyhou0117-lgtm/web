import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Brain, Database, Monitor, CheckSquare, Box, CalendarClock,
  BarChart3, Bell, Leaf, Zap, LayoutGrid, Settings, User,
  ChevronRight, FlaskConical, Cpu, Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Module {
  id: string;
  icon: React.ReactNode;
  label: string;
  desc: string;
  path?: string;
  active?: boolean;
  badge?: string;
  color: string;
}

const MODULES: Module[] = [
  {
    id: 'ai-assistant',
    icon: <Brain size={22} />,
    label: 'AI智能助手',
    desc: '智能问答与知识库',
    color: 'from-violet-600 to-purple-700',
    active: true,
  },
  {
    id: 'data-collect',
    icon: <Database size={22} />,
    label: '数据采集平台',
    desc: '设备IoT数据接入',
    color: 'from-cyan-600 to-blue-700',
    active: true,
  },
  {
    id: 'device-mgmt',
    icon: <Monitor size={22} />,
    label: '设备管理',
    desc: '设备台账与维保',
    color: 'from-blue-600 to-indigo-700',
    active: true,
  },
  {
    id: 'quality-mgmt',
    icon: <CheckSquare size={22} />,
    label: '质量管理',
    desc: 'SPC/SQC质量分析',
    color: 'from-emerald-600 to-teal-700',
    active: true,
  },
  {
    id: 'digital-twin',
    icon: <Box size={22} />,
    label: '3D企业孪生物联网决策平台',
    desc: 'Omniverse数字孪生',
    color: 'from-blue-500 to-cyan-600',
    active: true,
    badge: 'Creator',
  },
  {
    id: 'adv-planning',
    icon: <CalendarClock size={22} />,
    label: '高级计划与排产',
    desc: 'APS智能排产优化',
    color: 'from-orange-600 to-amber-700',
    active: true,
  },
  {
    id: 'ops-decision',
    icon: <BarChart3 size={22} />,
    label: '运营决策中心',
    desc: 'KPI仪表盘与决策',
    color: 'from-rose-600 to-pink-700',
    active: true,
  },
  {
    id: 'andon',
    icon: <Bell size={22} />,
    label: '安灯系统',
    desc: '现场异常呼叫响应',
    color: 'from-red-600 to-rose-700',
    active: true,
  },
  {
    id: 'simulation',
    icon: <FlaskConical size={22} />,
    label: '运营模拟',
    desc: '产线仿真与产能优化',
    path: '/simulation',
    color: 'from-blue-500 to-cyan-500',
    active: true,
    badge: 'New',
  },
  {
    id: 'carbon-mgmt',
    icon: <Leaf size={22} />,
    label: '碳管理',
    desc: '碳排放核算与减排',
    color: 'from-green-600 to-emerald-700',
    active: false,
  },
  {
    id: 'energy-mgmt',
    icon: <Zap size={22} />,
    label: '能源管理',
    desc: '能耗监控与分析',
    color: 'from-yellow-600 to-amber-700',
    active: false,
  },
  {
    id: 'master-data',
    icon: <LayoutGrid size={22} />,
    label: '基础数据',
    desc: '工厂主数据管理',
    color: 'from-slate-600 to-slate-700',
    active: true,
  },
];

const STATS = [
  { label: '在线设备', value: '64', sub: '2台告警', icon: <Cpu size={14} />, color: 'text-blue-400', bg: 'bg-blue-600/10' },
  { label: '今日产量', value: '3,842', sub: '完成率 96%', icon: <Activity size={14} />, color: 'text-emerald-400', bg: 'bg-emerald-600/10' },
  { label: '活跃仿真', value: '3', sub: '2个运行中', icon: <FlaskConical size={14} />, color: 'text-cyan-400', bg: 'bg-cyan-600/10' },
  { label: '系统告警', value: '7', sub: '3个待处理', icon: <Bell size={14} />, color: 'text-amber-400', bg: 'bg-amber-600/10' },
];

export function AIFactoryHome() {
  const navigate = useNavigate();
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);

  const handleModuleClick = (mod: Module) => {
    if (mod.path) navigate(mod.path);
  };

  return (
    <div className="min-h-screen bg-[#07111e] text-slate-100 select-none">
      {/* Top bar */}
      <header className="h-12 bg-[#07111e]/95 backdrop-blur border-b border-[#142235] flex items-center px-6 sticky top-0 z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <Cpu size={12} className="text-white" />
          </div>
          <span className="text-sm font-bold tracking-widest text-slate-200">工业富联</span>
          <span className="text-[10px] text-slate-600 font-normal">AI Factory Platform</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          <button className="w-8 h-8 rounded-lg bg-[#0b1d30] border border-[#142235] flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors">
            <Bell size={14} />
          </button>
          <button className="w-8 h-8 rounded-lg bg-[#0b1d30] border border-[#142235] flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors">
            <Settings size={14} />
          </button>
          <button className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-xs text-blue-400 font-bold">
            李
          </button>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="relative h-72 overflow-hidden">
        {/* Background gradient layers */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#050e1a] via-[#07111e] to-[#07111e]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.15)_0%,_transparent_60%)]" />
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'linear-gradient(rgba(59,130,246,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        {/* Content */}
        <div className="relative h-full flex flex-col items-center justify-center text-center px-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-400 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            智能制造及工业互联网解决方案服务商
          </div>
          <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">工业富联 · AI Factory</h1>
          <p className="text-sm text-slate-400 max-w-lg leading-relaxed">
            建构企业级数位孪生平台，结合Omniverse与MOM系统，实现从设计、仿真到部署的全流程验证。整合生产SFC数据与设备IoT数据可视化，提供远程实时监控与警示，提升效率与运营改善。
          </p>
        </div>

        {/* Stats Bar */}
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-0">
          <div className="bg-[#0b1d30]/80 backdrop-blur border border-[#142235] rounded-t-xl px-6 py-3 flex items-center divide-x divide-[#142235]">
            {STATS.map((s) => (
              <div key={s.label} className="flex items-center gap-3 px-6 first:pl-0 last:pr-0">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', s.bg, s.color)}>
                  {s.icon}
                </div>
                <div>
                  <div className={cn('text-lg font-bold leading-none', s.color)}>{s.value}</div>
                  <div className="text-[10px] text-slate-600 mt-0.5">{s.label} · {s.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modules Grid */}
      <div className="px-6 pt-4 pb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-300">功能模块</h2>
          <span className="text-[11px] text-slate-600">{MODULES.filter(m => m.active).length} 个可用模块</span>
        </div>

        <div className="grid grid-cols-4 gap-3 xl:grid-cols-6">
          {MODULES.map((mod) => (
            <div
              key={mod.id}
              onClick={() => handleModuleClick(mod)}
              onMouseEnter={() => setHoveredModule(mod.id)}
              onMouseLeave={() => setHoveredModule(null)}
              className={cn(
                'relative group bg-[#0b1d30] border rounded-xl p-4 flex flex-col items-center text-center gap-2 transition-all duration-200',
                mod.active
                  ? 'border-[#142235] hover:border-[#1e3a55] cursor-pointer hover:bg-[#0d2035]'
                  : 'border-[#0e1e2e] opacity-40 cursor-not-allowed',
                mod.id === 'simulation' && 'ring-1 ring-blue-500/30',
                hoveredModule === mod.id && mod.active && 'shadow-lg shadow-black/20',
              )}
            >
              {/* Icon */}
              <div className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br text-white transition-transform',
                mod.color,
                hoveredModule === mod.id && mod.active && 'scale-110',
              )}>
                {mod.icon}
              </div>

              {/* Label */}
              <div className="text-[11px] font-semibold text-slate-300 leading-tight">{mod.label}</div>
              <div className="text-[10px] text-slate-600 leading-tight">{mod.desc}</div>

              {/* Badge */}
              {mod.badge && (
                <span className="absolute top-2 right-2 text-[9px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded-full">
                  {mod.badge}
                </span>
              )}

              {/* Arrow on hover */}
              {mod.active && mod.path && (
                <div className={cn(
                  'absolute bottom-2 right-2 text-slate-600 transition-all',
                  hoveredModule === mod.id && 'text-blue-400',
                )}>
                  <ChevronRight size={12} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="px-6 pb-8">
        <div className="grid grid-cols-2 gap-4">
          {/* Recent Plans */}
          <div className="bg-[#0b1d30] border border-[#142235] rounded-xl">
            <div className="px-5 py-4 border-b border-[#142235] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-300">最近仿真方案</h3>
              <button onClick={() => navigate('/simulation')} className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 transition-colors">
                查看全部 <ChevronRight size={11} />
              </button>
            </div>
            <div className="p-2 space-y-0.5">
              {[
                { name: 'SMT产线A-新品导入产能评估', status: '已完成', time: '09:23', color: 'text-emerald-400' },
                { name: '双班制扩产方案-产线B', status: '运行中', time: '10:05', color: 'text-amber-400' },
                { name: '换线优化-L03产线', status: '就绪', time: '08:44', color: 'text-blue-400' },
              ].map((item, i) => (
                <div key={i} onClick={() => navigate('/simulation')} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#0d2035] cursor-pointer transition-colors">
                  <div className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', item.color, 'bg-current/10')}>{item.status}</div>
                  <span className="text-xs text-slate-300 flex-1 truncate">{item.name}</span>
                  <span className="text-[10px] text-slate-600">{item.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* System Status */}
          <div className="bg-[#0b1d30] border border-[#142235] rounded-xl">
            <div className="px-5 py-4 border-b border-[#142235]">
              <h3 className="text-sm font-semibold text-slate-300">系统运行状态</h3>
            </div>
            <div className="p-4 space-y-3">
              {[
                { label: '主数据平台', status: '正常', color: 'bg-emerald-400', time: '已同步 2h前' },
                { label: 'ERP接口', status: '正常', color: 'bg-emerald-400', time: '上次检测 5m前' },
                { label: 'MES接口', status: '告警', color: 'bg-amber-400', time: '响应延迟 >2s' },
                { label: '仿真计算服务', status: '正常', color: 'bg-emerald-400', time: '3个任务运行' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={cn('w-2 h-2 rounded-full flex-shrink-0', item.color)} />
                  <span className="text-xs text-slate-400 flex-1">{item.label}</span>
                  <span className={cn('text-[11px] font-medium', item.status === '告警' ? 'text-amber-400' : 'text-emerald-400')}>{item.status}</span>
                  <span className="text-[10px] text-slate-600 w-32 text-right">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
