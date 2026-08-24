"""Generic + Ericsson-aware dashboard analytics."""

import re
import numpy as np
import pandas as pd
from ericsson_prep import _normalize_columns, _parse_dates

STATUS_BUCKET_RULES = [
    (("closed", "resolved", "completed", "finished"), "Closed"),
    (("escalat",), "Escalated"),
    (("pending",), "Pending"),
]


def _bucket_status(raw_status):
    s = str(raw_status).strip().lower()
    for keywords, bucket in STATUS_BUCKET_RULES:
        if any(k in s for k in keywords):
            return bucket
    return "Open"


def _bucket_priority(raw_priority):
    p = str(raw_priority).strip().lower()
    if p in ("critical", "high"):
        return "High"
    if p == "medium":
        return "Medium"
    return "Low"


def _is_ericsson_dataset(df: pd.DataFrame) -> bool:
    cols = {str(c).strip().lower() for c in df.columns}
    signature = {
        "priority",
        "case owner",
        "solution target",
        "date open",
    }
    return len(signature & cols) >= 3


def _clean_name(value):
    return re.sub(r"\s+", " ", str(value)).strip()


def _numeric_summary(df: pd.DataFrame, numeric_cols):
    out = []
    for col in numeric_cols:
        s = pd.to_numeric(df[col], errors="coerce").replace([np.inf, -np.inf], np.nan).dropna()
        if s.empty:
            continue
        out.append({
            "name": col,
            "mean": round(float(s.mean()), 3),
            "median": round(float(s.median()), 3),
            "min": round(float(s.min()), 3),
            "max": round(float(s.max()), 3),
            "std": round(float(s.std(ddof=0)), 3),
            "missing": int(df[col].isna().sum()),
        })
    return sorted(out, key=lambda x: x["std"], reverse=True)


def _categorical_summary(df: pd.DataFrame, categorical_cols):
    out = []
    for col in categorical_cols:
        s = df[col].dropna().astype(str)
        if s.empty:
            continue
        vc = s.value_counts()
        top_name = str(vc.index[0])
        top_count = int(vc.iloc[0])
        out.append({
            "name": col,
            "unique": int(s.nunique()),
            "top": top_name,
            "topCount": top_count,
            "topPct": round(100.0 * top_count / len(s), 1),
            "missing": int(df[col].isna().sum()),
        })
    return sorted(out, key=lambda x: x["unique"], reverse=True)


def _correlations(df: pd.DataFrame, numeric_cols, limit=5):
    if len(numeric_cols) < 2:
        return []
    corr = df[numeric_cols].apply(pd.to_numeric, errors="coerce").corr(method="pearson")
    pairs = []
    for i, a in enumerate(numeric_cols):
        for b in numeric_cols[i + 1:]:
            value = corr.loc[a, b]
            if pd.notna(value) and np.isfinite(value):
                pairs.append({"x": a, "y": b, "correlation": round(float(value), 3)})
    return sorted(pairs, key=lambda p: abs(p["correlation"]), reverse=True)[:limit]


