# SupportIQ — Intelligent Support Ticket Analytics & Prediction Platform

SupportIQ is a browser-based support-ticket intelligence platform built as a Major Project I foundation.

It combines operational ticket analytics, automated machine learning, interactive prediction, multi-sheet Excel support, and a natural-language AI Analyst in one workflow. The system is designed for support operations across domains rather than being tied to a single company.

## Core Workflow

```text
Upload Ticket Data
       ↓
Explore Queue Health
       ↓
SLA / Priority / Status Analytics
       ↓
Ticket-specific ML or Generic Target Selection
       ↓
Preprocessing + Feature Engineering
       ↓
Model Training + Cross-Validation
       ↓
Model Comparison
       ↓
Prediction
       ↓
AI Analyst
```

## Support-Ticket Capabilities

### Queue Analytics
The support dashboard can present:

- open and overdue tickets
- SLA compliance
- average resolution time
- priority distribution
- status breakdown
- recent ticket activity
- tickets requiring attention

### Ticket Prediction
For support-ticket datasets with the expected fields, the platform provides preset ML tasks:

- Predict Ticket Priority
- Predict Resolution Time
- Predict Case Owner

The underlying ML pipeline remains reusable, so users can also select another target column.

### Ticket Text
Support-ticket descriptions and subjects can be processed into numerical features using TF-IDF. The support-ticket adapter also derives date/SLA and resolution-duration features.

### General Tabular Support
The platform still accepts CSV, XLSX and XLS files and can fall back to a generic analytics/ML workflow for other structured datasets.

### Multi-Sheet Excel
A workbook can contain multiple usable worksheets. Users can switch the active worksheet, and trained-model state is reset when the feature schema changes.

### AI Analyst
The AI Analyst provides natural-language access to the active dataset. Gemini interprets the question and selects controlled analytical tools while Python/Pandas performs the calculations.

Example questions:

- Which priority is most common?
- Which product has the longest average resolution time?
- Which case owner handles the most open tickets?
- Are there overdue or unusual tickets?
- What are the most important things I should know about this queue?

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

### AI
- Google Gemini
- Google GenAI SDK

### File Processing
- OpenPyXL
- xlrd

## Project Structure

```text
SupportIQ/
│
├── main.py
├── pipeline.py
├── support_ticket_prep.py
├── dashboard_stats.py
├── session_store.py
├── ai_analyst.py
├── jsonsafe.py
└── Frontend/
```

## Major Project I

Major Project I establishes the core support-ticket intelligence platform.

The platform is intentionally not tied to Ericsson or another single organization. Its support-ticket model can be used for IT support, telecom operations, enterprise service desks, customer support, and similar workflows.

## Major Project II Direction

The second stage can extend the system with:

- persistent database-backed ticket history
- authentication and role-based access
- real-time ticket ingestion through APIs
- automated retraining and model monitoring
- model registry and experiment tracking
- background processing
- advanced agentic workflows
- deployment and observability

## Academic Scope

The system is intended for analytics, experimentation, and decision support. Model recommendations support human decisions and should be interpreted with dataset quality and domain context.
