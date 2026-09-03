# Ericsson Support Ticket Analytics & AI Prediction Platform

An end-to-end **Machine Learning, Analytics, and AI-powered data analysis platform** built for Ericsson support-ticket data and other structured/tabular datasets.

The platform combines interactive dashboards, automated machine learning, data exploration, multi-sheet Excel support, real-time predictions, analysis history, and a natural-language AI Analyst powered by Google Gemini.

---

## Features

### 📊 Analytics Dashboard

Provides an interactive overview of the active dataset, including:

- Total cases and records
- Open, closed, pending, and overdue cases
- SLA compliance metrics
- Average resolution time
- Ticket and status distributions
- Priority distributions
- Weekly trends
- Recent activity
- Cases requiring attention

The dashboard automatically refreshes when the active worksheet changes.

### 📁 Data Upload & Exploration

Supports:

- CSV (`.csv`)
- Excel (`.xlsx`)
- Legacy Excel (`.xls`)

The Data Explorer provides:

- Dataset preview
- Column information
- Data types
- Missing values
- Unique values
- Numeric statistics
- Categorical distributions
- Column-level analysis
- Column relationships
- Pivot-style analysis
- Dataset health checks

### 📑 Multi-Sheet Excel Support

Excel workbooks containing multiple worksheets are supported.

When a workbook is uploaded:

1. All worksheets are loaded.
2. Empty worksheets are ignored.
3. The first usable worksheet becomes the active worksheet.
4. Available worksheets are displayed in the frontend.
5. Users can switch between worksheets.
6. Dashboard and data exploration views automatically refresh.
7. ML state is reset when switching worksheets to prevent a model trained on one worksheet from being used with another.

CSV files are treated as a single worksheet named `Sheet1`.

### 🔀 Dataset Merging

Two datasets can be combined using:

- **Concatenation** — stacks compatible datasets row-wise.
- **Join** — combines datasets using a shared column.

### 🕒 Analysis History

Previous analyses run in the application are retained and can be reviewed from the History screen, making it possible to revisit earlier datasets, models, and results without re-running the pipeline.

---

## 🤖 Machine Learning

The platform provides an automated ML pipeline for both **classification and regression** problems.

### Ericsson Prediction Tasks

- **Predict Priority**
- **Predict Resolution Time**
- **Predict Best Worker**

The system also supports generic target-based ML by allowing users to select a target column.

### ML Pipeline

```text
Dataset
   ↓
Target Selection
   ↓
Validation
   ↓
Problem-Type Detection
   ↓
Data Cleaning
   ↓
Feature Engineering
   ↓
Train/Test Split
   ↓
Feature Selection
   ↓
Outlier Analysis
   ↓
Scaling
   ↓
Cross-Validation
   ↓
Model Training
   ↓
Evaluation
   ↓
Model Recommendation
   ↓
Feature Importance
   ↓
Prediction
```

The pipeline includes:

- Missing-value handling
- Categorical encoding
- Numeric processing
- Feature engineering
- Train/test splitting
- Feature selection
- Outlier analysis
- Class imbalance detection
- Automatic scaler selection
- Cross-validation
- Model comparison
- Model recommendation
- Feature importance analysis
- Interactive prediction

Target-dependent preprocessing is performed using training data to reduce the risk of data leakage.

### 🔮 Interactive Predictions

After training a model, users can enter new data through an interactive prediction form.

The form adapts to the features used by the trained model and supports numeric, categorical, text, and dataset-specific inputs.

### 📥 Model Download & Deployment

Trained models can be downloaded directly from the backend for later use, and the frontend includes a Model Deployment screen for working with trained models and their prediction configuration.

---

## 🧠 AI Analyst

The **AI Analyst** provides a natural-language interface for exploring the active dataset.

Users can ask questions such as:

> What are the most important things I should know about this dataset?

> Which priority is most common?

> Which product has the longest average resolution time?

> Are there any unusual or overdue cases?

> Which team handles the most cases?

The AI Analyst is designed to work with **general tabular datasets**, rather than being limited to Ericsson ticket data.

### How It Works