def _generic_insights(df, numeric_summary, categorical_summary, correlations):
    insights = []
    if numeric_summary:
        most_variable = numeric_summary[0]
        insights.append({
            "type": "numeric",
            "title": "Highest variability",
            "text": f"{most_variable['name']} has the highest standard deviation among numeric features ({most_variable['std']:g}).",
            "feature": most_variable["name"],
        })
        most_skewed = None
        for col in df.select_dtypes(include="number").columns:
            s = pd.to_numeric(df[col], errors="coerce").dropna()
            if len(s) >= 3:
                skew = float(s.skew()) if np.isfinite(s.skew()) else 0.0
                candidate = (abs(skew), col, skew)
                if most_skewed is None or candidate[0] > most_skewed[0]:
                    most_skewed = candidate
        if most_skewed and most_skewed[0] > 1:
            insights.append({
                "type": "distribution",
                "title": "Strongly skewed feature",
                "text": f"{most_skewed[1]} is noticeably skewed (skewness {most_skewed[2]:.2f}).",
                "feature": most_skewed[1],
            })
    if categorical_summary:
        dominant = max(categorical_summary, key=lambda x: x["topPct"])
        insights.append({
            "type": "category",
            "title": "Dominant category",
            "text": f"{dominant['top']} appears most often in {dominant['name']} ({dominant['topPct']:.1f}% of non-missing values).",
            "feature": dominant["name"],
        })
        high_card = max(categorical_summary, key=lambda x: x["unique"])
        if high_card["unique"] > 20:
            insights.append({
                "type": "cardinality",
                "title": "High-cardinality column",
                "text": f"{high_card['name']} contains {high_card['unique']:,} unique categories, which may be an ID-like or detailed categorical field.",
                "feature": high_card["name"],
            })
    if correlations:
        top = correlations[0]
        direction = "positive" if top["correlation"] >= 0 else "negative"
        insights.append({
            "type": "relationship",
            "title": "Strongest numeric relationship",
            "text": f"{top['x']} and {top['y']} have a {direction} correlation of {top['correlation']:.2f}.",
            "feature": f"{top['x']} ↔ {top['y']}",
        })
    return insights[:6]


def _generic_summary(df):
    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    categorical_cols = [c for c in df.columns if c not in numeric_cols]
    missing_cells = int(df.isna().sum().sum())
    duplicate_rows = int(df.duplicated().sum())
    numeric_summary = _numeric_summary(df, numeric_cols)
    categorical_summary = _categorical_summary(df, categorical_cols)
    correlations = _correlations(df, numeric_cols)

    return {
        "overview": {
            "rows": int(len(df)),
            "columns": int(len(df.columns)),
            "numericColumns": int(len(numeric_cols)),
            "categoricalColumns": int(len(categorical_cols)),
            "missingValues": missing_cells,
            "duplicateRows": duplicate_rows,
        },
        "numericSummary": numeric_summary[:12],
        "categoricalSummary": categorical_summary[:12],
        "correlations": correlations,
        "insights": _generic_insights(df, numeric_summary, categorical_summary, correlations),
    }


def _extract_raw_case_info(row):
    return {
        "caseId": str(row.get("case number", "N/A")),
        "subject": str(row.get("subject", "N/A")),
        "status": str(row.get("_status_bucket", row.get("status", "N/A"))),
        "priority": str(row.get("_priority_bucket", row.get("priority", "N/A"))),
        "dateOpen": row["date open"].strftime("%Y-%m-%d %H:%M") if pd.notna(row.get("date open")) else "N/A",
        "solutionTarget": row["solution target"].strftime("%Y-%m-%d %H:%M") if pd.notna(row.get("solution target")) else "N/A",
        "contactName": str(row.get("contact name", "N/A")),
        "caseOwner": str(row.get("case owner", "N/A")),
        "desc": str(row.get("desc", "N/A")),
        "product": str(row.get("product", "N/A")),
    }


