import { LayoutDashboard, Upload, History, Settings, PlusCircle } from 'lucide-react';

const NAV_ITEMS = [
  { name: 'Dashboard', icon: LayoutDashboard },
  { name: 'Upload Data', icon: Upload },
  { name: 'History', icon: History },
  { name: 'Settings', icon: Settings },
];

function Sidebar({ active, onNavigate, onNewAnalysis, theme }) {
  return (
    <aside className={`w-64 flex flex-col justify-between border-r p-4 transition-colors flex-shrink-0 ${
      theme === 'dark' 
        ? 'bg-slate-900 border-slate-800 text-slate-100' 
        : 'bg-white border-slate-200 text-slate-800'
    }`}>
      <div>
        {/* Brand Logo */}
        <div className="flex items-center gap-3 px-3 py-4 mb-4">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-lg shadow-sm">
            E
          </div>
          <span className={`font-bold text-lg tracking-wide ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            ERICSSON
          </span>
        </div>

        {/* New Analysis Action */}
        <button
          type="button"
          onClick={() => {
            if (typeof onNewAnalysis === 'function') onNewAnalysis();
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-medium text-sm transition mb-6 shadow-sm cursor-pointer"
        >
          <PlusCircle size={18} />
          <span>New Analysis</span>
        </button>

        {/* Navigation Items */}
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.name;
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => {
                  if (typeof onNavigate === 'function') onNavigate(item.name);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition text-left cursor-pointer ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-600 dark:text-blue-400 font-semibold border border-blue-500/30'
                    : theme === 'dark'
                      ? 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon size={18} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Made By / Credits Footer */}
      <div className={`px-3 py-3 border-t text-center ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
        <p className={`text-xs font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Developed by</p>
        <p className={`text-xs font-semibold mt-0.5 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>Prakhar Sharma </p>
        <p className={`text-xs font-semibold mt-0.5 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}> & Ananya Bahl</p>
      </div>
    </aside>
  );
}

export default Sidebar;