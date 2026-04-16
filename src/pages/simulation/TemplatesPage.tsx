import { useCallback, useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Copy, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { templateApi } from '@/lib/api';
import { paramTemplates } from '@/mock/data';

export function TemplatesPage() {
  const [templates, setTemplates] = useState(paramTemplates);

  const loadTemplates = useCallback(async () => {
    try {
      const data = await templateApi.list() as any[];
      if (data.length > 0) {
        setTemplates(data.map((t: any) => ({
          id: t.template_id,
          name: t.template_name,
          desc: t.template_description || '',
          creator: t.created_by,
          updatedAt: t.updated_at?.slice(0, 10) ?? '',
          usageCount: 0,
        })));
      }
    } catch { /* keep mock data as fallback */ }
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const handleDelete = async (id: string) => {
    await templateApi.delete(id).catch(() => {});
    loadTemplates();
  };

  const handleCopy = async (id: string) => {
    await templateApi.copy(id).catch(() => {});
    loadTemplates();
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">参数模板管理</h1>
          <p className="text-xs text-slate-500 mt-0.5">保存常用参数配置为模板，供跨方案复用，避免重复配置</p>
        </div>
        <Button variant="primary" size="sm">
          <Plus size={13} /> 新建模板
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {templates.map(t => (
          <div key={t.id} className="bg-[#0b1d30] border border-[#142235] rounded-xl p-5 hover:border-[#1e3a55] transition-colors group">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm">
                {t.name[0]}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="xs" variant="ghost"><Edit2 size={11} /></Button>
                <Button size="xs" variant="ghost" onClick={() => handleCopy(t.id)}><Copy size={11} /></Button>
                <Button size="xs" variant="ghost" onClick={() => handleDelete(t.id)}><Trash2 size={11} className="text-red-400" /></Button>
              </div>
            </div>
            <div className="text-sm font-semibold text-slate-300 mb-1">{t.name}</div>
            <div className="text-xs text-slate-500 mb-3">{t.desc}</div>
            <div className="flex items-center justify-between text-[11px] text-slate-600">
              <div className="flex items-center gap-1">
                <Clock size={10} /> 更新: {t.updatedAt}
              </div>
              <div>使用 {t.usageCount} 次</div>
            </div>
            <div className="mt-3">
              <Button size="xs" variant="outline" className="w-full">
                应用此模板
              </Button>
            </div>
          </div>
        ))}

        {/* New Template Card */}
        <div className="bg-[#0b1d30] border-2 border-dashed border-[#142235] rounded-xl p-5 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-blue-500/30 hover:bg-[#0d2035]/50 transition-all text-slate-600 hover:text-slate-400 min-h-[180px]">
          <Plus size={20} />
          <span className="text-xs">新建参数模板</span>
        </div>
      </div>
    </div>
  );
}
