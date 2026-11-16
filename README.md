# InsightForge — Intelligent Data Analytics & ML Platform

InsightForge is a browser-based data analytics and machine-learning platform developed as a Major Project I foundation.

It provides a connected workflow for dataset upload, exploration, data-quality analysis, analytics, classification/regression, model evaluation, interactive prediction, and multi-sheet Excel analysis.

The project is designed around reusable tabular-data workflows rather than a single fixed business dataset. It also includes a generic natural-language AI Analyst that works with the active dataset.

## Core Workflow

```text
Upload Dataset
      ↓
Data Exploration
      ↓
Data Quality + Analytics
      ↓
Target Selection
      ↓
Preprocessing + Feature Engineering
      ↓
Model Training
      ↓
Cross-Validation + Evaluation
      ↓
Model Recommendation
      ↓
Interactive Prediction
```

## Main Capabilities

### Dataset Workspace
Supports CSV, XLSX and XLS files. Users can preview records, inspect column types, check missing values, explore distributions, compare columns, and inspect dataset quality.

### Multi-Sheet Excel
A workbook can contain multiple usable worksheets. The application keeps the sheets in the current session, lets the user switch the active sheet, and resets trained-model state when the feature schema changes.

### Automated Machine Learning
The ML pipeline adapts to classification or regression tasks and includes validation, cleaning, median imputation, categorical encoding, feature engineering, feature selection, outlier analysis, class-imbalance analysis, scaling, cross-validation, model comparison, model recommendation, feature importance, and prediction.

### Analytics
The dashboard provides dataset-level intelligence including row and column counts, missingness, duplicates, numeric summaries, categorical distributions, time trends, correlations, relationships, and dataset-health findings.

### Prediction
After a model is trained, the user can enter a new record through a guided prediction form. The backend keeps the training feature order and transformation state aligned with inference.

### AI Analyst
The AI Analyst lets users ask natural-language questions about the active dataset. Gemini interprets the question and selects controlled analytical tools; Python/Pandas performs the calculations. The feature is dataset-agnostic and is not tied to one business domain.

## Technology Stack

### Frontend
- React
- Vite
- Tailwind CSS
- Recharts
- Lucide React

### Backend
- Python
- FastAPI
- Pandas
- NumPy
- Scikit-learn
- Joblib

### File Processing
- OpenPyXL
- xlrd

### Development
- Git
- GitHub

## Project Structure

```text
InsightForge/
│
├── main.py                 # FastAPI application and API routes
├── pipeline.py             # Generalized ML pipeline
├── support_ticket_prep.py  # Optional support-ticket preparation adapter
├── dashboard_stats.py      # Analytics and dashboard calculations
├── session_store.py        # Active dataset and model state
├── ai_analyst.py           # Generic natural-language dataset analysis
├── jsonsafe.py             # JSON-safe backend responses
└── Frontend/               # React application
```

## Major Project I Direction

This branch is intentionally positioned as a distinct Major Project I application built on a proven data/ML foundation.

The first stage focuses on:
- reusable tabular-data analytics
- automated ML
- model comparison and prediction
- multi-sheet data workflows
- clean frontend/backend/ML separation

Major Project II can extend this foundation with persistent storage, authentication, experiment tracking, background jobs, model registry, monitoring, deployment, additional data connectors, and advanced AI-assisted analysis.

## Academic Scope

The platform is intended for experimentation, analytics, and decision support. Model recommendations should be interpreted alongside dataset quality and domain context rather than treated as automatic guarantees of business correctness.
