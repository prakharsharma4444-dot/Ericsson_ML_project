import { Search, Bell, X } from 'lucide-react';

function TopBar({ searchQuery = '', onSearchChange }) {
  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 flex items-center justify-between sticky top-0 z-20 transition-colors">
      {/* Real-time Global Search Input */}
      <div className="relative w-96">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder="Search cases by ID, subject, status, owner..."
          className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs rounded-xl pl-10 pr-9 py-2.5 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 transition"
        />
        {searchQuery ? (
          <button
            onClick={() => onSearchChange?.('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition"
            title="Clear search"
          >
            <X size={14} />
          </button>
        ) : (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-700 px-1.5 py-0.5 rounded">
            ⌘K
          </span>
        )}
      </div>

      {/* User Actions Header */}
      <div className="flex items-center gap-4">
        <button className="relative p-2 text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full ring-2 ring-white dark:ring-slate-900" />
        </button>

        <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800" />

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
            A
          </div>
          <div className="hidden sm:block text-xs">
            <p className="font-semibold text-slate-800 dark:text-slate-100">Admin User</p>
            <p className="text-slate-400 dark:text-slate-400">Ericsson Ops</p>
          </div>
        </div>
      </div>
    </header>
  );
}

export default TopBar;