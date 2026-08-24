import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Moon,
  RotateCcw,
  Save,
  Server,
  Sliders,
  Sun,
  Wifi,
  XCircle,
} from 'lucide-react';

const DEFAULT_API_URL = 'http://localhost:8000';
const DEFAULT_TEST_SPLIT = 20;

function SettingsScreen({ theme, onThemeChange }) {
  const isDark = theme === 'dark';

  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [testSplit, setTestSplit] = useState(DEFAULT_TEST_SPLIT);
  const [saved, setSaved] = useState(false);

  const [connectionState, setConnectionState] = useState('idle');
  const [connectionMessage, setConnectionMessage] = useState('');

  const [validationMessage, setValidationMessage] = useState('');

  useEffect(() => {
    try {
      const savedSettings = JSON.parse(
        localStorage.getItem('app_settings') || '{}'
      );

      if (savedSettings.apiUrl) {
        setApiUrl(savedSettings.apiUrl);
      }

      if (
        savedSettings.testSplit !== undefined &&
        !Number.isNaN(Number(savedSettings.testSplit))
      ) {
        setTestSplit(Number(savedSettings.testSplit));
      }
    } catch (err) {
      console.warn('Could not load saved settings:', err);
    }
  }, []);

  const normalizeUrl = (value) => {
    return String(value || '').trim().replace(/\/+$/, '');
  };

  const validateSettings = () => {
    const normalizedUrl = normalizeUrl(apiUrl);

    if (!normalizedUrl) {
      return 'Enter a backend API URL.';
    }

    try {
      const parsed = new URL(normalizedUrl);

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return 'API URL must use http:// or https://.';
      }
    } catch {
      return 'Enter a valid API URL.';
    }

    const split = Number(testSplit);

    if (!Number.isFinite(split) || split < 10 || split > 40) {
      return 'Test split must be between 10% and 40%.';
    }

    return '';
  };

  const handleSelectTheme = (newTheme) => {
    onThemeChange?.(newTheme);
  };

  const handleSave = (e) => {
    e.preventDefault();

    const error = validateSettings();

    if (error) {
      setValidationMessage(error);
      setSaved(false);
      return;
    }

    const existing = JSON.parse(
      localStorage.getItem('app_settings') || '{}'
    );

    const settings = {
      ...existing,
      apiUrl: normalizeUrl(apiUrl),
      testSplit: Number(testSplit),
      theme,
    };

    localStorage.setItem('app_settings', JSON.stringify(settings));

    setApiUrl(settings.apiUrl);
    setTestSplit(settings.testSplit);
    setValidationMessage('');
    setSaved(true);

    window.setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    const existing = JSON.parse(
      localStorage.getItem('app_settings') || '{}'
    );

    const resetSettings = {
      ...existing,
      apiUrl: DEFAULT_API_URL,
      testSplit: DEFAULT_TEST_SPLIT,
      theme: 'light',
    };

    localStorage.setItem(
      'app_settings',
      JSON.stringify(resetSettings)
    );

    setApiUrl(DEFAULT_API_URL);
    setTestSplit(DEFAULT_TEST_SPLIT);
    setValidationMessage('');
    setConnectionState('idle');
    setConnectionMessage('');

    onThemeChange?.('light');
    setSaved(true);

    window.setTimeout(() => setSaved(false), 2500);
  };

  const handleTestConnection = async () => {
    const error = validateSettings();

    if (error) {
      setValidationMessage(error);
      setConnectionState('error');
      setConnectionMessage('Fix the settings above before testing the connection.');
      return;
    }

    const baseUrl = normalizeUrl(apiUrl);

    setValidationMessage('');
    setConnectionState('testing');
    setConnectionMessage('Connecting to the FastAPI server...');

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${baseUrl}/docs`, {
        method: 'GET',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Server responded with HTTP ${response.status}.`);
      }

      setConnectionState('success');
      setConnectionMessage('Backend is reachable and responding.');
    } catch (err) {
      const message =
        err?.name === 'AbortError'
          ? 'Connection timed out after 5 seconds.'
          : err?.message || 'Could not connect to the backend server.';

      setConnectionState('error');
      setConnectionMessage(message);
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const connectionClass =
    connectionState === 'success'
      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
      : connectionState === 'error'
        ? 'border-red-500/20 bg-red-500/10 text-red-500'
        : connectionState === 'testing'
          ? 'border-blue-500/20 bg-blue-500/10 text-blue-500'
          : isDark
            ? 'border-slate-700 bg-slate-900/50 text-slate-400'
            : 'border-slate-200 bg-slate-50 text-slate-500';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2
          className={`text-2xl font-bold ${
            isDark ? 'text-white' : 'text-slate-800'
          }`}
        >
          Settings
        </h2>

        <p
          className={`text-sm mt-0.5 ${
            isDark ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          Configure your backend connection, ML defaults, and workspace appearance.
        </p>
      </div>

      {validationMessage && (
        <div
          className={`flex items-start gap-3 rounded-xl border p-4 text-xs font-medium ${
            isDark
              ? 'border-red-900/60 bg-red-950/30 text-red-300'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{validationMessage}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Appearance */}
        <section
          className={`rounded-2xl border p-6 shadow-sm ${
            isDark
              ? 'bg-slate-800 border-slate-700'
              : 'bg-white border-slate-100'
          }`}
        >
          <SectionHeader
            icon={isDark ? Moon : Sun}
            title="Appearance"
            description="Choose how the application looks on this device."
            theme={theme}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleSelectTheme('light')}
              className={`flex items-center justify-between gap-3 p-4 rounded-xl border text-left transition ${
                theme === 'light'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : isDark
                    ? 'border-slate-700 text-slate-300 hover:bg-slate-700/50'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Sun size={18} />
                <div>
                  <p className="text-xs font-semibold">Light Mode</p>
                  <p className="text-[11px] opacity-70 mt-0.5">
                    Bright workspace for daytime use.
                  </p>
                </div>
              </div>

              {theme === 'light' && (
                <CheckCircle2 size={16} className="text-blue-600" />
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSelectTheme('dark')}
              className={`flex items-center justify-between gap-3 p-4 rounded-xl border text-left transition ${
                theme === 'dark'
                  ? 'border-blue-500 bg-blue-950/50 text-blue-300'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Moon size={18} />
                <div>
                  <p className="text-xs font-semibold">Dark Mode</p>
                  <p className="text-[11px] opacity-70 mt-0.5">
                    Easier on the eyes in low-light environments.
                  </p>
                </div>
              </div>

              {theme === 'dark' && (
                <CheckCircle2 size={16} className="text-blue-400" />
              )}
            </button>
          </div>
        </section>

        {/* Backend */}
        <section
          className={`rounded-2xl border p-6 shadow-sm ${
            isDark
              ? 'bg-slate-800 border-slate-700'
              : 'bg-white border-slate-100'
          }`}
        >
          <SectionHeader
            icon={Server}
            title="Backend Connection"
            description="Configure the FastAPI server used for uploads, training, analysis, and predictions."
            theme={theme}
          />

          <div className="space-y-3">
            <label
              className={`block text-xs font-semibold ${
                isDark ? 'text-slate-300' : 'text-slate-600'
              }`}
            >
              FastAPI Server URL
            </label>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={apiUrl}
                onChange={(e) => {
                  setApiUrl(e.target.value);
                  setConnectionState('idle');
                  setConnectionMessage('');
                  setValidationMessage('');
                }}
                placeholder={DEFAULT_API_URL}
                className={`flex-1 rounded-xl px-3.5 py-2.5 text-xs font-mono border focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-600'
                    : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
                }`}
              />

              <button
                type="button"
                onClick={handleTestConnection}
                disabled={connectionState === 'testing'}
                className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition disabled:opacity-50 ${
                  isDark
                    ? 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Wifi size={14} />
                {connectionState === 'testing'
                  ? 'Testing...'
                  : 'Test Connection'}
              </button>
            </div>

            <div
              className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[11px] ${connectionClass}`}
            >
              {connectionState === 'success' ? (
                <CheckCircle2 size={14} />
              ) : connectionState === 'error' ? (
                <XCircle size={14} />
              ) : (
                <Server size={14} />
              )}

              <span>
                {connectionMessage ||
                  'The current API URL will be used the next time a request is made.'}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Default: {DEFAULT_API_URL}
            </p>
          </div>
        </section>

        {/* Pipeline */}
        <section
          className={`rounded-2xl border p-6 shadow-sm ${
            isDark
              ? 'bg-slate-800 border-slate-700'
              : 'bg-white border-slate-100'
          }`}
        >
          <SectionHeader
            icon={Sliders}
            title="ML Pipeline"
            description="Set the default held-out test split used when training models."
            theme={theme}
          />

          <div>
            <div className="flex items-center justify-between gap-4 mb-2">
              <div>
                <p
                  className={`text-xs font-semibold ${
                    isDark ? 'text-slate-300' : 'text-slate-600'
                  }`}
                >
                  Test Set Size
                </p>

                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                  Higher values leave less data for training.
                </p>
              </div>

              <span className="text-sm font-bold text-blue-500 whitespace-nowrap">
                {Number(testSplit)}%
              </span>
            </div>

            <input
              type="range"
              min="10"
              max="40"
              step="1"
              value={testSplit}
              onChange={(e) => {
                setTestSplit(Number(e.target.value));
                setSaved(false);
                setValidationMessage('');
              }}
              className="w-full accent-blue-600 cursor-pointer"
            />

            <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-1">
              <span>10%</span>
              <span>20% recommended default</span>
              <span>40%</span>
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleReset}
            className={`inline-flex items-center justify-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl border transition ${
              isDark
                ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <RotateCcw size={14} />
            Reset to Defaults
          </button>

          <div className="flex items-center justify-end gap-3">
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
                <CheckCircle2 size={14} />
                Settings saved
              </span>
            )}

            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-sm transition active:scale-[0.98]"
            >
              <Save size={14} />
              Save Changes
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, description, theme }) {
  return (
    <div
      className={`flex items-start gap-3 border-b pb-4 mb-5 ${
        theme === 'dark' ? 'border-slate-700' : 'border-slate-100'
      }`}
    >
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
          theme === 'dark'
            ? 'bg-blue-950/50 text-blue-400'
            : 'bg-blue-50 text-blue-600'
        }`}
      >
        <Icon size={17} />
      </div>

      <div>
        <h3
          className={`text-sm font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-slate-800'
          }`}
        >
          {title}
        </h3>

        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 leading-5">
          {description}
        </p>
      </div>
    </div>
  );
}

export default SettingsScreen;