def _ericsson_summary(df):
    if "date open" in df.columns:
        open_dates = pd.to_datetime(df["date open"], errors="coerce")
    else:
        open_dates = pd.Series(pd.NaT, index=df.index)
    dataset_max_date = open_dates.max() if open_dates.notna().any() else pd.Timestamp.now()

    df = df.copy()
    df["_status_bucket"] = df["status"].apply(_bucket_status) if "status" in df.columns else "Open"
    df["_priority_bucket"] = df["priority"].apply(_bucket_priority) if "priority" in df.columns else "Low"

    solution = pd.to_datetime(df["solution target"], errors="coerce") if "solution target" in df.columns else pd.Series(pd.NaT, index=df.index)
    is_closed = df["_status_bucket"] == "Closed"
    is_open = ~is_closed
    is_overdue = is_open & solution.notna() & (solution < dataset_max_date)

    resolution_hours = (solution - open_dates).dt.total_seconds() / 3600
    closed_resolution = resolution_hours[is_closed].dropna()
    avg_resolution = round(float(closed_resolution.mean()), 1) if not closed_resolution.empty else 0.0

    total = len(df)
    summary = {
        "openCases": int(is_open.sum()),
        "overdueCases": int(is_overdue.sum()),
        "avgResolutionHours": avg_resolution,
        "slaCompliancePct": round(100.0 * (1.0 - int(is_overdue.sum()) / total), 1) if total else 100.0,
        "openCasesTrend": 0,
        "overdueCasesTrend": 0,
        "avgResolutionTrend": 0.0,
        "slaComplianceTrend": 0,
    }

    priority_data = [
        {"name": name, "value": int((df["_priority_bucket"] == name).sum())}
        for name in ["High", "Medium", "Low"]
    ]
    day_order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    status_data = []
    if open_dates.notna().any():
        df["_day"] = open_dates.dt.day_name().str[:3]
        one_week_ago = dataset_max_date - pd.Timedelta(days=7)
        two_weeks_ago = dataset_max_date - pd.Timedelta(days=14)
        this_week_df = df[open_dates >= one_week_ago]
        last_week_df = df[
            (open_dates >= two_weeks_ago) &\
            (open_dates < one_week_ago)
         ]
        this_counts = (
            this_week_df["_day"].value_counts().to_dict()
            if not this_week_df.empty
            else df["_day"].value_counts().to_dict()
         )

        last_counts = (
         last_week_df["_day"].value_counts().to_dict()
         if not last_week_df.empty
          else {}
        )

        for day in day_order:
         status_data.append({
               "day": day,
              "thisWeek": int(this_counts.get(day, 0)),
              "lastWeek": int(last_counts.get(day, 0)),
        })
    else:
        for day in day_order:
           status_data.append({
               "day": day,
              "thisWeek": 0,
              "lastWeek": 0,
            })

    recent_cases = []
    if open_dates.notna().any():
        for _, row in df.loc[open_dates.sort_values(ascending=False).index].head(8).iterrows():
            info = _extract_raw_case_info(row)
            info["lastUpdated"] = info["dateOpen"]
            recent_cases.append(info)

    attention_cases = []
    if solution.notna().any():
        attention_df = df[is_open & solution.notna()].copy()
        attention_df["_days"] = (solution[attention_df.index] - dataset_max_date).dt.total_seconds() / 86400
        for _, row in attention_df.sort_values("_days").head(8).iterrows():
            days = int(round(float(row["_days"])))
            info = _extract_raw_case_info(row)
            info["issue"] = f"Overdue by {abs(days)}d" if days < 0 else ("SLA Target due today" if days == 0 else f"SLA Target in {days}d")
            attention_cases.append(info)

    return {
        "summary": summary,
        "priorityData": priority_data,
        "statusData": status_data,
        "recentCases": recent_cases,
        "attentionCases": attention_cases,
        "volumeData": [],
        "generic": _generic_summary(df.drop(columns=[c for c in ["_status_bucket", "_priority_bucket"] if c in df.columns])),
    }


def build_dashboard_summary(df_raw, recent_n=5, attention_n=5):
    df = _normalize_columns(df_raw)
    df = _parse_dates(df)
    if _is_ericsson_dataset(df):
        result = _ericsson_summary(df)
        result["datasetType"] = "ericsson"
        result["datasetLabel"] = "Ericsson Support Analytics"
        return result

    generic = _generic_summary(df)
    return {
        "datasetType": "generic",
        "datasetLabel": "Dataset Analytics",
        "summary": None,
        "priorityData": [],
        "statusData": [],
        "recentCases": [],
        "attentionCases": [],
        "volumeData": [],
        "generic": generic,
    }