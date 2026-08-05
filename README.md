cat << 'EOF' > README.md
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
- **API Framework:** FastAPI / Flask
- **Data & ML:** Pandas, NumPy, Scikit-Learn

---

## Project Structure

```text
ml-project/
├── main.py                     # API server endpoints & routing
├── pipeline.py                 # ML training & preprocessing pipeline
├── dashboard_stats.py          # Analytics aggregator & SLA metric calculations
├── ericsson_prep.py            # Data cleaning, column normalization & date parsing
├── requirements.txt            # Python dependencies
│
└── frontend/                   # React Vite frontend application
    ├── src/
    │   ├── assets/             # Logos & static assets
    │   ├── components/         # React components
    │   │   ├── Dashboard.jsx            # Analytics Dashboard UI
    │   │   ├── AIPredictions.jsx        # Target column / task selection
    │   │   ├── DataExploreScreen.jsx    # Dataset summary & feature inspector
    │   │   ├── PipelineResults.jsx      # Model evaluation & diagnostics
    │   │   ├── ModelDeployment.jsx      # Export & deployment tools
    │   │   ├── Sidebar.jsx              # Navigation sidebar
    │   │   └── TopBar.jsx               # Header bar
    │   ├── App.jsx             # Main application flow & state routing
    │   ├── api.js              # Frontend API client
    │   └── main.jsx            # Vite entry point
    ├── package.json
    └── vite.config.js
```

---

##  Quickstart Guide

### Prerequisites
- **Python:** `3.9+`
- **Node.js:** `18.x` or higher
- **npm:** `9.x` or higher

---

### 1. Backend Setup

```bash
# Clone the repository
git clone [https://github.com/your-username/ml-project.git](https://github.com/your-username/ml-project.git)
cd ml-project

# Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate    # On Windows: .venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Start the backend server
python main.py
```

---

### 2. Frontend Setup

Open a new terminal window in the project root:

```bash
# Navigate to frontend directory
cd frontend

# Install Node modules
npm install

# Start the Vite development server
npm run dev
```

The frontend application will be running at `http://localhost:5173`.

---

## How to Use

1. **Upload Data:** Upload raw Ericsson support CSV files on the **Upload Data** tab.
2. **Explore Data:** Inspect columns, shape, and dataset features in the Data Exploration view.
3. **Select Prediction Task:** Click **Make Prediction with AI** or select a target column (*Priority*, *Resolution Time*, *Best Worker*) to train machine learning models.
4. **Evaluate & Infer:** Review model performance metrics, feature importances, and run test predictions directly through the interactive form.
5. **View Dashboard:** Navigate to the **Dashboard** tab to view live metrics, SLA compliance stats, and urgent case alerts.

---
