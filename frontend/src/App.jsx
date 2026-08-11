import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';

import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import UploadCard from './components/UploadCard';
import Dashboard from './components/Dashboard';
import HistoryScreen from './components/HistoryScreen';
import SettingsScreen from './components/SettingsScreen';
import { getColumns, trainModel, predictSample, getFeatureImportance, getDashboardSummary } from './api';
import PredictionForm from './components/PredictionForm';
import DataExploreScreen from './components/DataExploreScreen';
import AIPredictions from './components/AIPredictions';
import PipelineResults from './components/PipelineResults';

function App() {
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [explored, setExplored] = useState(false);
  const [featureImportance, setFeatureImportance] = useState(null);
  const [activeNav, setActiveNav] = useState('Dashboard');
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Read theme synchronously on initial load so it never resets when switching tabs
  const [theme, setTheme] = useState(() => {
    const saved = JSON.parse(localStorage.getItem('app_settings') || '{}');
    return saved.theme || 'light';
  });

  // 2. Synchronize 'dark' class on HTML document root for global Tailwind dark mode
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // 3. Immediately persist theme change to localStorage
  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    const settings = JSON.parse(localStorage.getItem('app_settings') || '{}');
    localStorage.setItem('app_settings', JSON.stringify({ ...settings, theme: newTheme }));
  };

  useEffect(() => {
    if (activeNav === 'Dashboard' && sessionId) {
      setDashboardLoading(true);
      setDashboardError(null);
      getDashboardSummary(sessionId)
        .then(setDashboardData)
        .catch((err) => setDashboardError(err.message))
        .finally(() => setDashboardLoading(false));
    }
  }, [activeNav, sessionId]);

  const handleNewAnalysis = () => {
    setFile(null);
    setColumns(null);
    setAnalysis(null);
    setSelectedModel(null);
    setSessionId(null);
    setPrediction(null);
    setExplored(false);
    setFeatureImportance(null);
    setError(null);
    setActiveNav('Upload Data');
  };

  const handleFileSelect = async (selectedFile) => {
    setFile(selectedFile);
    setError(null);
    setLoading(true);
    try {
      const data = await getColumns(selectedFile);
      setSessionId(data.sessionId);
      setColumns(data.columns);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTargetSelect = async (targetCol, task = null) => {
    setLoading(true);
    setError(null);
    try {
      const result = await trainModel(sessionId, targetCol, task);
      setAnalysis(result);

      const newRun = {
        id: `RUN-${Date.now().toString().slice(-6)}`,
        dataset: file?.name || 'Dataset.csv',
        target: targetCol || 'Auto Target',
        model: result?.best_model || result?.problem_type || 'Trained Model',
        accuracy: result?.metrics?.accuracy ? `${(result.metrics.accuracy * 100).toFixed(1)}%` : 'Completed',
        date: new Date().toLocaleString(),
        status: 'Completed',
      };

      const existingHistory = JSON.parse(localStorage.getItem('ml_history') || '[]');
      localStorage.setItem('ml_history', JSON.stringify([newRun, ...existingHistory]));
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectModel = async (item) => {
    setSelectedModel(item);
    setPrediction(null);
    setFeatureImportance(null);
    try {
      const fi = await getFeatureImportance(sessionId, item.model);
      if (fi.supported) {
        setFeatureImportance(fi.importances);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePredict = async (sample) => {
    setLoading(true);
    setError(null);
    try {
      const result = await predictSample(sessionId, selectedModel.model, sample);
      setPrediction(result);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleMakePrediction = () => {
    setActiveNav('Upload Data');
    if (file && columns) {
      setExplored(true);
      setAnalysis(null);
    }
  };

  const getModelsList = () => {
    if (!analysis) return [];
    const raw = analysis.models || analysis.results || analysis.comparison;
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object') return Object.values(raw);
    return [];
  };

  const modelsList = getModelsList();

  return (
    <div className={`flex h-screen overflow-hidden transition-colors duration-200 ${
      theme === 'dark' ? 'bg-slate-900 text-slate-100 dark' : 'bg-gray-50 text-slate-900'
    }`}>
      <Sidebar
        active={activeNav}
        onNavigate={setActiveNav}
        onNewAnalysis={handleNewAnalysis}
        theme={theme}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar searchQuery={searchQuery} onSearchChange={setSearchQuery} theme={theme} />
        <main className={`flex-1 overflow-y-auto p-6 ${theme === 'dark' ? 'bg-slate-900' : 'bg-gray-50'}`}>
          {error && (
            <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg text-xs font-semibold">
              {error}
            </div>
          )}

          {loading && (
            <div className={`text-center py-10 font-medium text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              Running pipeline...
            </div>
          )}

          {/* DASHBOARD TAB */}
          {activeNav === 'Dashboard' && (
            <>
              {!sessionId && (
                <Dashboard
                  searchQuery={searchQuery}
                  onClearSearch={() => setSearchQuery('')}
                  onMakePrediction={handleMakePrediction}
                  theme={theme}
                />
              )}
              {sessionId && dashboardLoading && (
                <div className="text-center py-16 text-gray-500 text-xs">Loading dashboard...</div>
              )}
              {sessionId && dashboardError && (
                <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg text-xs">
                  {dashboardError}
                </div>
              )}
              {sessionId && dashboardData && !dashboardLoading && (
                <Dashboard
                  summary={dashboardData.summary}
                  priorityData={dashboardData.priorityData}
                  statusData={dashboardData.statusData}
                  recentCases={dashboardData.recentCases}
                  attentionCases={dashboardData.attentionCases}
                  volumeData={dashboardData.volumeData}
                  searchQuery={searchQuery}
                  onClearSearch={() => setSearchQuery('')}
                  onMakePrediction={handleMakePrediction}
                  theme={theme}
                />
              )}
            </>
          )}

          {/* UPLOAD DATA TAB */}
          {activeNav === 'Upload Data' && (
            <>
              {!file && <UploadCard onFileSelect={handleFileSelect} theme={theme} />}

              {file && columns && !explored && !analysis && (
                <DataExploreScreen
                  sessionId={sessionId}
                  columns={columns}
                  onContinue={() => setExplored(true)}
                  onBack={() => {
                    setFile(null);
                    setColumns(null);
                    setSessionId(null);
                  }}
                  theme={theme}
                />
              )}

              {file && columns && explored && !analysis && (
                <div>
                  <button
                    onClick={() => setExplored(false)}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200 transition mb-4"
                  >
                    <ArrowLeft size={14} /> Back to Data Exploration
                  </button>
                  <AIPredictions
                    sessionId={sessionId}
                    columns={columns}
                    onSelectTarget={handleTargetSelect}
                    onSelectTask={(task) => handleTargetSelect(null, task)}
                    theme={theme}
                  />
                </div>
              )}

              {analysis && (
                <div className="space-y-6">
                  <PipelineResults
                    problemType={analysis.problem_type}
                    initialShape={`${analysis.clean_report?.initial_shape?.[0] ?? analysis.initial_shape?.[0] ?? 'N/A'} × ${analysis.clean_report?.initial_shape?.[1] ?? analysis.initial_shape?.[1] ?? 'N/A'}`}
                    finalShape={`${analysis.clean_report?.final_shape?.[0] ?? analysis.final_shape?.[0] ?? 'N/A'} × ${analysis.final_shape?.[1] ?? analysis.final_shape?.[1] ?? 'N/A'}`}
                    results={analysis.results || modelsList}
                    onSelectModel={handleSelectModel}
                    onBack={() => {
                      setAnalysis(null);
                      setSelectedModel(null);
                      setPrediction(null);
                      setFeatureImportance(null);
                    }}
                    theme={theme}
                  />

                  {selectedModel && (
                    <>
                      <PredictionForm
                        featureInfo={analysis.original_feature_info || []}
                        onPredict={handlePredict}
                        loading={loading}
                        theme={theme}
                      />
                      {prediction && (
                        <div className={`p-6 rounded-xl shadow-sm border ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
                          <h3 className="text-lg font-semibold mb-2">Prediction Result</h3>
                          <p className="text-2xl font-bold text-blue-600">
                            {prediction.predicted_class ?? prediction.prediction}
                          </p>
                          {prediction.confidence && (
                            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                              Confidence: {(prediction.confidence * 100).toFixed(1)}%
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* HISTORY TAB */}
          {activeNav === 'History' && <HistoryScreen theme={theme} />}

          {/* SETTINGS TAB */}
          {activeNav === 'Settings' && (
            <SettingsScreen theme={theme} onThemeChange={handleThemeChange} />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;