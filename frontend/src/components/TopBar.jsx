import { Search, Bell, HelpCircle } from 'lucide-react';

function TopBar({ title = 'DataPulse Analytics', userName = 'Admin', userRole = 'Admin', hasNotification = true }) {
  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div className="relative w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search analytics..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 focus:bg-white"
          />
        </div>
      </div>

      <h1 className="text-base font-semibold text-slate-800">{title}</h1>

      <div className="flex items-center gap-4 flex-1 justify-end">
        <button className="relative text-slate-400 hover:text-slate-600 transition">
          <Bell size={20} />
          {hasNotification && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </button>
        <button className="text-slate-400 hover:text-slate-600 transition">
          <HelpCircle size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-semibold">
            {userName.slice(0, 1)}
          </div>
          <div className="text-xs leading-tight">
            <p className="font-semibold text-slate-800">{userName}</p>
            <p className="text-slate-400">{userRole}</p>
          </div>
        </div>
      </div>
    </header>
  );
}

export default TopBar;