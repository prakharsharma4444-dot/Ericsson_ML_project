"""
ericsson_prep.py — Preprocessing pipeline for Ericsson support tickets.
Includes TF-IDF keyword extraction, non-numerical value sanitization, and SLA duration logic.
"""

import re
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

ID_AND_PII_COLUMNS = ["case number", "contact name"]
DATE_COLUMNS = ["date open", "call back target", "remedy targeet", "solution target"]
TEXT_COLUMNS = ["subject", "desc", "answer"]

VALID_TASKS = {"priority", "resolution", "owner"}

NEGATIVE_WORDS = {
    "error", "failed", "failure", "crash", "bug", "down", "outage", "issue", 
    "broken", "slow", "urgent", "critical", "severe", "bad", "worst", "blocked",
    "cannot", "unable", "denied", "freeze", "hanging", "corrupt", "fault"
}


def _normalize_columns(df):
    df = df.copy()
    df.columns = [str(c).strip().lower() for c in df.columns]
    return df


def _parse_dates(df):
    df = df.copy()
    for col in DATE_COLUMNS:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")
    return df


def _clean_non_numeric_values(df):
    """
    Coerces mixed/dirty non-numeric values in numeric SLA/time columns into numbers safely.
    """
    df = df.copy()
    numeric_target_cols = [
        "hours_open", "target_callback_hours", "target_solution_hours", 
        "resolution_hours", "resolution_time", "target_callback_time"
    ]
    
    for col in df.columns:
        if col in numeric_target_cols or col.startswith("prod_") or col.startswith("tfidf_"):
            df[col] = pd.to_numeric(df[col], errors="coerce")
            median_val = df[col].median() if not np.isnan(df[col].median()) else 0
            df[col] = df[col].fillna(median_val)
            
    return df


def _add_sla_duration_features(df):
    """Computes SLA target durations in hours."""
    df = df.copy()
    if "date open" in df.columns:
        if "solution target" in df.columns:
            df["target_solution_hours"] = (
                (df["solution target"] - df["date open"]).dt.total_seconds() / 3600
            )
        if "call back target" in df.columns:
            df["target_callback_hours"] = (
                (df["call back target"] - df["date open"]).dt.total_seconds() / 3600
            )
        ref = df["date open"].max() if not df["date open"].dropna().empty else pd.Timestamp.now()
        df["hours_open"] = ((ref - df["date open"]).dt.total_seconds() / 3600).clip(lower=0)
    return df


def _get_negativity_score(text):
    words = re.findall(r'\w+', str(text).lower())
    if not words:
        return 0.0
    neg_count = sum(1 for w in words if w in NEGATIVE_WORDS)
    return float(neg_count / len(words))


def _add_text_features(df, max_features=30):
    df = df.copy()
    
    subject_text = df["subject"].fillna("").astype(str) if "subject" in df.columns else pd.Series("", index=df.index)
    desc_text = df["desc"].fillna("").astype(str) if "desc" in df.columns else pd.Series("", index=df.index)
    full_text = (subject_text + " " + desc_text).str.lower()
    
    df["text_negativity_score"] = full_text.apply(_get_negativity_score)
    
    tfidf_vectorizer = None
    try:
        tfidf_vectorizer = TfidfVectorizer(
            max_features=max_features,
            stop_words="english",
            ngram_range=(1, 2),
            min_df=2,
            sublinear_tf=True
        )
        tfidf_matrix = tfidf_vectorizer.fit_transform(full_text)
        feature_names = [f"tfidf_{word}" for word in tfidf_vectorizer.get_feature_names_out()]
        tfidf_df = pd.DataFrame(tfidf_matrix.toarray(), columns=feature_names, index=df.index)
        df = pd.concat([df, tfidf_df], axis=1)
    except Exception:
        tfidf_vectorizer = None

    return df, tfidf_vectorizer


def _compute_resolution_hours(df):
    df = df.copy()
    if "date open" in df.columns and "solution target" in df.columns:
        delta = df["solution target"] - df["date open"]
        df["resolution_hours"] = delta.dt.total_seconds() / 3600
    return df


def get_negativity_score(text):
    return _get_negativity_score(text)


def prepare_ticket_data(df_raw, task):
    if task not in VALID_TASKS:
        raise ValueError(f"task must be one of {VALID_TASKS}, got '{task}'")

    df = _normalize_columns(df_raw)
    df = _parse_dates(df)
    
    df = _add_sla_duration_features(df)
    df, tfidf_vectorizer = _add_text_features(df)

    if "product" in df.columns:
        product_dummies = pd.get_dummies(df["product"], prefix="prod").astype(int)
        df = pd.concat([df, product_dummies], axis=1)

    if task == "resolution":
        df = _compute_resolution_hours(df)
        target_col = "resolution_hours"
    elif task == "priority":
        target_col = "priority"
    else:
        target_col = "case owner"

    if target_col not in df.columns:
        raise ValueError(f"Expected column '{target_col}' not found in dataset.")

    # Clean non-numeric values
    df = _clean_non_numeric_values(df)

    drop_cols = set(ID_AND_PII_COLUMNS) | set(DATE_COLUMNS) | set(TEXT_COLUMNS) | {"status", "product"}

    if task == "resolution":
        drop_cols.add("priority")
        drop_cols.add("target_solution_hours")

    drop_cols = {c for c in drop_cols if c in df.columns and c != target_col}
    df = df.drop(columns=list(drop_cols))

    return df, target_col, tfidf_vectorizer