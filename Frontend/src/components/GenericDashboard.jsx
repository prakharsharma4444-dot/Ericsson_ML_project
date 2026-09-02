import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  Copy,
  Database,
  FileText,
  Hash,
  Layers,
  ListFilter,
  Search,
  Table2,
  Target,
  TrendingDown,
  TrendingUp,
  Type,
  XCircle,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const PALETTE = ['#2563EB', '#14B8A6', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#84CC16', '#F97316'];

function Card({ children, className = '' }) {
  return (
    <section className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm ${className}`}>
      {children}
    </section>
  );
}

function Metric({ icon: Icon, label, value, sub, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400',
    green: 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400',
    amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
    red: 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400',
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tones[tone] || tones.blue}`}>
          <Icon size={15} />
        </div>
      </div>
      <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
      {sub && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Icon size={15} />
          </div>
        )}
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

function GenericDashboard({ data = {}, onExplore, onPredict }) {
  const overview = data.overview || {};
  const numeric = Array.isArray(data.numericSummary) ? data.numericSummary : [];
  const categorical = Array.isArray(data.categoricalSummary) ? data.categoricalSummary : [];
  const datetime = Array.isArray(data.datetimeSummary) ? data.datetimeSummary : [];
  const text = Array.isArray(data.textSummary) ? data.textSummary : [];
  const correlations = Array.isArray(data.correlations) ? data.correlations : [];
  const categoricalAssociations = Array.isArray(data.categoricalAssociations) ? data.categoricalAssociations : [];
  const distributions = Array.isArray(data.distributions) ? data.distributions : [];
  const profiles = Array.isArray(data.columnProfiles) ? data.columnProfiles : [];
  const missingSummary = data.missingSummary || {};
  const insights = Array.isArray(data.insights) ? data.insights : [];
  const identifiers = Array.isArray(data.identifierColumns) ? data.identifierColumns : [];

  const [profileQuery, setProfileQuery] = useState('');
  const [selectedNumeric, setSelectedNumeric] = useState(numeric[0]?.name || '');
  const [selectedCategory, setSelectedCategory] = useState(categorical[0]?.name || '');
  const [selectedTime, setSelectedTime] = useState(datetime[0]?.name || '');

  const filteredProfiles = useMemo(() => {
    const q = profileQuery.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) => `${p.name} ${p.type}`.toLowerCase().includes(q));
  }, [profiles, profileQuery]);

  const currentNumeric = numeric.find((n) => n.name === selectedNumeric) || numeric[0];
  const currentCategory = categorical.find((c) => c.name === selectedCategory) || categorical[0];
  const currentTime = datetime.find((d) => d.name === selectedTime) || datetime[0];

  const hist = distributions.find((d) => d.name === currentNumeric?.name)?.histogram || [];
  const timeTrend = currentTime?.monthlyCounts || [];
  const categoryPie = currentCategory?.topValues?.slice(0, 8) || [];

  const completeness = Number.isFinite(overview.completePct) ? overview.completePct : 100;
  const duplicatePct = Number.isFinite(overview.duplicatePct) ? overview.duplicatePct : 0;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold text-blue-600 dark:text-blue-400 mb-1">Dataset Analytics</p>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Dataset Intelligence Dashboard</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">A full automatic profile of structure, quality, distributions, relationships, and time coverage.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onExplore} className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">
            Explore Dataset
          </button>
          <button onClick={onPredict} className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center gap-2">
            <Target size={15} /> Train / Predict
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <Metric icon={Database} label="Rows" value={Number(overview.rows || 0).toLocaleString()} />
        <Metric icon={Layers} label="Columns" value={Number(overview.columns || 0)} tone="purple" />
        <Metric icon={Hash} label="Numeric" value={Number(overview.numericColumns || 0)} />
        <Metric icon={Type} label="Categorical" value={Number(overview.categoricalColumns || 0)} tone="purple" />
        <Metric icon={CalendarRange} label="Datetime" value={Number(overview.datetimeColumns || 0)} tone="green" />
        <Metric icon={FileText} label="Text" value={Number(overview.textColumns || 0)} />
        <Metric icon={AlertTriangle} label="Missing" value={Number(overview.missingValues || 0).toLocaleString()} sub={`${Number(missingSummary.missingPct || 0).toFixed(2)}% of cells`} tone="amber" />
        <Metric icon={Copy} label="Duplicates" value={Number(overview.duplicateRows || 0).toLocaleString()} sub={`${duplicatePct.toFixed(2)}% of rows`} tone={overview.duplicateRows ? 'red' : 'green'} />
      </div>

      <Card className="p-5">
        <SectionHeader
          icon={CheckCircle2}
          title="Data Health"
          subtitle="Completeness and structural quality checks across the entire dataset."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <HealthBar label="Complete cells" value={completeness} good={completeness >= 98} />
          <HealthBar label="Unique-row ratio" value={Math.max(0, 100 - duplicatePct)} good={duplicatePct < 1} />
          <HealthBar label="Columns without missing values" value={profiles.length ? (profiles.filter((p) => p.missing === 0).length / profiles.length) * 100 : 100} good />
        </div>
        {missingSummary.byColumn?.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <tr><th className="py-2 pr-4">Column</th><th className="py-2 pr-4">Missing</th><th className="py-2 pr-4">Rate</th></tr>
              </thead>
              <tbody>
                {missingSummary.byColumn.slice(0, 8).map((m) => (
                  <tr key={m.name} className="border-b last:border-b-0 border-slate-100 dark:border-slate-800">
                    <td className="py-2.5 pr-4 font-medium text-slate-700 dark:text-slate-200">{m.name}</td>
                    <td className="py-2.5 pr-4 text-slate-500">{m.count.toLocaleString()}</td>
                    <td className="py-2.5 pr-4 text-amber-600 dark:text-amber-400 font-semibold">{m.pct.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <SectionHeader icon={Activity} title="Automatic Key Findings" subtitle="Potentially useful observations generated directly from the dataset." />
        {insights.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {insights.map((item, i) => (
              <div key={`${item.title}-${i}`} className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{item.title}</p>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        ) : <Empty text="Not enough information to generate automatic findings." />}
      </Card>

      <Card className="p-5">
        <SectionHeader icon={Table2} title="Column Profiler" subtitle="Every column, its detected type, completeness, cardinality, and sample values." right={
          <div className="relative w-60 max-w-full"><Search size={13} className="absolute left-3 top-2.5 text-slate-400" /><input value={profileQuery} onChange={(e) => setProfileQuery(e.target.value)} placeholder="Search columns..." className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-8 pr-3 py-2 text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500" /></div>
        } />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-slate-400 border-b border-slate-100 dark:border-slate-800">
              <tr><th className="py-2 pr-4">Column</th><th className="py-2 pr-4">Type</th><th className="py-2 pr-4">Unique</th><th className="py-2 pr-4">Missing</th><th className="py-2 pr-4">Examples</th></tr>
            </thead>
            <tbody>
              {filteredProfiles.map((p) => (
                <tr key={p.name} className="border-b last:border-b-0 border-slate-100 dark:border-slate-800 align-top">
                  <td className="py-3 pr-4 font-semibold text-slate-700 dark:text-slate-200">{p.name}</td>
                  <td className="py-3 pr-4"><TypePill type={p.type} /></td>
                  <td className="py-3 pr-4 text-slate-500">{p.unique.toLocaleString()} <span className="text-slate-400">({p.uniquePct.toFixed(1)}%)</span></td>
                  <td className={`py-3 pr-4 font-semibold ${p.missingPct ? 'text-amber-600' : 'text-emerald-500'}`}>{p.missing.toLocaleString()} ({p.missingPct.toFixed(1)}%)</td>
                  <td className="py-3 pr-4 text-slate-400 max-w-md">{p.sampleValues?.join(' · ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5">
        <SectionHeader icon={Hash} title="Numeric Analysis" subtitle="Descriptive statistics, skewness, outliers, and distributions for numeric variables." right={
          numeric.length > 0 && <select value={currentNumeric?.name || ''} onChange={(e) => setSelectedNumeric(e.target.value)} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-700 dark:text-slate-200">{numeric.map((n) => <option key={n.name}>{n.name}</option>)}</select>
        } />
        {currentNumeric ? (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-1 grid grid-cols-2 gap-3">
              <MiniStat label="Mean" value={fmt(currentNumeric.mean)} />
              <MiniStat label="Median" value={fmt(currentNumeric.median)} />
              <MiniStat label="Min" value={fmt(currentNumeric.min)} />
              <MiniStat label="Max" value={fmt(currentNumeric.max)} />
              <MiniStat label="Std. dev." value={fmt(currentNumeric.std)} />
              <MiniStat label="Skewness" value={fmt(currentNumeric.skewness)} />
              <MiniStat label="Q1" value={fmt(currentNumeric.q1)} />
              <MiniStat label="Q3" value={fmt(currentNumeric.q3)} />
            </div>
            <div className="xl:col-span-2 h-72">
              {hist.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={hist} margin={{ top: 8, right: 10, bottom: 38, left: 0 }}><CartesianGrid strokeDasharray="3 3" opacity={0.15} /><XAxis dataKey="bin" angle={-30} textAnchor="end" tick={{ fontSize: 9 }} interval={0} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="count" name="Rows" fill="#2563EB" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer> : <Empty text="No distribution available." />}
            </div>
          </div>
        ) : <Empty text="No numeric columns detected." />}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="p-5">
          <SectionHeader icon={ListFilter} title="Categorical Analysis" subtitle="Most common values, cardinality, and category concentration." right={
            categorical.length > 0 && <select value={currentCategory?.name || ''} onChange={(e) => setSelectedCategory(e.target.value)} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-700 dark:text-slate-200">{categorical.map((c) => <option key={c.name}>{c.name}</option>)}</select>
          } />
          {currentCategory ? (
            <div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <MiniStat label="Unique values" value={currentCategory.unique.toLocaleString()} />
                <MiniStat label="Top share" value={`${currentCategory.topPct.toFixed(1)}%`} />
                <MiniStat label="Top value" value={currentCategory.top} />
                <MiniStat label="Entropy" value={fmt(currentCategory.entropy)} />
              </div>
              <div className="h-56"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categoryPie} dataKey="count" nameKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={82} paddingAngle={2}>{categoryPie.map((entry, i) => <Cell key={entry.value} fill={PALETTE[i % PALETTE.length]} />)}</Pie><Tooltip formatter={(v) => v.toLocaleString()} /></PieChart></ResponsiveContainer></div>
              <div className="space-y-2 mt-2">{categoryPie.slice(0, 6).map((v, i) => <div key={v.value} className="flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><span className="w-2 h-2 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />{v.value}</span><span className="font-semibold text-slate-700 dark:text-slate-200">{v.pct.toFixed(1)}%</span></div>)}</div>
            </div>
          ) : <Empty text="No categorical columns detected." />}
        </Card>

        <Card className="p-5">
          <SectionHeader icon={FileText} title="Text & Identifier Signals" subtitle="Useful clues for data cleaning and understanding high-cardinality fields." />
          <div className="space-y-3">
            {identifiers.length > 0 && <div><p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">Identifier-like columns</p>{identifiers.map((id) => <div key={id.name} className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 px-3 py-2 text-xs mb-2"><span className="font-semibold">{id.name}</span><span className="text-slate-500 dark:text-slate-400"> — {id.reason}</span></div>)}</div>}
            {text.length > 0 && <div><p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">Text columns</p>{text.map((t) => <div key={t.name} className="rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2.5 text-xs flex items-center justify-between"><span className="font-medium text-slate-700 dark:text-slate-200">{t.name}</span><span className="text-slate-400">avg {t.avgLength} chars · {t.unique.toLocaleString()} unique</span></div>)}</div>}
            {!identifiers.length && !text.length && <Empty text="No obvious text-heavy or identifier-like columns detected." />}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <SectionHeader icon={CalendarRange} title="Time Analysis" subtitle="Coverage and volume over time for detected datetime columns." right={
          datetime.length > 0 && <select value={currentTime?.name || ''} onChange={(e) => setSelectedTime(e.target.value)} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-700 dark:text-slate-200">{datetime.map((d) => <option key={d.name}>{d.name}</option>)}</select>
        } />
        {currentTime ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
              <MiniStat label="Start" value={currentTime.min.slice(0, 10)} />
              <MiniStat label="End" value={currentTime.max.slice(0, 10)} />
              <MiniStat label="Span" value={`${currentTime.spanDays.toLocaleString()} days`} />
              <MiniStat label="Unique timestamps" value={currentTime.unique.toLocaleString()} />
            </div>
            <div className="lg:col-span-2 h-72">{timeTrend.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={timeTrend} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" opacity={0.15} /><XAxis dataKey="period" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Area type="monotone" dataKey="count" name="Rows" stroke="#2563EB" fill="#2563EB" fillOpacity={0.12} /></AreaChart></ResponsiveContainer> : <Empty text="No time-series points available." />}</div>
          </div>
        ) : <Empty text="No datetime columns detected." />}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="p-5">
          <SectionHeader icon={TrendingUp} title="Numeric Relationships" subtitle="Strongest absolute Pearson relationships, with Spearman rank correlation for comparison." />
          {correlations.length ? <div className="space-y-2">{correlations.map((c) => <div key={`${c.x}-${c.y}`} className="flex items-center justify-between rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-3"><div className="min-w-0"><p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{c.x} ↔ {c.y}</p><p className="text-[10px] text-slate-400 mt-1">Pearson {c.correlation.toFixed(3)} · Spearman {c.spearman == null ? '—' : c.spearman.toFixed(3)}</p></div><span className={`text-sm font-bold ${c.correlation >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{c.correlation.toFixed(2)}</span></div>)}</div> : <Empty text="At least two numeric columns are needed." />}
        </Card>
        <Card className="p-5">
          <SectionHeader icon={Layers} title="Categorical Relationships" subtitle="Cramér's V highlights association between pairs of categorical variables." />
          {categoricalAssociations.length ? <div className="space-y-2">{categoricalAssociations.map((c) => <div key={`${c.x}-${c.y}`} className="flex items-center justify-between rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-3"><div className="min-w-0"><p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{c.x} ↔ {c.y}</p><p className="text-[10px] text-slate-400 mt-1">Cramér's V</p></div><span className="text-sm font-bold text-purple-600 dark:text-purple-400">{c.cramersV.toFixed(2)}</span></div>)}</div> : <Empty text="Not enough categorical columns to calculate associations." />}
        </Card>
      </div>

      <Card className="p-5">
        <SectionHeader icon={BarChart3} title="Numeric Feature Comparison" subtitle="Relative variability across the dataset's numeric variables." />
        {numeric.length ? (
          <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={numeric.slice().sort((a, b) => b.std - a.std).slice(0, 12)} margin={{ top: 8, right: 10, left: 0, bottom: 50 }}><CartesianGrid strokeDasharray="3 3" opacity={0.15} /><XAxis dataKey="name" interval={0} angle={-28} textAnchor="end" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="std" name="Std. deviation" fill="#14B8A6" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer></div>
        ) : <Empty text="No numeric features detected." />}
      </Card>

      <Card className="p-5">
        <SectionHeader icon={Table2} title="Full Numeric Statistics" subtitle="Use this table as the compact statistical reference for the dataset." />
        {numeric.length ? <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="text-left text-slate-400 border-b border-slate-100 dark:border-slate-800"><tr>{['Feature', 'Mean', 'Median', 'Min', 'Q1', 'Q3', 'Max', 'Std', 'Skew', 'Outliers', 'Missing'].map((x) => <th key={x} className="py-2 pr-4 whitespace-nowrap">{x}</th>)}</tr></thead><tbody>{numeric.map((n) => <tr key={n.name} className="border-b last:border-b-0 border-slate-100 dark:border-slate-800"><td className="py-2.5 pr-4 font-semibold text-slate-700 dark:text-slate-200">{n.name}</td><td className="pr-4">{fmt(n.mean)}</td><td className="pr-4">{fmt(n.median)}</td><td className="pr-4">{fmt(n.min)}</td><td className="pr-4">{fmt(n.q1)}</td><td className="pr-4">{fmt(n.q3)}</td><td className="pr-4">{fmt(n.max)}</td><td className="pr-4">{fmt(n.std)}</td><td className="pr-4">{fmt(n.skewness)}</td><td className={`pr-4 font-semibold ${n.outliers ? 'text-amber-600' : 'text-emerald-500'}`}>{n.outliers.toLocaleString()}</td><td className="pr-4 text-slate-500">{n.missing.toLocaleString()}</td></tr>)}</tbody></table></div> : <Empty text="No numeric columns detected." />}
      </Card>
    </div>
  );
}

function HealthBar({ label, value, good }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return <div><div className="flex justify-between text-xs mb-2"><span className="text-slate-600 dark:text-slate-300">{label}</span><span className={`font-semibold ${good ? 'text-emerald-500' : 'text-amber-600'}`}>{safe.toFixed(1)}%</span></div><div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className={`h-full rounded-full ${good ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${safe}%` }} /></div></div>;
}

function MiniStat({ label, value }) {
  return <div className="rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 p-3"><p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p><p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-1 truncate" title={String(value)}>{value}</p></div>;
}

function TypePill({ type }) {
  const styles = {
    numeric: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
    categorical: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400',
    boolean: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
    datetime: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
    text: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400',
    empty: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  };
  return <span className={`inline-flex px-2 py-1 rounded-full text-[10px] font-semibold ${styles[type] || styles.empty}`}>{type}</span>;
}

function fmt(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  if (Math.abs(n) >= 1000000) return n.toExponential(2);
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function Empty({ text = 'Not enough data for this analysis.' }) {
  return <div className="min-h-28 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500 text-center px-4">{text}</div>;
}

export default GenericDashboard;
