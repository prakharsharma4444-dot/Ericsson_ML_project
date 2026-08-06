#  Ericsson Support Ticket Analytics & AI Prediction Platform

An end-to-end Machine Learning and Analytics platform designed to parse raw Ericsson support-ticket data, calculate SLA compliance metrics, and deliver automated AI predictions (e.g., ticket priority classification, resolution time estimation, and worker assignment).

---

##  Features

- **Real-Time Analytics Dashboard**
  - **SLA Metrics:** Tracks open cases, overdue tickets, average resolution hours, and SLA compliance percentage.
  - **Status Breakdown & Trends:** Displays weekly ticket volume comparisons (This Week vs. Last Week) via Recharts.
  - **Priority Distribution:** Visualizes critical status buckets (*Overdue, Pending, Closed, Open*).
  - **Urgent Action Tracker:** Directly highlights cases requiring immediate attention or nearing SLA breach targets.

- **Data Exploration & Processing**
  - Automatic column normalization and schema bridging (handles multi-word statuses like "In Progress" and maps 4-level priorities into standardized metrics).
  - Robust date parsing and dataset health summary before running ML pipelines.

- **Automated AI Prediction Engine (AutoML)**
  - Train ML models directly on target fields: **Predict Priority**, **Predict Resolution Time**, or **Predict Best Worker**.
  - Pipeline diagnostic results with model metrics comparisons and feature importance evaluation.
  - Interactive prediction forms to run real-time inference on new ticket samples.

---

##  Tech Stack

### **Frontend**
- **Framework:** React + Vite
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **Icons:** Lucide React

### **Backend**
- **Language:** Python 3.9+
- **API Framework:** FastAPI
- **Server:** Uvicorn
- **Data & ML:** Pandas, NumPy, Scikit-Learn

---

##  Project Structure

```text
ml-project/
├── main.py                     # FastAPI server endpoints & routing
├── pipeline.py                 # ML training & preprocessing pipeline
├── dashboard_stats.py          # Analytics aggregator & SLA metric calculations
├── ericsson_prep.py            # Data cleaning, column normalization & date parsing
├── requirements.txt            # Essential Python dependencies
│
└── frontend/                   # React Vite frontend application
    ├── src/
    │   ├── assets/             # Static assets
    │   ├── components/         # React components (Dashboard, AIPredictions, etc.)
    │   ├── App.jsx             # Main application layout & routing
    │   ├── api.js              # API communication layer
    │   └── main.jsx            # Vite entry point
    ├── package.json
    └── vite.config.js
```

---

## Quickstart Guide

Running this application requires two terminal windows: one for the Python backend API and one for the React frontend.

### Prerequisites
- **Python:** `3.9+`
- **Node.js:** `18.x` or higher
- **npm:** `9.x` or higher

---

### Terminal 1: Backend Setup (FastAPI)

```bash
# 1. Clone the repository
git clone [https://github.com/prakharsharma4444-dot/Ericsson_ML_project.git](https://github.com/prakharsharma4444-dot/Ericsson_ML_project.git)
cd Ericsson_ML_project

# 2. Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate    # On Windows: .venv\Scripts\activate

# 3. Install backend dependencies
pip install -r requirements.txt

# 4. Start the backend API server
uvicorn main:app --reload
```
*The backend API will run on `http://localhost:8000`.*

---

### Terminal 2: Frontend Setup (React + Vite)

Open a **new terminal tab/window** in the project root:

```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Install frontend dependencies
npm install

# 3. Start the Vite development server
npm run dev
```
*The web interface will open at `http://localhost:5173`.*

---

## 📖 How to Use

1. **Dashboard:** View real-time SLA metrics, weekly ticket volume trends, and urgent action items.
2. **Upload Data:** Upload raw Ericsson support CSV files to inspect schema, data health, and missing values.
3. **Train Models:** Select a prediction task (*Priority*, *Resolution Time*, or *Worker Assignment*) to automatically train and evaluate Machine Learning models.
4. **Run Predictions:** Use the interactive prediction tool to estimate parameters for new incoming tickets.

---
