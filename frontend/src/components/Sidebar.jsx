import { LayoutDashboard, Database, Upload, Settings } from 'lucide-react';
function Sidebar({ active = 'Dashboard', onNavigate }) {
  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard },
    { label: 'Datasets', icon: Database },
    { label: 'Upload Data', icon: Upload },
    { label: 'Settings', icon: Settings },
  ];
  return (
    <aside className="w-56 bg-white border-r border-gray-200 min-h-screen flex flex-col py-6 px-4">
      <div className="flex items-center gap-2 mb-10 px-2">
        <div className="w-8 h-8 rounded-lg bg-indigo-600" />
        <h1 className="text-lg font-bold text-gray-800">CaseFlow</h1>
      </div>
      <nav className="space-y-1">
        {navItems.map(({ label, icon: Icon }) => {
          const isActive = label === active;
          return (
            <button
              key={label}
              onClick={() => onNavigate && onNavigate(label)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition
                ${isActive
                  ? 'bg-indigo-50 text-indigo-600 border-l-2 border-indigo-600'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}
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