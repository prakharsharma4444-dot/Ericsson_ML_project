import { useState } from 'react';
import { RotateCcw, Square, ArrowUpCircle, Copy, Check, Cpu, Layers } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';

/**
 * STATIC MOCKUP — matches the Figma "Model Deployment" screen, but this
 * is NOT wired to any real deployment infrastructure. Your backend has
 * no live model-hosting, no real REST endpoint, and no real bearer
 * token system. All numbers/values here are placeholders for visual
 * purposes only. Treat this as a UI shell to design against later, not
 * a working feature — the Rollback/Stop/Update buttons intentionally
 * do nothing destructive; they just show a note explaining that.
 */
function ModelDeployment({
  modelName = 'Random Forest Classifier v2.4',
  clusterName = 'Prod-Cluster-Alpha',
  deployedAt = 'Not deployed — this page is a visual mockup',
  trainingMetrics = { accuracy: 94.2, accuracyTrend: 1.2, precision: 92.8, precisionTrend: 0.5, recall: 91.5, recallTrend: -0.3, f1: 92.1, f1Trend: 0.0 },
  cpuUsagePct = 45,
  memoryUsedGb = 2.1,
  memoryLimitGb = 4,
  activeReplicas = 3,
  totalReplicas = 3,
}) {
  const [copied, setCopied] = useState(false);
  const [actionNote, setActionNote] = useState(null);
  const placeholderUrl = 'https://your-api-domain.example/v1/models/placeholder/predict';
  const placeholderToken = 'not_a_real_token_ui_placeholder_only';

  const handleCopy = () => {
    navigator.clipboard?.writeText(placeholderUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleAction = (action) => {
    setActionNote(`"${action}" isn't wired to a real deployment yet — this page is a visual reference only.`);
    setTimeout(() => setActionNote(null), 3000);
  };

  const latencyData = Array.from({ length: 13 }, (_, i) => ({ t: -60 + i * 5, latency: null }));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Model Deployment &gt; {clusterName}</p>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-800">{modelName}</h2>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> LIVE (mock)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => handleAction('Rollback')} className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition">
              <RotateCcw size={14} /> Rollback
            </button>
            <button onClick={() => handleAction('Stop Service')} className="flex items-center gap-1.5 px-3.5 py-2 border border-red-200 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition">
              <Square size={14} /> Stop Service
            </button>
            <button onClick={() => handleAction('Update Deployment')} className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition">
              <ArrowUpCircle size={14} /> Update Deployment
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-1">{deployedAt}</p>
        {actionNote && (
          <div className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">{actionNote}</div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Training Metrics</h3>
            <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Validation Set</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Accuracy', value: trainingMetrics.accuracy, trend: trainingMetrics.accuracyTrend },
              { label: 'Precision', value: trainingMetrics.precision, trend: trainingMetrics.precisionTrend },
              { label: 'Recall', value: trainingMetrics.recall, trend: trainingMetrics.recallTrend },
              { label: 'F1 Score', value: trainingMetrics.f1, trend: trainingMetrics.f1Trend },
            ].map((m) => (
              <div key={m.label} className="bg-slate-50 rounded-lg p-3">
                <p className="text-[11px] text-slate-500 mb-1">{m.label}</p>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-lg font-bold text-slate-800">{m.value}%</p>
                  <span className={`text-[10px] font-medium ${m.trend > 0 ? 'text-green-600' : m.trend < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                    {m.trend > 0 ? '↗' : m.trend < 0 ? '↘' : '—'}{Math.abs(m.trend)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
          <button className="text-xs font-medium text-blue-600 hover:underline mt-4">View Full Evaluation Report</button>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Real-time Prediction Latency</h3>
          </div>
          <p className="text-[11px] text-slate-400 mb-3">Rolling 60-second window (ms) — no live telemetry connected</p>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={latencyData}>
                <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={(v) => (v === 0 ? 'Now' : `${v}s`)} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} domain={[0, 150]} axisLine={false} tickLine={false} />
                <Line type="monotone" dataKey="latency" stroke="#2563EB" strokeWidth={2} dot={false} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Endpoint Settings</h3>
            <button className="text-xs font-medium text-blue-600 hover:underline">Edit</button>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-[11px] text-slate-500 mb-1.5">REST API URL (placeholder)</p>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                <p className="text-xs text-slate-600 font-mono flex-1 truncate">{placeholderUrl}</p>
                <button onClick={handleCopy} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
                  {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 mb-1.5">Bearer Token (placeholder — not a real credential)</p>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                <p className="text-xs text-slate-600 font-mono">{placeholderToken}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Resource Allocation</h3>
            <button className="text-xs font-medium text-blue-600 hover:underline">Configure</button>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="flex items-center gap-1.5 text-slate-500"><Cpu size={13} /> CPU Usage (2 Cores limit)</span>
                <span className="font-semibold text-slate-700">{cpuUsagePct}%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600" style={{ width: `${cpuUsagePct}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-500">Memory Allocation ({memoryLimitGb}GB limit)</span>
                <span className="font-semibold text-slate-700">{memoryUsedGb} GB ({Math.round((memoryUsedGb / memoryLimitGb) * 100)}%)</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600" style={{ width: `${(memoryUsedGb / memoryLimitGb) * 100}%` }} />
              </div>
            </div>
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="flex items-center gap-1.5 text-slate-500"><Layers size={13} /> Active Replicas</span>
              <span className="font-semibold text-slate-700">{activeReplicas} / {totalReplicas}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ModelDeployment;