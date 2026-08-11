import { useState, useEffect } from 'react';
import { Save, Server, Sliders, Moon, Sun } from 'lucide-react';

function SettingsScreen({ theme, onThemeChange }) {
  const [apiUrl, setApiUrl] = useState('http://localhost:8000');
  const [testSplit, setTestSplit] = useState(20);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedSettings = JSON.parse(localStorage.getItem('app_settings') || '{}');
    if (savedSettings.apiUrl) setApiUrl(savedSettings.apiUrl);
    if (savedSettings.testSplit) setTestSplit(savedSettings.testSplit);
  }, []);

  const handleSelectTheme = (newTheme) => {
    if (onThemeChange) {
      onThemeChange(newTheme);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    const existing = JSON.parse(localStorage.getItem('app_settings') || '{}');
    const settings = { ...existing, apiUrl, testSplit: Number(testSplit), theme };
    localStorage.setItem('app_settings', JSON.stringify(settings));

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
          Settings
        </h2>
        <p className={`text-sm mt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
          Manage API endpoints, default pipeline parameters, and workspace appearance.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Appearance Settings */}
        <div className={`rounded-2xl border p-6 shadow-sm space-y-4 ${
          theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
        }`}>
          <div className={`flex items-center gap-2 font-semibold text-sm border-b pb-3 ${
            theme === 'dark' ? 'text-white border-slate-700' : 'text-slate-800 border-slate-100'
          }`}>
            <Sun size={18} className="text-blue-500" />
            Appearance Mode
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => handleSelectTheme('light')}
              className={`flex items-center justify-center gap-2 p-3.5 rounded-xl border text-xs font-semibold transition ${
                theme === 'light'
                  ? 'border-blue-600 bg-blue-50 text-blue-600'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700/50'
              }`}
            >
              <Sun size={16} />
              Light Mode
            </button>
            <button
              type="button"
              onClick={() => handleSelectTheme('dark')}
              className={`flex items-center justify-center gap-2 p-3.5 rounded-xl border text-xs font-semibold transition ${
                theme === 'dark'
                  ? 'border-blue-500 bg-blue-950/60 text-blue-400'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700/50'
              }`}
            >
              <Moon size={16} />
              Dark Mode
            </button>
          </div>
        </div>

        {/* Backend Endpoint Settings */}
        <div className={`rounded-2xl border p-6 shadow-sm space-y-4 ${
          theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
        }`}>
          <div className={`flex items-center gap-2 font-semibold text-sm border-b pb-3 ${
            theme === 'dark' ? 'text-white border-slate-700' : 'text-slate-800 border-slate-100'
          }`}>
            <Server size={18} className="text-blue-500" />
            Backend API Endpoint
          </div>
          <div>
            <label className={`block text-xs font-semibold mb-1 ${
              theme === 'dark' ? 'text-slate-300' : 'text-slate-600'
            }`}>
              FastAPI Server URL
            </label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              className={`w-full rounded-xl px-3.5 py-2 text-xs font-mono focus:outline-none focus:border-blue-500 ${
                theme === 'dark'
                  ? 'bg-slate-900 border-slate-700 text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            />
          </div>
        </div>

        {/* Pipeline Settings */}
        <div className={`rounded-2xl border p-6 shadow-sm space-y-4 ${
          theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
        }`}>
          <div className={`flex items-center gap-2 font-semibold text-sm border-b pb-3 ${
            theme === 'dark' ? 'text-white border-slate-700' : 'text-slate-800 border-slate-100'
          }`}>
            <Sliders size={18} className="text-blue-500" />
            Default ML Pipeline Parameters
          </div>
          <div className="space-y-4 text-xs">
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}>
                  Validation Train / Test Split
                </span>
                <span className="text-blue-500">{testSplit}% Test Size</span>
              </div>
              <input
                type="range"
                min="10"
                max="40"
                value={testSplit}
                onChange={(e) => setTestSplit(e.target.value)}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-xs font-semibold text-emerald-500">Settings saved successfully!</span>}
          <button
            type="submit"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-sm transition active:scale-[0.98]"
          >
            <Save size={14} />
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}

export default SettingsScreen;