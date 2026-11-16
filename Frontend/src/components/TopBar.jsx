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

  const filterClass =
    'relative flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition ' +
    (showFilters || activeFilterCount > 0
      ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
      : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800');

  return (
    <header className="h-16 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-indigo-500">Workspace</p>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Intelligent Dataset Analysis</p>
        </div>

        <div className="relative ml-5 w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search the active dataset..."
            className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="relative">
          <button onClick={() => setShowFilters((prev) => !prev)} className={filterClass}>
            <SlidersHorizontal size={14} />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-0.5 bg-indigo-600 text-white text-[10px] font-semibold w-4 h-4 rounded-full flex items-center justify-center">
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

      <div className="flex items-center gap-4">
        <button className="relative p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-600 rounded-full" />
        </button>

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold text-xs">MP</div>
          <div className="text-left">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Project Workspace</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Major Project I</p>
          </div>
        </div>
      </div>
    </header>
  );
}

export default TopBar;
