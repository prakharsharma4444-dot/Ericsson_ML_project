const API_BASE = "http://localhost:8000";
export async function getColumns(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/api/sessions/upload`, { method: "POST", body: formData });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  const data = await res.json();
  
  // Return both the session_id and the columns list
  return {
    sessionId: data.session_id,
    columns: Array.isArray(data.columns) 
      ? data.columns.map(c => (typeof c === 'object' && c !== null ? c.name : c)) 
      : []
  };
}

export async function trainModel(sessionId, targetCol) {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/train`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target_col: targetCol })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`trainModel failed (${res.status}): ${text}`);
  }
  return res.json();
}
export async function analyzeDataset(file, targetCol) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("target_col", targetCol);

  // Add "/api" right before "/analyze"
  const res = await fetch(`${API_BASE}/api/analyze`, { 
    method: "POST", 
    body: formData 
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`analyzeDataset failed (${res.status}): ${text}`);
  }
  return res.json();
}
export async function predictSample(sessionId, modelName, sample) {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model_name: modelName, sample }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`predictSample failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function getFeatureImportance(sessionId, modelName) {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/feature-importance/${modelName}`);
  if (!res.ok) throw new Error(`getFeatureImportance failed (${res.status})`);
  return res.json();
}
export async function getPreview(sessionId) {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/preview`);
  if (!res.ok) throw new Error(`getPreview failed (${res.status})`);
  return res.json();
}

export async function compareColumns(sessionId, col1, col2) {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/compare?col1=${encodeURIComponent(col1)}&col2=${encodeURIComponent(col2)}`);
  if (!res.ok) throw new Error(`compareColumns failed (${res.status})`);
  return res.json();
}
export async function getColumnDetail(sessionId, colName) {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/columns/${encodeURIComponent(colName)}`);
  if (!res.ok) throw new Error('Failed to fetch column details');
  return res.json();
}
// Feature 4: Fetch Pivot / Group-By Data
export async function getPivotData(sessionId, catCol, numCol, aggFunc) {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/pivot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cat_col: catCol,
      num_col: numCol,
      agg_func: aggFunc,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pivot query failed (${res.status}): ${text}`);
  }

  return await res.json();
}

// Feature 5: Get Profiling Report URL
export function getReportUrl(sessionId) {
  return `${API_BASE}/api/sessions/${sessionId}/report`;
}