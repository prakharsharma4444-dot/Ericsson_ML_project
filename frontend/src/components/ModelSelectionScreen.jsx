const TICKET_PRESETS = [
  {
    task: "priority",
    label: "Predict Priority",
    description: "Classify ticket priority (Low / Medium / High / Critical)",
  },
  {
    task: "resolution",
    label: "Predict Resolution Time",
    description: "Estimate hours from ticket open to solution target",
  },
  {
    task: "owner",
    label: "Predict Best Worker",
    description: "Recommend which case owner should handle a ticket",
  },
];

// Columns that, if present together, indicate this is Ericsson-style
// support-ticket data (matches ericsson_prep.py's expected schema).
const TICKET_SIGNATURE_COLUMNS = ["priority", "case owner", "solution target"];

export default function ModelSelectionScreen({ columns = [], onSelectTarget, onSelectTask }) {
  const safeColumns = Array.isArray(columns) ? columns : [];
  const normalizedCols = safeColumns.map((c) => String(c).trim().toLowerCase());

  const looksLikeTicketData = TICKET_SIGNATURE_COLUMNS.every((col) =>
    normalizedCols.includes(col)
  );

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      {looksLikeTicketData && onSelectTask && (
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-1">Ticket Data Detected</h2>
          <p className="text-sm text-gray-500 mb-4">
            This looks like Ericsson support-ticket data. Pick what you want to predict:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {TICKET_PRESETS.map((preset) => (
              <button
                key={preset.task}
                onClick={() => onSelectTask(preset.task)}
                className="p-4 text-left border-2 border-blue-100 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition"
              >
                <div className="font-semibold text-blue-700">{preset.label}</div>
                <div className="text-xs text-gray-500 mt-1">{preset.description}</div>
              </button>
            ))}
          </div>
          <div className="text-xs text-gray-400 mt-4 mb-2">
            Or pick a raw column below instead:
          </div>
        </div>
      )}

      <h2 className="text-xl font-bold mb-4">Select Target Column</h2>
      <div className="grid grid-cols-1 gap-3">
        {safeColumns.map((col) => (
          <button
            key={col}
            onClick={() => onSelectTarget(col)}
            className="p-3 text-left border rounded hover:bg-blue-50 transition"
          >
            {col}
          </button>
        ))}
      </div>
    </div>
  );
}