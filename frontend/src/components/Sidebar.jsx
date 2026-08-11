import { LayoutDashboard, UploadCloud, History, Settings, Plus } from 'lucide-react';
import ericssonLogo from '../assets/ericsson-logo.svg';

function Sidebar({ active = 'Dashboard', onNavigate, onNewAnalysis }) {
  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard },
    { label: 'Upload Data', icon: UploadCloud },
    { label: 'History', icon: History },
    { label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-60 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-screen flex flex-col py-6 px-4 shrink-0 select-none transition-colors">
      {/* Brand Logo */}
      <div className="flex items-center gap-2 mb-8 px-2">
        <img src={ericssonLogo} alt="Ericsson" className="h-16 w-auto object-contain" />
      </div>

      {/* Primary Action Button: Resets state and opens upload view */}
      <button
        onClick={onNewAnalysis}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-sm font-semibold py-2.5 rounded-lg transition mb-6 shadow-sm"
      >
        <Plus size={16} />
        New Analysis
      </button>

      {/* Navigation */}
      <nav className="space-y-1">
        {navItems.map(({ label, icon: Icon }) => {
          const isActive = label === active;
          return (
            <button
              key={label}
              onClick={() => onNavigate && onNavigate(label)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'} />
              {label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export default Sidebar;