import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';

import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import UploadCard from './components/UploadCard';
import Dashboard from './components/Dashboard';
import { getColumns, trainModel, predictSample, downloadModel, getFeatureImportance, getDashboardSummary } from './api';
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

  // Navigates directly to the AI Prediction / Target selection screen
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
    <div className="flex h-screen bg-gray-50">
      <Sidebar active={activeNav} onNavigate={setActiveNav} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {loading && (
            <div className="text-center py-10 text-gray-600 font-medium">
              Running pipeline...
            </div>
          )}

          {/* DASHBOARD PAGE */}
          {activeNav === 'Dashboard' && (
            <>
              {!sessionId && (
                <Dashboard onMakePrediction={handleMakePrediction} />
              )}
              {sessionId && dashboardLoading && (
                <div className="text-center py-16 text-gray-500">Loading dashboard...</div>
              )}
              {sessionId && dashboardError && (
                <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
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
                  onMakePrediction={handleMakePrediction}
                />
              )}
            </>
          )}

          {/* UPLOAD DATA / ML TRAINING FLOW */}
          {activeNav === 'Upload Data' && (
            <>
              {/* STEP 1: Upload File */}
              {!file && <UploadCard onFileSelect={handleFileSelect} />}

              {/* STEP 2: Data Exploration */}
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
                />
              )}

              {/* STEP 3: Model Target Selection */}
              {file && columns && explored && !analysis && (
                <div>
                  <button
                    onClick={() => setExplored(false)}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 transition mb-4"
                  >
                    <ArrowLeft size={14} /> Back to Data Exploration
                  </button>
                  <AIPredictions
                    sessionId={sessionId}
                    columns={columns}
                    onSelectTarget={handleTargetSelect}
                    onSelectTask={(task) => handleTargetSelect(null, task)}
                  />
                </div>
              )}

              {/* STEP 4: Pipeline Results & Model Diagnostics */}
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
                  />

                  {/* Prediction Form & Results */}
                  {selectedModel && (
                    <>
                      <PredictionForm
                        featureInfo={analysis.original_feature_info || []}
                        onPredict={handlePredict}
                        loading={loading}
                      />
                      {prediction && (
                        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                          <h3 className="text-lg font-semibold mb-2">Prediction Result</h3>
                          <p className="text-2xl font-bold text-blue-600">
                            {prediction.predicted_class ?? prediction.prediction}
                          </p>
                          {prediction.confidence && (
                            <p className="text-sm text-gray-500 mt-1">
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
        </main>
      </div>
    </div>
  );
}

export default App;