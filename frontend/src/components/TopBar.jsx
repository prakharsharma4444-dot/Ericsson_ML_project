import { Search, Bell } from 'lucide-react';

function TopBar() {
  return (
    <header className="flex items-center justify-between bg-white border-b border-gray-200 px-6 py-3">
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 w-72">
        <Search size={16} className="text-gray-400" />
        <input
          type="text"
          placeholder="Search"
          className="bg-transparent outline-none text-sm text-gray-600 w-full"
        />
      </div>

      <div className="flex items-center gap-5">
        <button className="relative text-gray-400 hover:text-gray-600">
          <Bell size={20} />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600" />
          <div className="text-sm">
            <p className="font-medium text-gray-800 leading-tight">Admin</p>
            <p className="text-xs text-gray-400 leading-tight">Admin</p>
          </div>
        </div>
      </div>
    </header>
  );
}

export default TopBar;