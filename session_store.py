"""
session_store.py — in-memory session state for the pipeline API.

Each uploaded dataset gets a session_id. The session holds the raw
dataframe plus everything produced while running the pipeline (scaler,
trained models, feature columns, etc.) so later requests — feature
importance, predict, download — don't have to re-train anything.

This is intentionally simple (a dict in process memory) since the app
is meant to run as a single backend instance for one user/team at a
time. If this needs to survive restarts or run multi-instance, swap
this out for Redis or a DB-backed store — nothing else in main.py
would need to change.
"""

import threading
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class Session:
    df_raw: Any = None  # the original uploaded dataframe, untouched
        # All worksheets in the uploaded workbook.
    # For CSV files this contains exactly one sheet-like entry.
    sheets: Dict[str, Any] = field(default_factory=dict)

    # Name of the worksheet currently being analyzed.
    active_sheet: Optional[str] = None

    # Original uploaded filename.
    file_name: Optional[str] = None

    target_col: Optional[str] = None
    problem_type: Optional[str] = None

    was_log_transformed: bool = False
    log_target_col: Optional[str] = None  # e.g. "price_log", only set if log-transformed

    clean_report: Optional[dict] = None
    outlier_summary: Optional[dict] = None
    imbalance_counts: Optional[dict] = None

    # Info about the ORIGINAL (pre one-hot-encoding) feature columns.
    # Used by the frontend to render a sensible predict form.
    original_feature_info: Optional[List[dict]] = None
    categorical_columns: Optional[List[str]] = None

    # Final training-time feature columns (post one-hot encoding), in order.
    feature_columns: Optional[List[str]] = None

    scaler: Any = None
    trained_models: Dict[str, Any] = field(default_factory=dict)
    results: Optional[list] = None
    recommended_model: Optional[str] = None

    # If the target was a text label (e.g. "M"/"B"), this holds the
    # sorted class names so predictions can be mapped back from index.
    label_classes: Optional[List[str]] = None


_sessions: Dict[str, Session] = {}
_lock = threading.Lock()


def create_session() -> str:
    session_id = str(uuid.uuid4())
    with _lock:
        _sessions[session_id] = Session()
    return session_id


def get_session(session_id: str) -> Optional[Session]:
    with _lock:
        return _sessions.get(session_id)


def delete_session(session_id: str) -> None:
    with _lock:
        _sessions.pop(session_id, None)
