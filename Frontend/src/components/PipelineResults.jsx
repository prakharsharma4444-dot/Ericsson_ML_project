import { ArrowLeft, Info, Rows3, Columns3, Hash, Trophy, CheckCircle2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const MODEL_DESCRIPTIONS = {
  'Logistic Regression':
    'A reliable algorithm for binary/multiclass outcomes that calculates the probability of a class based on input variables.',
  'Random Forest':
    'An ensemble method that combines multiple decision trees to improve accuracy and control over-fitting.',
  'Gradient Boosting':
    'A powerful technique that builds models sequentially, with each new model correcting errors made by previous ones.',
  'Support Vector Classifier':
    'A robust model that finds the optimal boundary to separate different categories in high-dimensional data.',
  'Ridge Regression':
    'A linear model that shrinks coefficients to reduce overfitting, well-suited for correlated features.',
  'Huber Regression (Robust)':
    'A regression model that reduces sensitivity to outliers compared to standard linear regression.',
  'Support Vector Regressor':
    'Finds a function that fits the data within a margin of tolerance, robust to moderate outliers.',
  'Random Forest (Tuned)':
    'An ensemble of decision trees with hyperparameters tuned for this dataset.',
  'Gradient Boosting (Tuned)':
    'A sequential ensemble method with hyperparameters tuned for this dataset.',
};

function PipelineResults({
  problemType,
  initialShape,
  finalShape,
  results = [],
  cvResults = [],
  recommendedModel = null,
  selectedModel = null,
  onSelectModel,
  onBack,
}) {
  const isClassification = problemType === 'classification';

  const getModelName = (model) => {
    if (typeof model === 'string') return model;
    return model?.model || model?.name || null;
  };

  const resolvedSelectedModelName = getModelName(selectedModel);
  const backendRecommendedModelName = getModelName(recommendedModel);

  const derivedRecommendedModelName =
    backendRecommendedModelName ||
    (Array.isArray(cvResults) && cvResults.length > 0
      ? [...cvResults]
          .filter((item) => item?.model)
          .sort((a, b) => {
            const aScore = Number(
              isClassification ? a?.cv_f1_macro_mean : a?.cv_r2_mean
            );
            const bScore = Number(
              isClassification ? b?.cv_f1_macro_mean : b?.cv_r2_mean
            );

            if (!Number.isFinite(aScore)) return 1;
            if (!Number.isFinite(bScore)) return -1;
            return bScore - aScore;
          })[0]?.model || null
      : null);

  const getCvResult = (modelName) =>
    cvResults.find((item) => getModelName(item) === modelName);

  const chartData = results.map((r) => {
    const cv = getCvResult(r.model);

    return {
      model: r.model,
      primary: isClassification ? r.f1_macro : r.r2 ?? r.r2_score,
      secondary: isClassification ? cv?.cv_f1_macro_mean : cv?.cv_r2_mean,
    };
  });

  const formatPercentage = (value) => {
    if (value == null || Number.isNaN(Number(value))) return '—';
    return `${(Number(value) * 100).toFixed(1)}%`;
  };

  const formatErrorHours = (value) => {
    if (value == null || Number.isNaN(Number(value))) return '—';
    return `${Number(value).toFixed(1)} h`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition"
        >
          <ArrowLeft size={14} /> Back to Prediction Selection
        </button>

        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
          Pipeline Results
        </h2>
      </div>

      {derivedRecommendedModelName && (
        <div className="flex items-center justify-between gap-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/60 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
              <Trophy size={18} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-green-700 dark:text-green-300">
                Recommended Model
              </p>
              <p className="text-base font-bold text-green-800 dark:text-green-200">
                {derivedRecommendedModelName}
              </p>
              <p className="text-[11px] text-green-600 dark:text-green-400 mt-0.5">
                {backendRecommendedModelName
                  ? `Selected using cross-validation ${isClassification ? 'Macro F1' : 'R²'}.`
                  : `Recommended from the best available cross-validation ${isClassification ? 'Macro F1' : 'R²'}.`}
              </p>
            </div>
          </div>

          {resolvedSelectedModelName !== derivedRecommendedModelName && (
            <button
              type="button"
              onClick={() => {
                const recommendedRow = results.find(
                  (row) => row.model === derivedRecommendedModelName
                );

                if (recommendedRow && onSelectModel) {
                  onSelectModel({
                    ...recommendedRow,
                    model: recommendedRow.model,
                    isRecommended: true,
                  });
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition whitespace-nowrap"
            >
              Use Recommended
            </button>
          )}
        </div>
      )}

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
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Model Performance</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Compare held-out performance and cross-validation consistency before choosing a model.
            </p>
          </div>
        </div>

        {selectedModel && (
          <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/30 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                <CheckCircle2 size={16} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Currently Selected Model</p>
                <p className="text-sm font-bold text-blue-800 dark:text-blue-200">{resolvedSelectedModelName}</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-[10px] font-semibold whitespace-nowrap">
              Ready for Prediction
            </span>
          </div>
        )}

        <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 rounded-lg p-3 mb-5">
          <Info size={16} className="text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-800 dark:text-blue-200">
            <span className="font-semibold">How to read this table: </span>
            {isClassification
              ? 'Test metrics show final held-out performance. CV Macro F1 shows how consistently each classifier performed across training folds.'
              : 'R² measures explained variance. MAE and RMSE are errors in the target units, while CV R² shows how consistently the model performs across training folds.'}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <th className="pb-2.5 font-medium">Model</th>
                <th className="pb-2.5 font-medium">Description</th>
                {isClassification ? (
                  <>
                    <th className="pb-2.5 font-medium">Accuracy</th>
                    <th className="pb-2.5 font-medium">Bal. Accuracy</th>
                    <th className="pb-2.5 font-medium">Precision</th>
                    <th className="pb-2.5 font-medium">Recall</th>
                    <th className="pb-2.5 font-medium">F1</th>
                    <th className="pb-2.5 font-medium">Macro F1</th>
                    <th className="pb-2.5 font-medium">CV Macro F1</th>
                  </>
                ) : (
                  <>
                    <th className="pb-2.5 font-medium">R² Score</th>
                    <th className="pb-2.5 font-medium">MAE</th>
                    <th className="pb-2.5 font-medium">RMSE</th>
                    <th className="pb-2.5 font-medium">CV R²</th>
                  </>
                )}
                <th className="pb-2.5 font-medium text-right">Action</th>
              </tr>
            </thead>

            <tbody>
              {results.map((r) => {
                const cv = getCvResult(r.model);
                const isRecommended = derivedRecommendedModelName === r.model;
                const isSelected = resolvedSelectedModelName === r.model;

                return (
                  <tr
                    key={r.model}
                    className={`border-b last:border-0 align-top transition-colors ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60'
                        : isRecommended
                          ? 'bg-green-50/70 dark:bg-green-950/20 border-green-100 dark:border-green-900/40'
                          : 'border-slate-50 dark:border-slate-800/60 hover:bg-slate-50/70 dark:hover:bg-slate-800/30'
                    }`}
                  >
                    <td className="py-3.5 font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {r.model}
                        {isRecommended && (
                          <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-[10px] font-semibold">
                            Recommended
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 text-slate-500 dark:text-slate-400 text-xs max-w-xs pr-4">
                      {MODEL_DESCRIPTIONS[r.model] || 'A machine learning model trained on this dataset.'}
                    </td>

                    {isClassification ? (
                      <>
                        <td className="py-3.5 font-medium text-slate-700 dark:text-slate-300">{formatPercentage(r.accuracy)}</td>
                        <td className="py-3.5 font-medium text-slate-700 dark:text-slate-300">{formatPercentage(r.balanced_accuracy)}</td>
                        <td className="py-3.5 font-medium text-slate-700 dark:text-slate-300">{formatPercentage(r.precision)}</td>
                        <td className="py-3.5 font-medium text-slate-700 dark:text-slate-300">{formatPercentage(r.recall)}</td>
                        <td className="py-3.5 font-medium text-slate-700 dark:text-slate-300">{formatPercentage(r.f1)}</td>
                        <td className="py-3.5 font-semibold text-blue-600 dark:text-blue-400">{formatPercentage(r.f1_macro)}</td>
                        <td className="py-3.5 font-semibold text-purple-600 dark:text-purple-400">
                          {formatPercentage(cv?.cv_f1_macro_mean)}
                          {cv?.cv_f1_macro_std != null && (
                            <span className="block text-[10px] font-normal text-slate-400 dark:text-slate-500 mt-0.5">
                              ± {formatPercentage(cv.cv_f1_macro_std)}
                            </span>
                          )}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-3.5 font-medium text-slate-700 dark:text-slate-300">{formatPercentage(r.r2 ?? r.r2_score)}</td>
                        <td className="py-3.5 font-medium text-slate-700 dark:text-slate-300">{formatErrorHours(r.mae)}</td>
                        <td className="py-3.5 font-medium text-slate-700 dark:text-slate-300">{formatErrorHours(r.rmse)}</td>
                        <td className="py-3.5 font-semibold text-purple-600 dark:text-purple-400">
                          {formatPercentage(cv?.cv_r2_mean)}
                          {cv?.cv_r2_std != null && (
                            <span className="block text-[10px] font-normal text-slate-400 dark:text-slate-500 mt-0.5">
                              ± {formatPercentage(cv.cv_r2_std)}
                            </span>
                          )}
                        </td>
                      </>
                    )}

                    <td className="py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          onSelectModel &&
                          onSelectModel({
                            ...r,
                            model: r.model,
                            isRecommended,
                          })
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                          isSelected
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : isRecommended
                              ? 'bg-green-600 hover:bg-green-700 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 dark:hover:bg-blue-600 text-slate-700 dark:text-slate-200 hover:text-white dark:hover:text-white'
                        }`}
                      >
                        {isSelected ? '✓ Selected' : isRecommended ? 'Use Recommended' : 'Select Model'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {selectedModel && (
          <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-blue-600 dark:text-blue-400" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {resolvedSelectedModelName} is ready for the prediction form.
              </p>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 ml-6">
              You can change the model at any time before generating the final prediction.
            </p>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 transition-colors">
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Model Visual Comparison</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          {isClassification
            ? 'Held-out Macro F1 vs cross-validation Macro F1'
            : 'Held-out R² vs cross-validation R²'}
        </p>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94A3B8" strokeOpacity={0.2} />
              <XAxis
                dataKey="model"
                tick={{ fontSize: 10, fill: '#94A3B8' }}
                interval={0}
                angle={-15}
                textAnchor="end"
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94A3B8' }}
                tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`}
              />
              <Tooltip
                formatter={(value, name) => [formatPercentage(value), name]}
                contentStyle={{
                  borderRadius: '8px',
                  border: 'none',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
              />
              <Bar
                dataKey="primary"
                name={isClassification ? 'Test Macro F1' : 'Test R²'}
                fill="#CBD5E1"
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey="secondary"
                name={isClassification ? 'CV Macro F1' : 'CV R²'}
                fill="#2563EB"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {isClassification ? (
        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">What should you focus on?</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-5">
            Macro F1 gives every class equal importance, which is useful when the ticket priorities are not perfectly balanced. CV Macro F1 helps you judge whether a model's performance is stable across different training folds.
          </p>
        </div>
      ) : (
        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">How to interpret the regression metrics</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-5">
            R² shows how much variation in the target is explained by the model. MAE is the average absolute prediction error, expressed in the same units as the target. For resolution-time prediction, MAE is therefore directly interpretable as typical error in hours.
          </p>
        </div>
      )}
    </div>
  );
}

export default PipelineResults;