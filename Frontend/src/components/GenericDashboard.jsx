import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, PieChart, Pie, Cell } from 'recharts';
import { Database, Hash, Type, AlertTriangle, CheckCircle2, Copy, TrendingUp, Layers, ArrowRight } from 'lucide-react';

const PALETTE = ['#2563EB', '#14B8A6', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4'];

function Metric({ icon: Icon, label, value, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400',
    green: 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400',
    amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
  };
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tones[tone] || tones.blue}`}><Icon size={15} /></div>
      </div>
      <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}

function GenericDashboard({ data = {}, onExplore, onPredict }) {
  const overview = data.overview || {};
  const numeric = Array.isArray(data.numericSummary) ? data.numericSummary : [];
  const categorical = Array.isArray(data.categoricalSummary) ? data.categoricalSummary : [];
  const correlations = Array.isArray(data.correlations) ? data.correlations : [];
  const insights = Array.isArray(data.insights) ? data.insights : [];

  const topCategories = categorical.slice(0, 5).map((c) => ({ name: c.name, value: c.topPct }));
  const numericData = numeric.slice(0, 6).map((n) => ({ name: n.name, std: n.std }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold text-blue-600 dark:text-blue-400 mb-1">Dataset Analytics</p>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Dataset Overview</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Automatic analytics generated from the structure and statistics of your uploaded dataset.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onExplore} className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">Explore Dataset</button>
          <button onClick={onPredict} className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center gap-2"><TrendingUp size={15} /> Train / Predict</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Metric icon={Database} label="Rows" value={Number(overview.rows || 0).toLocaleString()} />
        <Metric icon={Layers} label="Columns" value={Number(overview.columns || 0).toLocaleString()} tone="purple" />
        <Metric icon={Hash} label="Numeric" value={Number(overview.numericColumns || 0)} />
        <Metric icon={Type} label="Categorical" value={Number(overview.categoricalColumns || 0)} tone="purple" />
        <Metric icon={AlertTriangle} label="Missing Values" value={Number(overview.missingValues || 0).toLocaleString()} tone="amber" />
        <Metric icon={Copy} label="Duplicate Rows" value={Number(overview.duplicateRows || 0).toLocaleString()} tone="green" />
      </div>

      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4"><SparkleIcon /><div><h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Automatic Insights</h3><p className="text-xs text-slate-500 dark:text-slate-400">Highlights discovered without requiring a specific domain model.</p></div></div>
        {insights.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {insights.map((item, i) => (
              <div key={i} className="rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{item.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-slate-500 dark:text-slate-400">Not enough information to generate automatic insights yet.</p>}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Numeric Feature Variability</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">Standard deviation of the most variable numeric features.</p>
          <div className="h-64">
            {numericData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={numericData} margin={{ top: 8, right: 10, left: 0, bottom: 45 }}><CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.18}/><XAxis dataKey="name" interval={0} angle={-25} textAnchor="end" tick={{fontSize: 10}}/><YAxis tick={{fontSize: 10}}/><Tooltip/><Bar dataKey="std" name="Std. deviation" fill="#2563EB" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer> : <Empty />}
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Categorical Dominance</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">Share represented by the most common category in each column.</p>
          <div className="h-64">
            {topCategories.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={topCategories} margin={{ top: 8, right: 10, left: 0, bottom: 45 }}><CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.18}/><XAxis dataKey="name" interval={0} angle={-25} textAnchor="end" tick={{fontSize: 10}}/><YAxis tickFormatter={(v)=>`${v}%`} tick={{fontSize: 10}}/><Tooltip formatter={(v)=>`${v}%`}/><Bar dataKey="value" name="Top category share" radius={[4,4,0,0]}>{topCategories.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}</Bar></BarChart></ResponsiveContainer> : <Empty />}
          </div>
        </section>
      </div>

      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4"><div><h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Strongest Numeric Relationships</h3><p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Pairs with the strongest absolute Pearson correlation.</p></div><span className="text-[11px] text-slate-400">Correlation ranges from -1 to +1</span></div>
        {correlations.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            {correlations.map((c, i) => (
              <div key={i} className="rounded-lg border border-slate-100 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-800/40">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate" title={`${c.x} vs ${c.y}`}>{c.x} ↔ {c.y}</p>
                <p className={`text-xl font-bold mt-2 ${c.correlation >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>{c.correlation.toFixed(2)}</p>
                <p className="text-[11px] text-slate-400 mt-1">Pearson r</p>
              </div>
            ))}
          </div>
        ) : <Empty />}
      </section>
    </div>
  );
}

function SparkleIcon() { return <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">✦</div>; }
function Empty() { return <div className="h-full min-h-40 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">Not enough data for this visualization.</div>; }

export default GenericDashboard;
