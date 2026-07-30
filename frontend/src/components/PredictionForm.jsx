import { useState } from 'react';

export default function PredictionForm({ featureInfo, onPredict, loading }) {
  const [values, setValues] = useState(
    Object.fromEntries(featureInfo.map(f => [f.name, f.is_numeric ? f.mean : (f.options?.[0] ?? '')]))
  );

  const handleChange = (name, val) => setValues(v => ({ ...v, [name]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const sample = {};
    featureInfo.forEach(f => {
      sample[f.name] = f.is_numeric ? parseFloat(values[f.name]) : values[f.name];
    });
    onPredict(sample);
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">Make a Prediction</h3>
      <div className="grid grid-cols-2 gap-4">
        {featureInfo.map(f => (
          <label key={f.name} className="text-sm text-gray-600">
            {f.name}
            {f.is_numeric ? (
              <input
                type="number"
                step="any"
                value={values[f.name]}
                onChange={(e) => handleChange(f.name, e.target.value)}
                className="mt-1 w-full border rounded-lg p-2"
              />
            ) : (
              <select
                value={values[f.name]}
                onChange={(e) => handleChange(f.name, e.target.value)}
                className="mt-1 w-full border rounded-lg p-2"
              >
                {f.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
          </label>
        ))}
      </div>
      <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium">
        {loading ? 'Predicting...' : 'Predict'}
      </button>
    </form>
  );
}