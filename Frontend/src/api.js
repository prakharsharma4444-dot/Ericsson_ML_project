// Dynamic getter for configured FastAPI Server URL
const getApiBase = () => {
  const settings = JSON.parse(localStorage.getItem('app_settings') || '{}');
  return settings.apiUrl || 'http://localhost:8000';
};

export async function getColumns(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${getApiBase()}/api/sessions/upload`, { method: "POST", body: formData });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  const data = await res.json();
  
    return {
    sessionId: data.session_id,
    columns: Array.isArray(data.columns)
      ? data.columns.map(c => (
          typeof c === 'object' && c !== null ? c.name : c
        ))
      : [],
    filename: data.filename,
    activeSheet: data.active_sheet || null,
    sheets: Array.isArray(data.sheets) ? data.sheets : [],
  };
}
export async function getSheets(sessionId) {
  const res = await fetch(
    `${getApiBase()}/api/sessions/${sessionId}/sheets`
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`getSheets failed (${res.status}): ${text}`);
  }

  return res.json();
}


export async function selectSheet(sessionId, sheetName) {
  const res = await fetch(
    `${getApiBase()}/api/sessions/${sessionId}/sheet`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sheet_name: sheetName,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`selectSheet failed (${res.status}): ${text}`);
  }

  return res.json();
}
export async function mergeDatasets(fileA, fileB, mode = 'concat') {
  const formData = new FormData();
  formData.append('file_a', fileA);
  formData.append('file_b', fileB);
  formData.append('mode', mode); // 'concat' (stack rows) or 'join' (relational join)

  const res = await fetch(`${getApiBase()}/api/merge`, { method: 'POST', body: formData });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Merge failed (${res.status}): ${text}`);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const suggestedName = match ? match[1] : 'combined_dataset.csv';

  const file = new File([blob], suggestedName, { type: 'text/csv' });
  return { file, name: suggestedName };
}
export async function trainModel(sessionId, targetCol, task = null) {
  const settings = JSON.parse(localStorage.getItem('app_settings') || '{}');
  const testSplitRatio = settings.testSplit ? settings.testSplit / 100 : undefined;

  const body = {
    ...(task ? { target_col: targetCol || "", task } : { target_col: targetCol }),
    ...(testSplitRatio !== undefined ? { test_size: testSplitRatio } : {})
  };

  const res = await fetch(`${getApiBase()}/api/sessions/${sessionId}/train`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
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

  const res = await fetch(`${getApiBase()}/api/analyze`, { 
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
  const res = await fetch(`${getApiBase()}/api/sessions/${sessionId}/predict`, {
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
  const encodedModelName = encodeURIComponent(modelName);

  const res = await fetch(
    `${getApiBase()}/api/sessions/${sessionId}/feature-importance/${encodedModelName}`
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `getFeatureImportance failed (${res.status}): ${text}`
    );
  }

  return res.json();
}

export async function getDashboardSummary(sessionId) {
  const res = await fetch(`${getApiBase()}/api/sessions/${sessionId}/dashboard-summary`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`getDashboardSummary failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function getPreview(sessionId) {
  const res = await fetch(`${getApiBase()}/api/sessions/${sessionId}/preview`);
  if (!res.ok) throw new Error(`getPreview failed (${res.status})`);
  return res.json();
}

export async function compareColumns(sessionId, col1, col2) {
  const res = await fetch(`${getApiBase()}/api/sessions/${sessionId}/compare?col1=${encodeURIComponent(col1)}&col2=${encodeURIComponent(col2)}`);
  if (!res.ok) throw new Error(`compareColumns failed (${res.status})`);
  return res.json();
}

export async function getColumnDetail(sessionId, colName) {
  const res = await fetch(`${getApiBase()}/api/sessions/${sessionId}/columns/${encodeURIComponent(colName)}`);
  if (!res.ok) throw new Error('Failed to fetch column details');
  return res.json();
}

export async function getPivotData(sessionId, catCol, numCol, aggFunc) {
  const res = await fetch(`${getApiBase()}/api/sessions/${sessionId}/pivot`, {
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

export function getReportUrl(sessionId) {
  return `${getApiBase()}/api/sessions/${sessionId}/report`;
}

export async function downloadModel(sessionId, modelName) {
  const res = await fetch(`${getApiBase()}/api/sessions/${sessionId}/download-model/${encodeURIComponent(modelName)}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`downloadModel failed (${res.status}): ${text}`);
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${modelName.replace(/[^a-zA-Z0-9]/g, "_")}.joblib`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}



 