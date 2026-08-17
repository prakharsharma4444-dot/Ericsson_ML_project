import { X, Filter } from 'lucide-react';

function FilterDropdown({
  startDate, setStartDate,
  endDate, setEndDate,
  selectedSeverities, setSelectedSeverities,
  selectedRegions, setSelectedRegions,
  selectedTeams, setSelectedTeams,
  onClose, onClearAll,
}) {
  const toggleValue = (list, setList, value) => {
    setList(list.includes(value) ? list.filter(v => v !== value) : [...list, value]);
  };

  return (
    <div className="absolute top-full left-0 mt-2 w-[420px] bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl p-4 z-50 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Filter size={14} className="text-blue-600 dark:text-blue-400" />
          Filters
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Date Range</label>
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:border-blue-500"
          />
          <span className="text-slate-400 text-xs">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Ticket Severity / Priority</label>
        <div className="flex flex-wrap gap-1">
          {['Critical', 'High', 'Medium', 'Low'].map((sev) => (
            <button
              key={sev}
              type="button"
              onClick={() => toggleValue(selectedSeverities, setSelectedSeverities, sev)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                selectedSeverities.includes(sev)
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Region</label>
        <div className="flex flex-wrap gap-1">
          {['NA', 'EMEA', 'APAC'].map((reg) => (
            <button
              key={reg}
              type="button"
              onClick={() => toggleValue(selectedRegions, setSelectedRegions, reg)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                selectedRegions.includes(reg)
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {reg}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Team Assignment</label>
        <div className="flex flex-wrap gap-1">
          {['Alice Smith', 'Bob Johnson', 'Charlie Brown', 'Unassigned'].map((member) => (
            <button
              key={member}
              type="button"
              onClick={() => toggleValue(selectedTeams, setSelectedTeams, member)}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition ${
                selectedTeams.includes(member)
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {member}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={onClearAll}
          className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
        >
          Clear All
        </button>
        <button
          onClick={onClose}
          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition"
        >
          Done
        </button>
      </div>
    </div>
  );
}

export default FilterDropdown;