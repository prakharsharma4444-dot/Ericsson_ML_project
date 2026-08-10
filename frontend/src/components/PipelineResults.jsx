import { ArrowLeft, Info, Rows3, Columns3, Hash } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const MODEL_DESCRIPTIONS = {
  'Logistic Regression': 'A reliable algorithm for binary/multiclass outcomes that calculates the probability of a class based on input variables.',
  'Random Forest': 'An ensemble method that combines multiple decision trees to improve accuracy and control over-fitting.',
  'Gradient Boosting': 'A powerful technique that builds models sequentially, with each new model correcting errors made by previous ones.',
  'Support Vector Classifier': 'A robust model that finds the optimal boundary to separate different categories in high-dimensional data.',
  'Ridge Regression': 'A linear model that shrinks coefficients to reduce overfitting, well-suited for correlated features.',
  'Huber Regression (Robust)': 'A regression model that reduces sensitivity to outliers compared to standard linear regression.',
  'Support Vector Regressor': 'Finds a function that fits the data within a margin of tolerance, robust to moderate outliers.',
  'Random Forest (Tuned)': 'An ensemble of decision trees with hyperparameters tuned for this dataset.',
  'Gradient Boosting (Tuned)': 'A sequential ensemble method with hyperparameters tuned for this dataset.',
};

function PipelineResults({ problemType, initialShape, finalShape, results = [], onSelectModel, onBack }) {
  const isClassification = problemType === 'classification';

  const chartData = results.map((r) => ({
    model: r.model,
    primary: isClassification ? r.accuracy : r.r2 ?? r.r2_score,
    secondary: isClassification ? r.f1 : r.mae,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition">
          <ArrowLeft size={14} /> Back to Prediction Selection
        </button>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Pipeline Results</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Problem Type</p>
            <div className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center">
              <Hash size={14} className="text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-lg font-bold text-slate-800 dark:text-slate-100 uppercase">{problemType}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Initial Shape</p>
            <div className="w-7 h-7 rounded-full bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center">
              <Rows3 size={14} className="text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{initialShape}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Final Shape</p>
            <div className="w-7 h-7 rounded-full bg-green-50 dark:bg-green-950/50 flex items-center justify-center">
              <Columns3 size={14} className="text-green-600 dark:text-green-400" />
            </div>
          </div>
          <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{finalShape}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 transition-colors">
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-4">Model Performance</h3>

        <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 rounded-lg p-3 mb-5">
          <Info size={16} className="text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-800 dark:text-blue-200">
            <span className="font-semibold">Model Overview: </span>
            These models analyze your dataset to predict outcomes based on historical patterns. Each score below represents a
            different aspect of how well the model performed, helping you identify the most reliable predictor for your specific use case.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <th className="pb-2.5 font-medium">Model</th>
                <th className="pb-2.5 font-medium">Description</th>
                {isClassification ? (
                  <>
                    <th className="pb-2.5 font-medium">Accuracy</th>
                    <th className="pb-2.5 font-medium">Precision</th>
                    <th className="pb-2.5 font-medium">Recall</th>
                    <th className="pb-2.5 font-medium">F1</th>
                  </>
                ) : (
                  <>
                    <th className="pb-2.5 font-medium">R² Score</th>
                    <th className="pb-2.5 font-medium">MAE</th>
                    <th className="pb-2.5 font-medium">RMSE</th>
                  </>
                )}
                <th className="pb-2.5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.model} className="border-b border-slate-50 dark:border-slate-800/60 last:border-0 align-top">
                  <td className="py-3.5 font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">{r.model}</td>
                  <td className="py-3.5 text-slate-500 dark:text-slate-400 text-xs max-w-xs pr-4">
                    {MODEL_DESCRIPTIONS[r.model] || 'A machine learning model trained on this dataset.'}
                  </td>
                  {isClassification ? (
                    <>
                      <td className="py-3.5 font-medium text-slate-700 dark:text-slate-300">{(r.accuracy * 100).toFixed(2)}%</td>
                      <td className="py-3.5 font-medium text-slate-700 dark:text-slate-300">{(r.precision * 100).toFixed(2)}%</td>
                      <td className="py-3.5 font-medium text-slate-700 dark:text-slate-300">{(r.recall * 100).toFixed(2)}%</td>
                      <td className="py-3.5 font-medium text-slate-700 dark:text-slate-300">{(r.f1 * 100).toFixed(2)}%</td>
                    </>
                  ) : (
                    <>
                      <td className="py-3.5 font-medium text-slate-700 dark:text-slate-300">{((r.r2 ?? r.r2_score) * 100).toFixed(2)}%</td>
                      <td className="py-3.5 font-medium text-slate-700 dark:text-slate-300">{r.mae?.toFixed(0)}</td>
                      <td className="py-3.5 font-medium text-slate-700 dark:text-slate-300">{r.rmse?.toFixed(0)}</td>
                    </>
                  )}
                  <td className="py-3.5 text-right">
                    <button
                      onClick={() => onSelectModel && onSelectModel(r)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 dark:hover:bg-blue-600 text-slate-700 dark:text-slate-200 hover:text-white dark:hover:text-white transition"
                    >
                      Select Model
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 transition-colors">
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-1">Model Visual Comparison</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Comparing primary metrics across models</p>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94A3B8" strokeOpacity={0.2} />
              <XAxis dataKey="model" tick={{ fontSize: 10, fill: '#94A3B8' }} interval={0} angle={-15} textAnchor="end" />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Bar dataKey="primary" name={isClassification ? 'Accuracy' : 'R² Score'} fill="#CBD5E1" radius={[3, 3, 0, 0]} />
              <Bar dataKey="secondary" name={isClassification ? 'F1' : 'MAE'} fill="#2563EB" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default PipelineResults;