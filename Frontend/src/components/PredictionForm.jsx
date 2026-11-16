import { useState } from 'react';

const formatLabel = (name) => String(name).replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function PredictionForm({ featureInfo = [], onPredict, loading }) {
  const safeFeatures = Array.isArray(featureInfo) ? featureInfo : [];
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      safeFeatures.map((feature) => [
        feature.name,
        feature.is_numeric ? (feature.mean ?? 0) : (feature.options?.length ? feature.options[0] : ''),
      ])
    )
  );
  const [formError, setFormError] = useState('');

  const updateValue = (name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
    setFormError('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setFormError('');

    for (const feature of safeFeatures) {
      if (feature.is_numeric && !Number.isFinite(Number(values[feature.name]))) {
        setFormError(formatLabel(feature.name) + ' must be a valid number.');
        return;
      }
    }

    const sample = Object.fromEntries(
      safeFeatures.map((feature) => [
        feature.name,
        feature.is_numeric ? Number(values[feature.name] ?? 0) : values[feature.name] ?? '',
      ])
    );

    onPredict(sample);
  };

  if (!safeFeatures.length) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">No prediction inputs available</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">The selected model did not expose any user-facing features.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider font-semibold text-indigo-600 dark:text-indigo-400">Inference</p>
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mt-1">Generate a prediction</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Enter a new record using the same feature structure used during training.</p>
      </div>

      {formError && <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 px-4 py-3"><p className="text-sm text-red-700 dark:text-red-300">{formError}</p></div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {safeFeatures.map((feature) => {
          const label = formatLabel(feature.name);
          const hasOptions = Array.isArray(feature.options) && feature.options.length > 0;

          return (
            <label key={feature.name} className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>

              {hasOptions && !feature.is_numeric ? (
                <select value={values[feature.name] ?? ''} onChange={(e) => updateValue(feature.name, e.target.value)} disabled={loading} className="mt-1.5 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm">
                  {feature.options.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : (
                <input type={feature.is_numeric ? 'number' : 'text'} step={feature.is_numeric ? 'any' : undefined} value={values[feature.name] ?? ''} onChange={(e) => updateValue(feature.name, e.target.value)} disabled={loading} className="mt-1.5 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm" />
              )}
            </label>
          );
        })}
      </div>

      <button type="submit" disabled={loading} className="w-full sm:w-auto px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-40">
        {loading ? 'Generating…' : 'Generate Prediction'}
      </button>
    </form>
  );
}
