"""
ericsson_prep.py — task-specific preprocessing for Ericsson support-ticket data.

Your mentor's format (case number, subject, contact name, status, priority,
date open, case owner, call back target, remedy targeet, solution target,
product, answer, desc) is a very different shape than the Kaggle datasets
this pipeline was built on: it has free text, datetimes, and ID/PII columns
that pipeline.py's generic clean_data/encode_categoricals doesn't know how
to handle safely.

This module turns the raw ticket export into a dataframe + target column
that IS safe to feed straight into the existing generalized pipeline
(validate_inputs, clean_data, encode_categoricals, detect_problem_type,
etc.) — no changes needed to pipeline.py or main.py's core training logic.

Supports three tasks (matching what you're actually trying to predict):
  "priority"    -> classification, predict priority (Low/Medium/High/...)
  "resolution"  -> regression, predict hours between date_open and solution_target
  "owner"       -> classification, predict which case_owner (worker) fits a ticket

Usage:
    import pandas as pd
    from ericsson_prep import prepare_ticket_data

    df_raw = pd.read_csv("tickets.csv")
    df_ready, target_col = prepare_ticket_data(df_raw, task="priority")

    # df_ready + target_col now work with the existing generic pipeline
    # exactly like any other dataset:
    from pipeline import validate_inputs, detect_problem_type, clean_data, ...
"""

import pandas as pd
import numpy as np


# Pure identifiers / PII — never useful as model features. One-hot encoding
# these would explode into thousands of meaningless columns.
ID_AND_PII_COLUMNS = ["case number", "contact name"]

# Raw datetime columns in the ticket export. Parsed into numeric/calendar
# features below, then dropped (raw timestamps aren't usable as-is).
DATE_COLUMNS = ["date open", "call back target", "remedy targeet", "solution target"]

# Free-text columns — dropped entirely, not turned into features. Per your
# mentor: severity/priority should be driven by how long a ticket has been
# active, not by anything in the description text.
TEXT_COLUMNS = ["subject", "desc", "answer"]

VALID_TASKS = {"priority", "resolution", "owner"}


def _normalize_columns(df):
    """Lowercase + strip column names so the schema is stable regardless
    of casing/spacing in whatever export your mentor actually sends."""
    df = df.copy()
    df.columns = [str(c).strip().lower() for c in df.columns]
    return df


def _parse_dates(df):
    df = df.copy()
    for col in DATE_COLUMNS:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")
    return df


def _add_time_features(df):
    """Extracts calendar features from date_open — raw timestamps aren't
    usable as model features directly, but day-of-week/hour often are
    (e.g. tickets opened late Friday might skew toward certain priorities)."""
    df = df.copy()
    if "date open" in df.columns:
        df["opened_day_of_week"] = df["date open"].dt.dayofweek
        df["opened_hour"] = df["date open"].dt.hour
    return df


def _add_duration_open_feature(df, reference_time=None):
    """The main driver your mentor asked for: how long has this ticket
    been active. Computed as hours between 'date open' and a reference
    time (defaults to right now — i.e. this assumes you're feeding it a
    snapshot of currently-open tickets, which is the realistic use case
    for a live triage/escalation model).

    IMPORTANT CAVEAT: if the real export includes a proper 'last updated'
    or 'status timestamp' column, use that as reference_time instead of
    'now' — it'll be far more accurate than assuming everything is being
    checked at the exact moment you run this. For CLOSED/resolved tickets
    in historical training data, 'hours_open' computed against 'now' is
    only a rough proxy for how long the ticket was actually active before
    it closed — worth flagging to your mentor once real data is in hand.
    """
    df = df.copy()
    if "date open" not in df.columns:
        return df
    ref = reference_time if reference_time is not None else pd.Timestamp.now()
    delta_hours = (ref - df["date open"]).dt.total_seconds() / 3600
    # Clip negative values (e.g. bad/future timestamps) to 0 rather than
    # letting them silently corrupt the feature.
    df["hours_open"] = delta_hours.clip(lower=0)
    return df


def _compute_resolution_hours(df):
    """Regression target: hours between ticket open and its solution
    target deadline. NOTE: this is the SLA window, not necessarily how
    long the ticket actually took — if you later get a real 'date closed'
    column from actual case data, swap that in here for a true outcome."""
    df = df.copy()
    if "date open" in df.columns and "solution target" in df.columns:
        delta = df["solution target"] - df["date open"]
        df["resolution_hours"] = delta.dt.total_seconds() / 3600
    return df


def prepare_ticket_data(df_raw, task):
    """
    Prepares raw Ericsson ticket data for one of three prediction tasks.

    Args:
        df_raw: the raw uploaded dataframe (any column casing/spacing).
        task: one of "priority", "resolution", "owner".

    Returns:
        (df_ready, target_col) — df_ready is safe to pass straight into
        pipeline.py's validate_inputs/clean_data/encode_categoricals/etc.,
        with target_col as the column name to predict.
    """
    if task not in VALID_TASKS:
        raise ValueError(f"task must be one of {VALID_TASKS}, got '{task}'")

    df = _normalize_columns(df_raw)
    df = _parse_dates(df)
    df = _add_time_features(df)
    df = _add_duration_open_feature(df)

    if task == "resolution":
        df = _compute_resolution_hours(df)
        target_col = "resolution_hours"
        if target_col not in df.columns or df[target_col].isnull().all():
            raise ValueError(
                "Couldn't compute resolution_hours — check that 'date open' "
                "and 'solution target' columns exist and contain valid dates."
            )
    elif task == "priority":
        target_col = "priority"
    else:  # task == "owner"
        target_col = "case owner"

    if target_col not in df.columns:
        raise ValueError(f"Expected column '{target_col}' not found in dataset.")

    # Columns that should never be model features: IDs/PII, raw datetime
    # columns (already featurized above), and free text (per your mentor,
    # not used as a signal at all right now).
    drop_cols = set(ID_AND_PII_COLUMNS) | set(DATE_COLUMNS) | set(TEXT_COLUMNS)

    # Leakage guard: 'status' is typically only meaningful/updated after
    # triage, so including it would let the model cheat by seeing outcome
    # info. Drop it for all three tasks. ('answer' already covered above.)
    drop_cols |= {"status"}

    drop_cols = {c for c in drop_cols if c in df.columns and c != target_col}
    df = df.drop(columns=list(drop_cols))

    return df, target_col