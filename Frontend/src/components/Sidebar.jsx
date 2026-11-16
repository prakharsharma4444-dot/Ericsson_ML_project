import { LayoutDashboard, Upload, History, Settings, PlusCircle } from 'lucide-react';

const NAV_ITEMS = [
  { name: 'Dashboard', icon: LayoutDashboard },
  { name: 'Upload Data', icon: Upload },
  { name: 'History', icon: History },
  { name: 'AI Analyst', icon: Sparkles },
  { name: 'Settings', icon: Settings },
];

function Sidebar({ active, onNavigate, onNewAnalysis, theme }) {
  const isDark = theme === 'dark';
  const asideClass = 'w-64 flex flex-col justify-between border-r p-4 transition-colors flex-shrink-0 ' + (isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800');
  const subtitleClass = 'text-[10px] mt-0.5 ' + (isDark ? 'text-slate-400' : 'text-slate-500');
  const footerLabelClass = 'text-[10px] font-medium ' + (isDark ? 'text-slate-500' : 'text-slate-400');
  const footerValueClass = 'text-xs font-semibold mt-1 ' + (isDark ? 'text-slate-200' : 'text-slate-800');

  return (
    <aside className={asideClass}>
      <div>
        <div className="px-2 pt-2 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">IF</div>
            <div>
              <p className="text-sm font-bold tracking-tight">InsightForge</p>
              <p className={subtitleClass}>Intelligent Data Platform</p>
            </div>
          </div>
        </div>

        <button type="button" onClick={() => { if (typeof onNewAnalysis === 'function') onNewAnalysis(); }} className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-medium text-sm transition mb-6 shadow-sm cursor-pointer">
          <PlusCircle size={18} />
          <span>New Analysis</span>
        </button>

        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.name;
            const itemClass = 'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition text-left cursor-pointer ' + (isActive ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : (isDark ? 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'));
            return (
              <button key={item.name} type="button" onClick={() => { if (typeof onNavigate === 'function') onNavigate(item.name); }} className={itemClass}>
                <Icon size={18} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className={'px-3 py-3 border-t ' + (isDark ? 'border-slate-800' : 'border-slate-200')}>
        <p className={footerLabelClass}>Major Project I</p>
        <p className={footerValueClass}>Data Analytics + ML</p>
      </div>
    </aside>
  );
}

export default Sidebar;