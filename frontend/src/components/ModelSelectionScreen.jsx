export default function ModelSelectionScreen({ columns = [], onSelectTarget }) {
  // Ensure columns is always treated safely as an array
  const safeColumns = Array.isArray(columns) ? columns : [];

  return (
    <div className="p-6 bg-white rounded-lg shadow">
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