```text
User Question
      ↓
React AI Analyst
      ↓
FastAPI
      ↓
Gemini
      ↓
Analytical Tool Selection
      ↓
Python / Pandas
      ↓
Calculated Results
      ↓
Gemini Explanation
      ↓
Answer
```

Python/Pandas acts as the source of truth for dataset calculations. Gemini interprets the user's question, selects the required analytical operations, and explains the calculated results.

### AI Analysis Capabilities

The AI Analyst can perform:

- Dataset profiling
- Column profiling
- Filtering
- Grouping
- Aggregations
- Sorting
- Correlation analysis
- Relationship analysis
- Outlier detection
- Time-trend analysis
- Date-difference analysis
- Text search
- Missing-value analysis

AI conversations are maintained per analysis session, allowing follow-up questions to use previous conversation context.

---

## 🛠️ Tech Stack

### Frontend

- **React**
- **Vite**
- **Tailwind CSS**
- **Recharts**
- **Lucide React**

### Backend

- **Python**
- **FastAPI**
- **Uvicorn**
- **Pandas**
- **NumPy**
- **Scikit-Learn**
- **SciPy**
- **Joblib**

### File Processing

- **OpenPyXL** — `.xlsx`
- **xlrd** — `.xls`

### AI

- **Google Gemini**
- **Google GenAI SDK**

---

## 📂 Project Structure

```text
Ericsson_ML_project/
│
├── main.py
│   └── FastAPI application and API endpoints
│
├── ai_analyst.py
│   └── Gemini-powered AI Analyst and analytical tools
│
├── pipeline.py
│   └── ML preprocessing, training, evaluation and model selection
│
├── dashboard_stats.py
│   └── Dashboard and analytics calculations
│
├── ericsson_prep.py
│   └── Ericsson-specific data preprocessing and feature engineering
│
├── jsonsafe.py
│   └── JSON-safe data conversion utilities
│
├── session_store.py
│   └── Analysis session management
│
├── requirements.txt
│   └── Python dependencies
│
├── .env.example
│   └── Example Gemini configuration
│
└── Frontend/
    │
    ├── package.json
    ├── vite.config.js
    ├── eslint.config.js
    │
    └── src/
        ├── App.jsx
        ├── App.css
        ├── api.js
        ├── assets/
        │
        └── components/
            ├── AIAnalyst.jsx
            ├── AIPredictions.jsx
            ├── ColumnMapper.jsx
            ├── Dashboard.jsx
            ├── DataExploreScreen.jsx
            ├── GenericDashboard.jsx
            ├── HistoryScreen.jsx
            ├── ModelDeployment.jsx
            ├── ModelSelectionCard.jsx
            ├── ModelSelectionScreen.jsx
            ├── NeedsAttention.jsx
            ├── PipelineResults.jsx
            ├── PivotBuilder.jsx
            ├── PredictionForm.jsx
            ├── PriorityChart.jsx
            ├── RecentActivity.jsx
            ├── SettingsScreen.jsx
            ├── Sidebar.jsx
            ├── TopBar.jsx
            └── UploadCard.jsx
```

---

## 🚀 Quickstart

### Prerequisites

- Python 3.9+
- Node.js 18+
- npm 9+

### 1. Clone the Repository

```bash
git clone https://github.com/prakharsharma4444-dot/Ericsson_ML_project.git
cd Ericsson_ML_project
```

### 2. Backend Setup

Create a virtual environment.

**Linux/macOS**

```bash
python3 -m venv .venv
source .venv/bin/activate
```

**Windows PowerShell**

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start FastAPI:

```bash
uvicorn main:app --reload
```

The backend runs on:

```text
http://localhost:8000
```

FastAPI documentation:

```text
http://localhost:8000/docs
```

### 3. Gemini API Setup

The AI Analyst requires a Google Gemini API key.

The repository includes `.env.example` as a configuration template:

```text
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.1-flash-lite
```

**Linux/macOS**

Set the key in the terminal used to start FastAPI:

```bash
export GEMINI_API_KEY="YOUR_ACTUAL_GEMINI_API_KEY"
```

Verify without displaying the key:

```bash
if [ -n "$GEMINI_API_KEY" ]; then
    echo "GEMINI_API_KEY is set"
else
    echo "GEMINI_API_KEY is NOT set"
fi
```

**Windows PowerShell**

