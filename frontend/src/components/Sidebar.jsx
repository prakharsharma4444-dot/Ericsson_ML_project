import { LayoutDashboard, Upload, Settings, LogOut } from 'lucide-react';

function Sidebar() {
  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard },
    { label: 'Upload Data', icon: Upload },
    { label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-56 bg-white border-r border-gray-200 min-h-screen flex flex-col justify-between py-6 px-4">
      <div>
        <h1 className="text-xl font-bold text-blue-600 mb-8 px-2">DataLens</h1>
        <nav className="space-y-1">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition"
            >
              <Icon size={18} />
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </nav>
      </div>
      <button className="flex items-center gap-3 px-3 py-2 text-gray-500 hover:text-red-500 transition text-sm">
        <LogOut size={18} />
        Logout
      </button>
    </aside>
  );
}

export default Sidebar;