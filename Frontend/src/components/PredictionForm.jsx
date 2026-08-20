import { useState } from 'react';

const TASK_INFO = {
  priority: {
    title: 'Predict Ticket Priority',
    subtitle: 'Estimate the severity of this support ticket.',
  },
  resolution: {
    title: 'Predict Resolution Time',
    subtitle: 'Estimate how long this ticket is expected to take to resolve.',
  },
  owner: {
    title: 'Predict Best Worker',
    subtitle: 'Recommend the most suitable case owner for this ticket.',
  },
};

const FIELD_LABELS = {
  case_description: 'Case Description',
  target_callback_hours: 'Target Callback Hours',
  hours_open: 'Hours Open',
  case_owner: 'Case Owner',
  product: 'Product',
};

const formatLabel = (name) =>
  String(name)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

export default function PredictionForm({
  featureInfo = [],
  onPredict,
  loading,
  task,
}) {
  const safeFeatures = Array.isArray(featureInfo) ? featureInfo : [];

  const taskInfo = TASK_INFO[task] || {
    title: 'Make a Prediction',
    subtitle: 'Enter the available ticket information below.',
  };

  const [values, setValues] = useState(() =>
    Object.fromEntries(
      safeFeatures.map((f) => [
        f.name,
        f.is_numeric
          ? (f.mean ?? 0)
          : (f.options?.length ? f.options[0] : ''),
      ])
    )
  );

  const [formError, setFormError] = useState('');

  const handleChange = (name, val) => {
    setValues((v) => ({
      ...v,
      [name]: val,
    }));

    setFormError('');
  };

  const getLabel = (name) => FIELD_LABELS[name] || formatLabel(name);

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    for (const f of safeFeatures) {
      if (f.is_numeric) {
        const value = Number(values[f.name]);

        if (!Number.isFinite(value)) {
          setFormError(`${getLabel(f.name)} must be a valid number.`);
          return;
        }

        if (value < 0) {
          setFormError(`${getLabel(f.name)} cannot be negative.`);
          return;
        }
      }
    }

    const descriptionField = safeFeatures.find(
      (f) =>
        f.name === 'case_description' ||
        f.name.toLowerCase().includes('description')
    );

    if (descriptionField && !String(values[descriptionField.name] ?? '').trim()) {
      setFormError('Please enter a case description before generating a prediction.');
      return;
    }

    const sample = {};

    safeFeatures.forEach((f) => {
      sample[f.name] = f.is_numeric
        ? Number(values[f.name] ?? 0)
        : values[f.name];
    });

    onPredict(sample);
  };

  if (!safeFeatures.length) {
    return (
      <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <span className="text-slate-400">!</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              No prediction inputs available
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              The selected model did not provide any user-facing feature inputs.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const descriptionFields = safeFeatures.filter(
    (f) =>
      f.name === 'case_description' ||
      f.name.toLowerCase().includes('description')
  );

  const otherFields = safeFeatures.filter(
    (f) =>
      f.name !== 'case_description' &&
      !f.name.toLowerCase().includes('description')
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6 space-y-6 transition-colors"
    >
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          {taskInfo.title}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {taskInfo.subtitle}
        </p>
      </div>

      {/* Error */}
      {formError && (
        <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 px-4 py-3">
          <p className="text-sm text-red-700 dark:text-red-300">
            {formError}
          </p>
        </div>
      )}

      {/* Ticket Information */}
      <div>
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Ticket Information
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Enter the information that would normally be available to a support engineer.
          </p>
        </div>

        {descriptionFields.length > 0 && (
          <div className="space-y-4 mb-5">
            {descriptionFields.map((f) => (
              <label key={f.name} className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {getLabel(f.name)}
                  <span className="text-red-500 ml-1">*</span>
                </span>

                <textarea
                  value={values[f.name] ?? ''}
                  onChange={(e) => handleChange(f.name, e.target.value)}
                  rows={5}
                  placeholder="Describe the issue, symptoms, impact, and any relevant details..."
                  required
                  disabled={loading}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-3 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-60 transition-colors"
                />

                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">
                  This description is automatically analyzed for sentiment and TF-IDF text features.
                </p>
              </label>
            ))}
          </div>
        )}

        {otherFields.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {otherFields.map((f) => {
              const hasOptions =
                Array.isArray(f.options) && f.options.length > 0;
              const isSelect = !f.is_numeric && hasOptions;
              const isTextInput = !f.is_numeric && !hasOptions;

              return (
                <label key={f.name} className="block">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {getLabel(f.name)}
                  </span>

                  {isSelect ? (
                    <select
                      value={values[f.name] ?? ''}
                      onChange={(e) =>
                        handleChange(f.name, e.target.value)
                      }
                      disabled={loading}
                      className="mt-1.5 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 transition-colors"
                    >
                      {f.options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : isTextInput ? (
                    <input
                      type="text"
                      placeholder={`Enter ${getLabel(f.name).toLowerCase()}...`}
                      value={values[f.name] ?? ''}
                      onChange={(e) =>
                        handleChange(f.name, e.target.value)
                      }
                      disabled={loading}
                      className="mt-1.5 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 transition-colors"
                    />
                  ) : (
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={values[f.name] ?? ''}
                      onChange={(e) =>
                        handleChange(f.name, e.target.value)
                      }
                      disabled={loading}
                      className="mt-1.5 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 transition-colors"
                    />
                  )}
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Automatic Analysis */}
      <div className="rounded-lg border border-blue-100 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 p-4">
        <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
          Automatic Analysis
        </p>

        <p className="text-xs text-blue-700 dark:text-blue-300 mt-1.5">
          You only need to provide the information a human support engineer
          would normally know. The system generates the machine-learning
          features automatically.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
          {[
            'Sentiment Analysis',
            'TF-IDF Features',
            'Feature Engineering',
          ].map((item) => (
            <div
              key={item}
              className="flex items-center gap-2 rounded-md bg-white/70 dark:bg-slate-900/40 border border-blue-100/80 dark:border-blue-900/40 px-3 py-2"
            >
              <span className="text-blue-600 dark:text-blue-400 text-xs font-bold">
                ✓
              </span>
              <span className="text-xs text-blue-800 dark:text-blue-200">
                {item}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Generating Prediction...' : 'Generate Prediction'}
        </button>
      </div>
    </form>
  );
}