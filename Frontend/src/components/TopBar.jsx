import { useState } from 'react';
import { Search, Bell, SlidersHorizontal } from 'lucide-react';
import FilterDropdown from './FilterDropdown';

function TopBar({
  searchQuery, onSearchChange,
  startDate, setStartDate,
  endDate, setEndDate,
  selectedSeverities, setSelectedSeverities,
  selectedRegions, setSelectedRegions,
  selectedTeams, setSelectedTeams,
  onClearAllFilters,
}) {
  const [showFilters, setShowFilters] = useState(false);

  const activeFilterCount =
    (startDate ? 1 : 0) +
    (endDate ? 1 : 0) +
    selectedSeverities.length +
    selectedRegions.length +
    selectedTeams.length;

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between transition-colors">
      {/* Search + Filters */}
      <div className="flex items-center gap-2">
        <div className="relative w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search cases by ID, subject, status..."
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-10 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 border border-slate-300 dark:border-slate-600 px-1 rounded">
            ⌘K
          </span>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowFilters(prev => !prev)}
            className={`relative flex items-center gap-1.5 px-3 py-[7px] rounded-lg border text-xs font-medium transition ${
              showFilters || activeFilterCount > 0
                ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <SlidersHorizontal size={14} />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-0.5 bg-blue-600 text-white text-[10px] font-semibold w-4 h-4 rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {showFilters && (
            <FilterDropdown
              startDate={startDate} setStartDate={setStartDate}
              endDate={endDate} setEndDate={setEndDate}
              selectedSeverities={selectedSeverities} setSelectedSeverities={setSelectedSeverities}
              selectedRegions={selectedRegions} setSelectedRegions={setSelectedRegions}
              selectedTeams={selectedTeams} setSelectedTeams={setSelectedTeams}
              onClose={() => setShowFilters(false)}
              onClearAll={onClearAllFilters}
            />
          )}
        </div>
      </div>

      {/* User & Notifications */}
      <div className="flex items-center gap-4">
        <button className="relative p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full" />
        </button>

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-xs">
            A
          </div>
          <div className="text-left">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Admin User</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Ericsson Ops</p>
          </div>
        </div>
      </div>
    </header>
  );
}

export default TopBar;