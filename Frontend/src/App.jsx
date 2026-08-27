import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';

import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import UploadCard from './components/UploadCard';
import Dashboard from './components/Dashboard';
import GenericDashboard from './components/GenericDashboard';
import HistoryScreen from './components/HistoryScreen';
import SettingsScreen from './components/SettingsScreen';
import {
  getColumns,
  trainModel,
  predictSample,
  getFeatureImportance,
  getDashboardSummary,
  mergeDatasets,
  selectSheet
} from './api';
import PredictionForm from './components/PredictionForm';
import DataExploreScreen from './components/DataExploreScreen';
import AIPredictions from './components/AIPredictions';
import PipelineResults from './components/PipelineResults';

function App() {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
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

  // Filters — lifted up so both TopBar (the dropdown UI) and Dashboard
  // (the actual filtering logic) can share the same state.
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterSeverities, setFilterSeverities] = useState([]);
  const [filterRegions, setFilterRegions] = useState([]);
  const [filterTeams, setFilterTeams] = useState([]);
  const [availableSheets, setAvailableSheets] = useState([]);
const [activeSheet, setActiveSheet] = useState(null);
const [sheetLoading, setSheetLoading] = useState(false);

  const handleClearAllFilters = () => {
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterSeverities([]);
    setFilterRegions([]);
    setFilterTeams([]);
    setSearchQuery('');
  };

  // --- Merge feature state ---
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState([]);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [combineType, setCombineType] = useState('concat'); // 'concat' = stack rows, 'join' = relational join

  const [theme, setTheme] = useState(() => {
    const saved = JSON.parse(localStorage.getItem('app_settings') || '{}');
    return saved.theme || 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    const settings = JSON.parse(localStorage.getItem('app_settings') || '{}');
    localStorage.setItem('app_settings', JSON.stringify({ ...settings, theme: newTheme }));
  };

  // Robust dashboard loader with fallback to prevent sidebar lockups
  useEffect(() => {
    if (activeNav === 'Dashboard') {
      if (!sessionId) {
        setDashboardData(null);
        setDashboardLoading(false);
        return;
      }
      setDashboardLoading(true);
      setDashboardError(null);
      getDashboardSummary(sessionId)
        .then((data) => {
          setDashboardData(data);
        })
        .catch((err) => {
          console.warn('Dashboard summary fetch failed, using fallback view:', err.message);
          setDashboardData(null); // Will gracefully fallback to default metrics in Dashboard component
        })
        .finally(() => {
          setDashboardLoading(false);
        });
    }
  }, [activeNav, sessionId, activeSheet]);

  const handleNewAnalysis = () => {
    setActiveFileId(null);
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

  const handleFileSelect = async (selectedFiles) => {
    const filesArray = Array.isArray(selectedFiles) ? selectedFiles : [selectedFiles];

    const newFiles = filesArray.map(file => ({
      id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fileData: file,
      name: file.name,
      size: file.size,
      type: file.name.split('.').pop()
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);
    setError(null);

    // FIX: uploadedFiles state hasn't updated yet at this point (setState is async),
    // so we pass the freshly-built array directly instead of relying on stale state.
    if (!activeFileId && newFiles.length > 0) {
      handleMakeFileActive(newFiles[0].id, newFiles);
    }
  };

  // FIX: accepts an optional filesList param so callers with fresher data
  // (like handleFileSelect right after an upload) can bypass stale state.
  const handleMakeFileActive = async (fileId, filesList = uploadedFiles) => {
    setActiveFileId(fileId);
    const selected = filesList.find(f => f.id === fileId);
    if (!selected) return;

    setLoading(true);
    setError(null);
    setExplored(false);
    setAnalysis(null);

    try {
      const data = await getColumns(selected.fileData);
      setSessionId(data.sessionId);
      setColumns(data.columns);
      setAvailableSheets(data.sheets || []);
setActiveSheet(data.activeSheet || null);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const handleSheetChange = async (sheetName) => {
  if (!sessionId || !sheetName || sheetName === activeSheet) return;

  setSheetLoading(true);
  setError(null);

  // Reset everything tied to the previous sheet.
setExplored(false);
setAnalysis(null);
setSelectedModel(null);
setPrediction(null);
setFeatureImportance(null);
setDashboardData(null);

  try {
    const data = await selectSheet(sessionId, sheetName);

    setActiveSheet(data.active_sheet);
    setColumns(
      Array.isArray(data.columns)
        ? data.columns.map(c =>
            typeof c === 'object' && c !== null ? c.name : c
          )
        : []
    );
  } catch (err) {
    console.error(err);
    setError(err.message || 'Failed to switch worksheet.');
  } finally {
    setSheetLoading(false);
  }
};

  // --- Merge feature handlers ---
  const handleToggleMergeMode = () => {
    setMergeMode(prev => !prev);
    setSelectedForMerge([]);
    setCombineType('concat');
  };

  const handleToggleMergeSelect = (fileId) => {
    setSelectedForMerge(prev => {
      if (prev.includes(fileId)) {
        return prev.filter(id => id !== fileId);
      }
      if (prev.length >= 2) {
        // Only allow two files selected at a time; replace the oldest pick
        return [prev[1], fileId];
      }
      return [...prev, fileId];
    });
  };

  const handleCombineFiles = async () => {
    if (selectedForMerge.length !== 2) return;

    const [firstId, secondId] = selectedForMerge;
    const fileA = uploadedFiles.find(f => f.id === firstId);
    const fileB = uploadedFiles.find(f => f.id === secondId);
    if (!fileA || !fileB) return;

    setMergeLoading(true);
    setError(null);

    try {
      const result = await mergeDatasets(fileA.fileData, fileB.fileData, combineType);

      // Backend returns a new merged file (as a blob/csv) plus a suggested name.
      // We wrap it the same way as any other uploaded file so it slots into
      // the existing "Your Datasets" list and active-file flow.
      const mergedFile = {
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        fileData: result.file,
        name: result.name || `${fileA.name.split('.')[0]}_${fileB.name.split('.')[0]}_${combineType === 'join' ? 'joined' : 'combined'}.csv`,
        size: result.file.size,
        type: 'csv',
      };

      setUploadedFiles(prev => [...prev, mergedFile]);
      setMergeMode(false);
      setSelectedForMerge([]);

      // Automatically switch to the newly merged dataset
      handleMakeFileActive(mergedFile.id, [...uploadedFiles, mergedFile]);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to merge datasets. Make sure both files share a common column.');
    } finally {
      setMergeLoading(false);
    }
  };

  const handleTargetSelect = async (targetCol, task = null) => {
    setLoading(true);
    setError(null);
    try {

      const result = await trainModel(sessionId, targetCol, task);
      setAnalysis(result);
      

      const activeFile = uploadedFiles.find(f => f.id === activeFileId);

      const problemType = result?.problem_type || result?.problemType || 'unknown';
      const recommendedModelName =
        result?.recommended_model ||
        result?.best_model ||
        'Trained Model';

      const modelRows = Array.isArray(result?.results) ? result.results : [];
      const cvRows = Array.isArray(result?.cv_results) ? result.cv_results : [];

      const selectedResult = modelRows.find(
        row => row?.model === recommendedModelName
      ) || {};

      const selectedCvResult = cvRows.find(
        row => row?.model === recommendedModelName
      ) || {};

      const isClassification = problemType === 'classification';

      const testMetricValue = isClassification
        ? (
            selectedResult?.f1_macro ??
            selectedResult?.f1 ??
            selectedResult?.accuracy ??
            null
          )
        : (
            selectedResult?.r2 ??
            selectedResult?.R2 ??
            null
          );

      const cvMetricValue = isClassification
        ? (
            selectedCvResult?.cv_f1_macro_mean ??
            selectedCvResult?.f1_macro ??
            null
          )
        : (
            selectedCvResult?.cv_r2_mean ??
            selectedCvResult?.r2 ??
            null
          );

      const metricName = isClassification
        ? 'Macro F1'
        : 'R²';

      const formatMetric = (value) =>
        typeof value === 'number' && Number.isFinite(value)
          ? `${(value * 100).toFixed(1)}%`
          : 'N/A';

      const newRun = {
        id: `RUN-${Date.now().toString().slice(-6)}`,
        dataset: activeFile?.name || 'Dataset.csv',
        target: targetCol || result?.target_col || 'Auto Target',
        task: task || null,
        problemType,
        model: recommendedModelName,
        metricName,
        metricValue: formatMetric(testMetricValue),
        cvMetricName: `CV ${metricName}`,
        cvMetricValue: formatMetric(cvMetricValue),
        accuracy: formatMetric(
          selectedResult?.accuracy
        ),
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
      if (sessionId && item?.model) {
        const fi = await getFeatureImportance(sessionId, item.model);

        if (fi.supported) {
          setFeatureImportance(fi.importances);
        }
      }
    } catch (err) {
      console.error('Feature importance fetch failed:', err);
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
    if (activeFileId && columns) {
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
      theme === 'dark' ? 'bg-slate-900 text-slate-100 dark' : 'bg-slate-50 text-slate-900'
    }`}>
      <Sidebar
        active={activeNav}
        onNavigate={setActiveNav}
        onNewAnalysis={handleNewAnalysis}
        theme={theme}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          searchQuery={searchQuery} onSearchChange={setSearchQuery}
          startDate={filterStartDate} setStartDate={setFilterStartDate}
          endDate={filterEndDate} setEndDate={setFilterEndDate}
          selectedSeverities={filterSeverities} setSelectedSeverities={setFilterSeverities}
          selectedRegions={filterRegions} setSelectedRegions={setFilterRegions}
          selectedTeams={filterTeams} setSelectedTeams={setFilterTeams}
          onClearAllFilters={handleClearAllFilters}
          theme={theme}
        />
        <main className={`flex-1 overflow-y-auto p-6 ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'}`}>
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl text-xs font-semibold">
              {error}
            </div>
          )}

          {loading && (
            <div className={`text-center py-10 font-medium text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              Running pipeline...
            </div>
          )}

          {/* DASHBOARD TAB */}
          {activeNav === 'Dashboard' && (
            <>
              {dashboardLoading ? (
                <div className="text-center py-16 text-slate-500 dark:text-slate-400 text-xs font-medium">
                  Loading dashboard overview...
                </div>
              ) : dashboardData?.datasetType === 'generic' ? (
                <GenericDashboard
                  data={dashboardData?.generic}
                  onExplore={() => setActiveNav('Upload Data')}
                  onPredict={handleMakePrediction}
                />
              ) : (
                <Dashboard
                  summary={dashboardData?.summary}
                  priorityData={dashboardData?.priorityData}
                  statusData={dashboardData?.statusData}
                  recentCases={dashboardData?.recentCases}
                  attentionCases={dashboardData?.attentionCases}
                  volumeData={dashboardData?.volumeData}
                  searchQuery={searchQuery}
                  onClearSearch={() => setSearchQuery('')}
                  onMakePrediction={handleMakePrediction}
                  startDate={filterStartDate}
                  endDate={filterEndDate}
                  selectedSeverities={filterSeverities}
                  selectedRegions={filterRegions}
                  selectedTeams={filterTeams}
                  onClearAllFilters={handleClearAllFilters}
                  theme={theme}
                />
              )}
            </>
          )}

          {/* UPLOAD DATA TAB */}
          {activeNav === 'Upload Data' && (
            <>
              {uploadedFiles.length === 0 && (
                <UploadCard onFileSelect={handleFileSelect} theme={theme} />
              )}

              {uploadedFiles.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold dark:text-slate-200">Your Datasets</h3>
                    <div className="flex items-center gap-2">
                      {mergeMode && (
                        <button
                          onClick={handleCombineFiles}
                          disabled={selectedForMerge.length !== 2 || mergeLoading}
                          className="text-xs font-medium bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {mergeLoading ? 'Combining...' : `Combine (${selectedForMerge.length}/2)`}
                        </button>
                      )}
                      <button
                        onClick={handleToggleMergeMode}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg transition ${
                          mergeMode
                            ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                            : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 hover:bg-indigo-200'
                        }`}
                      >
                        {mergeMode ? 'Cancel' : 'Merge Datasets'}
                      </button>
                    </div>
                  </div>

                  {mergeMode && (
                    <div className="mb-3">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                        Select two datasets, choose how to combine them, then hit Combine.
                      </p>
                      <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-xs font-medium">
                        <button
                          onClick={() => setCombineType('concat')}
                          className={`px-3 py-1.5 transition ${
                            combineType === 'concat'
                              ? 'bg-blue-600 text-white'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                          }`}
                        >
                          Stack Rows (bigger dataset)
                        </button>
                        <button
                          onClick={() => setCombineType('join')}
                          className={`px-3 py-1.5 transition border-l border-slate-200 dark:border-slate-700 ${
                            combineType === 'join'
                              ? 'bg-blue-600 text-white'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                          }`}
                        >
                          Join on Column
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">
                        {combineType === 'concat'
                          ? 'Best when both files have the same columns — appends one dataset\'s rows after the other.'
                          : 'Best when both files describe the same records but hold different info — matches rows using a shared key column (auto-detected).'}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    {uploadedFiles.map(f => {
                      const isSelectedForMerge = selectedForMerge.includes(f.id);
                      return (
                        <button
                          key={f.id}
                          onClick={() => mergeMode ? handleToggleMergeSelect(f.id) : handleMakeFileActive(f.id)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                            mergeMode
                              ? (isSelectedForMerge
                                  ? 'bg-green-600 text-white border-green-600 shadow-md'
                                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-green-400')
                              : (activeFileId === f.id
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400')
                          }`}
                        >
                          {f.name}
                        </button>
                      );
                    })}

                    {!mergeMode && (
                      <label className="px-4 py-2 rounded-lg text-sm font-medium border border-dashed border-slate-400 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition">
                        + Add Data
                        <input type="file" accept=".csv, .xlsx, .xls" multiple className="hidden" onChange={(e) => handleFileSelect(Array.from(e.target.files))} />
                      </label>
                    )}
                  </div>
                </div>
              )}
              {activeFileId && availableSheets.length > 1 && (
  <div className="mb-5">
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Workbook Sheet
        </p>

        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Choose which worksheet to analyze.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={activeSheet || ''}
          onChange={(e) => handleSheetChange(e.target.value)}
          disabled={sheetLoading}
          className="min-w-[220px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500"
        >
          {availableSheets.map((sheet) => (
            <option key={sheet.name} value={sheet.name}>
              {sheet.name} · {sheet.n_rows.toLocaleString()} rows · {sheet.n_cols} cols
            </option>
          ))}
        </select>

        {sheetLoading && (
          <span className="text-xs text-slate-400">
            Switching...
          </span>
        )}
      </div>
    </div>
  </div>
)}

              {activeFileId && columns && !explored && !analysis && (
                <DataExploreScreen
                key={`${sessionId}-${activeSheet}`}
                  sessionId={sessionId}
                  columns={columns}
                  onContinue={() => setExplored(true)}
                  onBack={() => {
                    setActiveFileId(null);
                    setColumns(null);
                    setSessionId(null);
                  }}
                  theme={theme}
                />
              )}

              {activeFileId && columns && explored && !analysis && (
                <div>
                  <button
                    onClick={() => setExplored(false)}
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition mb-4"
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
                    finalShape={`${analysis.clean_report?.final_shape?.[0] ?? analysis.final_shape?.[0] ?? 'N/A'} × ${analysis.clean_report?.final_shape?.[1] ?? analysis.final_shape?.[1] ?? 'N/A'}`}
                    results={analysis.results || modelsList}
                    cvResults={analysis.cv_results || []}
                    recommendedModel={analysis.recommended_model}
                    selectedModel={selectedModel}
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
  <div
    className={`p-6 rounded-xl shadow-sm border ${
      theme === 'dark'
        ? 'bg-slate-800 border-slate-700'
        : 'bg-white border-slate-100'
    }`}
  >
    <h3
      className={`text-lg font-semibold mb-2 ${
        theme === 'dark' ? 'text-slate-100' : 'text-slate-800'
      }`}
    >
      Prediction Result
    </h3>

    <p className="text-2xl font-bold text-blue-600">
      {prediction.predicted_class ?? prediction.prediction}
    </p>

    {prediction.confidence !== undefined && (
      <p
        className={`text-sm mt-1 ${
          theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
        }`}
      >
        Confidence: {(prediction.confidence * 100).toFixed(1)}%
      </p>
    )}

    {prediction.class_probabilities &&
      prediction.class_labels &&
      prediction.class_probabilities.length === prediction.class_labels.length && (
        <div className="mt-5">
          <p
            className={`text-sm font-semibold mb-3 ${
              theme === 'dark' ? 'text-slate-200' : 'text-slate-700'
            }`}
          >
            Prediction Breakdown
          </p>

          <div className="space-y-3">
            {prediction.class_labels.map((label, index) => {
              const probability =
                prediction.class_probabilities[index] * 100;

              return (
                <div key={label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span
                      className={`font-medium ${
                        theme === 'dark'
                          ? 'text-slate-300'
                          : 'text-slate-600'
                      }`}
                    >
                      {label}
                    </span>

                    <span
                      className={
                        theme === 'dark'
                          ? 'text-slate-400'
                          : 'text-slate-500'
                      }
                    >
                      {probability.toFixed(1)}%
                    </span>
                  </div>

                  <div
                    className={`w-full h-2 rounded-full overflow-hidden ${
                      theme === 'dark'
                        ? 'bg-slate-700'
                        : 'bg-slate-200'
                    }`}
                  >
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all duration-500"
                      style={{ width: `${probability}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
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