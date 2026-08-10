import { useState } from 'react';

export default function PredictionForm({ featureInfo = [], onPredict, loading }) {
  const safeFeatures = Array.isArray(featureInfo) ? featureInfo : [];

  const [values, setValues] = useState(() =>
    Object.fromEntries(
      safeFeatures.map(f => [
        f.name, 
        f.is_numeric 
          ? (f.mean ?? 0) 
          : (f.options?.length ? f.options[0] : '')
      ])
    )
  );

  const handleChange = (name, val) => setValues(v => ({ ...v, [name]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const sample = {};
    safeFeatures.forEach(f => {
      sample[f.name] = f.is_numeric ? parseFloat(values[f.name] ?? 0) : values[f.name];
    });
    onPredict(sample);
  };

  if (!safeFeatures.length) {
    return (
      <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 text-gray-500">
        No feature inputs available to display.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">Make a Prediction</h3>
      <div className="grid grid-cols-2 gap-4">
        {safeFeatures.map(f => {
          const isDescription = f.name.toLowerCase().includes('description');
          const hasOptions = Array.isArray(f.options) && f.options.length > 0;
          const isSelect = !f.is_numeric && hasOptions;
          const isTextInput = !f.is_numeric && !hasOptions;

          return (
            <label 
              key={f.name} 
              className={`text-sm text-gray-600 block ${isDescription ? 'col-span-2' : ''}`}
            >
              <span className="font-medium text-gray-700 capitalize">{f.name.replace('_', ' ')}</span>
              
              {isSelect ? (
                <select
                  value={values[f.name] ?? ''}
                  onChange={(e) => handleChange(f.name, e.target.value)}
                  className="mt-1 w-full border rounded-lg p-2 text-gray-800 bg-white"
                >
                  {f.options.map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              ) : isTextInput ? (
                <input
                  type="text"
                  placeholder={`Enter ${f.name.replace('_', ' ')}...`}
                  value={values[f.name] ?? ''}
                  onChange={(e) => handleChange(f.name, e.target.value)}
                  className="mt-1 w-full border rounded-lg p-2 text-gray-800"
                />
              ) : (
                <input
                  type="number"
                  step="any"
                  value={values[f.name] ?? ''}
                  onChange={(e) => handleChange(f.name, e.target.value)}
                  className="mt-1 w-full border rounded-lg p-2 text-gray-800"
                />
              )}
            </label>
          );
        })}
      </div>
      <button 
        type="submit" 
        disabled={loading} 
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
      >
        {loading ? 'Predicting...' : 'Predict'}
      </button>
    </form>
  );
}