```powershell
$env:GEMINI_API_KEY="YOUR_ACTUAL_GEMINI_API_KEY"
```

Verify:

```powershell
if ($env:GEMINI_API_KEY) {
    "GEMINI_API_KEY is set"
} else {
    "GEMINI_API_KEY is NOT set"
}
```

**Never commit the actual API key to Git or place it directly in source code.**

### 4. Frontend Setup

Open a second terminal:

```bash
cd Frontend
npm install
npm run dev
```

The frontend normally runs on:

```text
http://localhost:5173
```

### 5. Run Both Servers Together

From the `Frontend/` directory:

```bash
npm run dev:all
```

This starts:

```text
Frontend → http://localhost:5173
Backend  → http://localhost:8000
```

---

## 📖 Usage

1. **Upload Data** — Upload a CSV or Excel dataset.
2. **Select Worksheet** — Choose a worksheet when using a multi-sheet Excel workbook.
3. **Explore Data** — Inspect columns, statistics, missing values, and dataset health.
4. **View Dashboard** — Review analytics and, where applicable, Ericsson ticket/SLA metrics.
5. **Train a Model** — Select a prediction task or target column and run the ML pipeline.
6. **Review Results** — Compare models, metrics, cross-validation results, and feature importance.
7. **Make Predictions** — Use the prediction interface with a trained model.
8. **Use AI Analyst** — Ask natural-language questions about the active dataset.
9. **Review History** — Revisit previous analyses, models, and results from the History screen.
10. **Configure Settings** — Adjust options such as API URL, test split, and application theme.

---

## 🔗 Main API Endpoints

> Full request/response details are available via the interactive Swagger docs at `http://localhost:8000/docs` once the backend is running.

**Health**

```text
GET /api/health
```

**Data**

```text
POST /api/sessions/upload
GET  /api/sessions/{session_id}/sheets
POST /api/sessions/{session_id}/sheet
GET  /api/sessions/{session_id}/columns
GET  /api/sessions/{session_id}/preview
GET  /api/sessions/{session_id}/columns/{column_name}
```

**Analytics**

```text
GET  /api/sessions/{session_id}/dashboard-summary
GET  /api/sessions/{session_id}/compare
POST /api/sessions/{session_id}/pivot
GET  /api/sessions/{session_id}/report
```

**Machine Learning**

```text
POST /api/sessions/{session_id}/validate
POST /api/sessions/{session_id}/train
GET  /api/sessions/{session_id}/models
GET  /api/sessions/{session_id}/feature-importance/{model_name}
POST /api/sessions/{session_id}/predict
GET  /api/sessions/{session_id}/download-model/{model_name}
```

**AI Analyst**

```text
POST /api/sessions/{session_id}/ai/chat
```

---

## 🌿 Git Branches

The project uses separate branches for stable and AI-enabled development.

### `main`

The stable branch containing the core non-AI application:

- Analytics dashboard
- Data exploration
- Multi-sheet support
- Dataset merging
- ML pipeline
- Predictions
- Model management

### `ai-analyst`

The development branch containing the AI Analyst functionality in addition to the core application.

AI-specific components include:

```text
ai_analyst.py
Frontend/src/components/AIAnalyst.jsx
```

and:

```text
POST /api/sessions/{session_id}/ai/chat
```

---

## 🔐 Security

- Gemini API keys must be provided through environment variables.
- Real API keys must never be committed to the repository.
- `.env.example` contains configuration placeholders only.
- Do not place API credentials directly inside Python or React source files.

---

## 📌 Architecture

```text
                    ┌─────────────────────┐
                    │   React Frontend    │
                    │    Vite + React     │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │       api.js        │
                    │  API communication  │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │       FastAPI       │
                    │       main.py       │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
       ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
       │  Analytics  │  │ ML Pipeline │  │ AI Analyst  │
       │ dashboard_  │  │ pipeline.py │  │ai_analyst.py│
       │  stats.py   │  └─────────────┘  └──────┬──────┘
       └─────────────┘                          │
                                                 ▼
                                      ┌─────────────────┐
                                      │  Google Gemini  │
                                      └─────────────────┘
```

---

## 📄 License

This project is currently intended for development, experimentation, and internal project use.
