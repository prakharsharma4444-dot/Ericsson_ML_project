import { useState } from 'react';
import { Rows3, Columns3, Hash, CheckCircle2, Download, ArrowLeft } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';


import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import StatCard from './components/StatCard';
import UploadCard from './components/UploadCard';
import ModelSelectionScreen from './components/ModelSelectionScreen';
import { getColumns, trainModel, predictSample } from './api';
import PredictionForm from './components/PredictionForm';
import DataExploreScreen from './components/DataExploreScreen';

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

const handleDownload = async () => {
  if (!selectedModel) return;
  try {
    await downloadModel(sessionId, selectedModel.model);
  } catch (err) {
    setError(err.message);
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

  // Helper to safely extract models list from analysis
  const getModelsList = () => {
    if (!analysis) return [];
    const raw = analysis.models || analysis.results || analysis.comparison;
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object') return Object.values(raw);
    return [];
  };

  const modelsList = getModelsList();

  // Helper to format feature importances for Recharts
 const getFeatureImportanceData = () => {
  if (!featureImportance) return [];
  return [...featureImportance]
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 8);
};
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
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
              <ModelSelectionScreen 
  columns={columns} 
  onSelectTarget={handleTargetSelect} 
  onSelectTask={(task) => handleTargetSelect(null, task)}
/>
            </div>
          )}

          {/* STEP 4: Pipeline Results & Model Diagnostics */}
          {analysis && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setAnalysis(null)}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 transition"
                >
                  <ArrowLeft size={14} /> Back to Target Selection
                </button>
                <h2 className="text-xl font-bold text-gray-800">Pipeline Results</h2>
              </div>
              
              {/* Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard 
                  label="Problem Type" 
                  value={analysis.problem_type?.toUpperCase()} 
                  icon={Hash}
                  iconBg="bg-blue-50"
                  iconColor="text-blue-500"
                />
                <StatCard 
                  label="Initial Shape" 
                  value={analysis.clean_report?.initial_shape ? analysis.clean_report.initial_shape.join(' × ') : 'N/A'} 
                  icon={Rows3}
                  iconBg="bg-purple-50"
                  iconColor="text-purple-500"
                />
                <StatCard 
                  label="Final Shape" 
                  value={analysis.clean_report?.final_shape ? analysis.clean_report.final_shape.join(' × ') : 'N/A'} 
                  icon={Columns3}
                  iconBg="bg-green-50"
                  iconColor="text-green-500"
                />
              </div>

              {/* Data Cleaning Actions */}
              {analysis.clean_report?.actions_taken && analysis.clean_report.actions_taken.length > 0 && (
                <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                  <h3 className="text-lg font-semibold mb-3 text-gray-800">Data Cleaning Actions</h3>
                  <ul className="list-disc pl-5 space-y-2 text-gray-600">
                    {analysis.clean_report.actions_taken.map((action, index) => (
                      <li key={index}>{action}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Interactive Model Performance Table */}
              {modelsList.length > 0 && (
                <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">Model Performance</h3>
                    {selectedModel && (
                      <span className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium flex items-center gap-1">
                        <CheckCircle2 size={16} /> Selected: {selectedModel.model}
                      </span>
                    )}
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 text-gray-500 text-sm">
                          <th className="pb-3 px-3">Model</th>
                          {analysis.problem_type === 'classification' ? (
                            <>
                              <th className="pb-3 px-3">Accuracy</th>
                              <th className="pb-3 px-3">Precision</th>
                              <th className="pb-3 px-3">Recall</th>
                              <th className="pb-3 px-3">F1</th>
                            </>
                          ) : (
                            <>
                              <th className="pb-3 px-3">R² Score</th>
                              <th className="pb-3 px-3">MAE</th>
                              <th className="pb-3 px-3">RMSE</th>
                            </>
                          )}
                          <th className="pb-3 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {modelsList.map((item, idx) => {
                          const isSelected = selectedModel?.model === item.model;
                          return (
                            <tr 
                              key={idx} 
                              className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}
                            >
                              <td className="py-3 px-3 font-semibold text-gray-800">{item.model}</td>
                              {analysis.problem_type === 'classification' ? (
                                <>
                                  <td className="py-3 px-3 text-gray-700 font-medium">
                                    {item.accuracy !== undefined ? (item.accuracy * 100).toFixed(2) + '%' : 'N/A'}
                                  </td>
                                  <td className="py-3 px-3 text-gray-600">
                                    {item.precision !== undefined ? (item.precision * 100).toFixed(2) + '%' : 'N/A'}
                                  </td>
                                  <td className="py-3 px-3 text-gray-600">
                                    {item.recall !== undefined ? (item.recall * 100).toFixed(2) + '%' : 'N/A'}
                                  </td>
                                  <td className="py-3 px-3 text-gray-600">
                                    {item.f1 !== undefined ? (item.f1 * 100).toFixed(2) + '%' : 'N/A'}
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="py-3 px-3 text-gray-700 font-medium">
                                    {item.r2 !== undefined ? (item.r2 * 100).toFixed(2) + '%' : 'N/A'}
                                  </td>
                                  <td className="py-3 px-3 text-gray-600">
                                    {item.mae !== undefined ? Math.round(item.mae).toLocaleString() : 'N/A'}
                                  </td>
                                  <td className="py-3 px-3 text-gray-600">
                                    {item.rmse !== undefined ? Math.round(item.rmse).toLocaleString() : 'N/A'}
                                  </td>
                                </>
                              )}
                              <td className="py-3 px-3 text-right">
                                <button
                                  onClick={() => handleSelectModel(item)}
                                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                    isSelected 
                                      ? 'bg-blue-600 text-white shadow-sm' 
                                      : 'bg-gray-100 hover:bg-blue-50 text-gray-700 hover:text-blue-600'
                                  }`}
                                >
                                  {isSelected ? 'Selected' : 'Select Model'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Model Comparison Bar Chart */}
              {modelsList.length > 0 && (
                <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-800 mb-1">Model Visual Comparison</h3>
                  <p className="text-xs text-gray-500 mb-4">Comparing primary metrics across models</p>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={modelsList} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="model" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip 
                          formatter={(val) => [`${(Number(val) * (analysis.problem_type === 'classification' || val <= 1 ? 100 : 1)).toFixed(2)}%`, 'Metric']}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        {analysis.problem_type === 'classification' ? (
                          <>
                            <Bar dataKey="accuracy" name="Accuracy" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="f1" name="F1 Score" fill="#10b981" radius={[4, 4, 0, 0]} />
                          </>
                        ) : (
                          <Bar dataKey="r2" name="R² Score" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Feature Importance Chart */}
              {featureImportance && featureImportance.length > 0 && (
                <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-800 mb-1">Top Feature Importances</h3>
                  <p className="text-xs text-gray-500 mb-4">Features driving model decisions</p>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        layout="vertical"
                        data={getFeatureImportanceData()} 
                        margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="feature" type="category" tick={{ fontSize: 11 }} width={120} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey="importance" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Active Selected Model & Download Panel */}
              {selectedModel && (
                <div className="bg-blue-50/60 border border-blue-200 p-6 rounded-xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Active Selected Model</span>
                    <h3 className="text-xl font-bold text-gray-800 mt-0.5">{selectedModel.model}</h3>
                    <p className="text-xs text-gray-600 mt-1">
                      Ready for custom sample predictions below or downloading weights.
                    </p>
                  </div>

              <button 
  onClick={handleDownload}
  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-sm text-sm transition-all flex items-center gap-2"
>
  <Download size={18} />
  Download Model (.joblib)
</button>
                </div>
              )}

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
        </main>
      </div>
    </div>
  );
}

export default App;