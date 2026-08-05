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
    <aside className="w-60 bg-white border-r border-slate-200 min-h-screen flex flex-col py-6 px-4">
      <div className="flex items-center gap-2 mb-8 px-2">
        <img src={ericssonLogo} alt="Ericsson" className="h-6 w-auto" />
      </div>

      <button
        onClick={onNewAnalysis}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg transition mb-6 shadow-sm"
      >
        <Plus size={16} />
        New Analysis
      </button>

      <nav className="space-y-1">
        {navItems.map(({ label, icon: Icon }) => {
          const isActive = label === active;
          return (
            <button
              key={label}
              onClick={() => onNavigate && onNavigate(label)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition
                ${isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
            >
              <Icon size={18} />
              {label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export default Sidebar;