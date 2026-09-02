"""Generic + Ericsson-aware dashboard analytics."""

import math
import re
import numpy as np
import pandas as pd
from scipy.stats import chi2_contingency
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
    signature = {"priority", "case owner", "solution target", "date open"}
    return len(signature & cols) >= 3


def _safe_text(value):
    if pd.isna(value):
        return "Missing"
    return str(value)


def _infer_type(series: pd.Series, name: str) -> str:
    clean = series.dropna()
    if clean.empty:
        return "empty"
    if pd.api.types.is_bool_dtype(series):
        return "boolean"
    if pd.api.types.is_numeric_dtype(series):
        return "numeric"

    name_l = str(name).lower()
    text_hints = ("description", "desc", "subject", "comment", "message", "notes", "summary", "answer", "text")
    sample = clean.astype(str).head(250)
    mean_len = float(sample.str.len().mean()) if len(sample) else 0.0

    if mean_len <= 80:
        try:
            parsed = pd.to_datetime(sample, errors="coerce", format="mixed")
            if float(parsed.notna().mean()) >= 0.90:
                return "datetime"
        except Exception:
            pass

    if any(h in name_l for h in text_hints) or mean_len >= 40:
        return "text"

    return "categorical"


def _numeric_series(df, col):
    s = pd.to_numeric(df[col], errors="coerce")
    return s.replace([np.inf, -np.inf], np.nan)


def _numeric_summary(df, numeric_cols):
    out = []
    for col in numeric_cols:
        s = _numeric_series(df, col).dropna()
        if s.empty:
            continue
        q1 = float(s.quantile(.25))
        q3 = float(s.quantile(.75))
        iqr = q3 - q1
        outlier_count = int(((s < q1 - 1.5 * iqr) | (s > q3 + 1.5 * iqr)).sum()) if iqr > 0 else 0
        skew = float(s.skew()) if len(s) >= 3 and pd.notna(s.skew()) else 0.0
        out.append({
            "name": str(col),
            "count": int(s.size),
            "mean": round(float(s.mean()), 4),
            "median": round(float(s.median()), 4),
            "min": round(float(s.min()), 4),
            "q1": round(q1, 4),
            "q3": round(q3, 4),
            "max": round(float(s.max()), 4),
            "std": round(float(s.std(ddof=0)), 4),
            "skewness": round(skew, 4),
            "outliers": outlier_count,
            "missing": int(df[col].isna().sum()),
        })
    return out


def _categorical_summary(df, categorical_cols):
    out = []
    for col in categorical_cols:
        s = df[col].dropna().astype(str)
        if s.empty:
            continue
        vc = s.value_counts()
        top_name = str(vc.index[0])
        top_count = int(vc.iloc[0])
        probs = vc / vc.sum()
        entropy = float(-(probs * np.log2(probs)).sum()) if len(probs) else 0.0
        top_values = [
            {"value": str(v), "count": int(c), "pct": round(100.0 * c / len(s), 2)}
            for v, c in vc.head(12).items()
        ]
        out.append({
            "name": str(col),
            "unique": int(s.nunique()),
            "top": top_name,
            "topCount": top_count,
            "topPct": round(100.0 * top_count / len(s), 2),
            "missing": int(df[col].isna().sum()),
            "entropy": round(entropy, 4),
            "topValues": top_values,
        })
    return sorted(out, key=lambda x: (x["topPct"], x["unique"]), reverse=True)


def _text_summary(df, text_cols):
    out = []
    for col in text_cols:
        s = df[col].dropna().astype(str)
        if s.empty:
            continue
        lengths = s.str.len()
        out.append({
            "name": str(col),
            "count": int(len(s)),
            "missing": int(df[col].isna().sum()),
            "unique": int(s.nunique()),
            "avgLength": round(float(lengths.mean()), 2),
            "medianLength": round(float(lengths.median()), 2),
            "maxLength": int(lengths.max()),
        })
    return out


def _datetime_summary(df, datetime_cols):
    out = []
    for col in datetime_cols:
        s = pd.to_datetime(df[col], errors="coerce", format="mixed").dropna()
        if s.empty:
            continue
        start, end = s.min(), s.max()
        span_days = float((end - start).total_seconds() / 86400.0)
        monthly = s.dt.to_period("M").value_counts().sort_index()
        monthly = [{"period": str(p), "count": int(c)} for p, c in monthly.items()]
        out.append({
            "name": str(col),
            "min": start.isoformat(),
            "max": end.isoformat(),
            "spanDays": round(span_days, 2),
            "missing": int(df[col].isna().sum()),
            "unique": int(s.nunique()),
            "monthlyCounts": monthly[-24:],
        })
    return out


def _distributions(df, numeric_cols):
    out = []
    for col in numeric_cols[:20]:
        s = _numeric_series(df, col).dropna()
        if s.empty:
            continue
        bins = min(12, max(5, int(np.sqrt(len(s)))))
        try:
            counts, edges = np.histogram(s.to_numpy(), bins=bins)
        except Exception:
            continue
        hist = []
        for i, count in enumerate(counts):
            hist.append({
                "bin": f"{edges[i]:.3g}–{edges[i+1]:.3g}",
                "count": int(count),
            })
        out.append({"name": str(col), "histogram": hist})
    return out


def _correlations(df, numeric_cols, limit=12):
    if len(numeric_cols) < 2:
        return []
    work = df[numeric_cols].apply(pd.to_numeric, errors="coerce")
    pearson = work.corr(method="pearson")
    spearman = work.corr(method="spearman")
    pairs = []
    for i, a in enumerate(numeric_cols):
        for b in numeric_cols[i + 1:]:
            p = pearson.loc[a, b]
            s = spearman.loc[a, b]
            if pd.notna(p):
                pairs.append({
                    "x": str(a),
                    "y": str(b),
                    "correlation": round(float(p), 4),
                    "spearman": round(float(s), 4) if pd.notna(s) else None,
                    "abs": round(abs(float(p)), 4),
                })
    return sorted(pairs, key=lambda x: x["abs"], reverse=True)[:limit]


def _categorical_associations(df, categorical_cols, limit=10):
    if len(categorical_cols) < 2:
        return []
    pairs = []
    cols = categorical_cols[:20]
    for i, a in enumerate(cols):
        for b in cols[i + 1:]:
            work = df[[a, b]].dropna().astype(str)
            if len(work) < 5 or work[a].nunique() < 2 or work[b].nunique() < 2:
                continue
            table = pd.crosstab(work[a], work[b])
            try:
                chi2 = chi2_contingency(table, correction=False)[0]
                n = table.to_numpy().sum()
                phi2 = chi2 / max(n, 1)
                r, k = table.shape
                v = math.sqrt(phi2 / max(min(k - 1, r - 1), 1))
            except Exception:
                continue
            pairs.append({"x": str(a), "y": str(b), "cramersV": round(float(v), 4), "abs": round(abs(float(v)), 4)})
    return sorted(pairs, key=lambda x: x["abs"], reverse=True)[:limit]


def _missing_summary(df):
    total_cells = max(df.shape[0] * df.shape[1], 1)
    missing = int(df.isna().sum().sum())
    by_col = []
    for col, count in df.isna().sum().items():
        count = int(count)
        if count > 0:
            by_col.append({"name": str(col), "count": count, "pct": round(100.0 * count / max(len(df), 1), 2)})
    return {
        "totalCells": int(total_cells),
        "missingCells": missing,
        "missingPct": round(100.0 * missing / total_cells, 2),
        "completePct": round(100.0 * (1 - missing / total_cells), 2),
        "byColumn": sorted(by_col, key=lambda x: x["pct"], reverse=True),
    }


def _identifier_columns(df, column_types):
    ids = []
    for col in df.columns:
        kind = column_types[str(col)]
        unique = int(df[col].nunique(dropna=True))
        name = str(col).lower()
        if unique == len(df) and len(df) > 0:
            ids.append({"name": str(col), "reason": "unique value per row"})
        elif any(token in name for token in ("id", "uuid", "key", "case number", "record number")) and unique >= max(5, int(len(df) * 0.5)):
            ids.append({"name": str(col), "reason": "identifier-like name/high cardinality"})
    return ids[:20]


def _generic_insights(df, numeric_summary, categorical_summary, correlations, datetime_summary, missing):
    insights = []
    if missing["missingCells"] > 0:
        worst = missing["byColumn"][0] if missing["byColumn"] else None
        if worst:
            insights.append({"type": "quality", "title": "Missing data", "text": f"{worst['name']} has the highest missing rate at {worst['pct']:.1f}% ({worst['count']:,} values).", "feature": worst["name"]})
    if missing["completePct"] >= 99.9:
        insights.append({"type": "quality", "title": "Very complete dataset", "text": f"{missing['completePct']:.1f}% of all cells are populated.", "feature": None})
    if numeric_summary:
        most_variable = max(numeric_summary, key=lambda x: x["std"])
        insights.append({"type": "numeric", "title": "Highest variability", "text": f"{most_variable['name']} has the largest standard deviation ({most_variable['std']:g}).", "feature": most_variable["name"]})
        skewed = max(numeric_summary, key=lambda x: abs(x["skewness"]))
        if abs(skewed["skewness"]) >= 1:
            insights.append({"type": "distribution", "title": "Skewed distribution", "text": f"{skewed['name']} is notably skewed (skewness {skewed['skewness']:.2f}).", "feature": skewed["name"]})
        outlier_feature = max(numeric_summary, key=lambda x: x["outliers"])
        if outlier_feature["outliers"] > 0:
            insights.append({"type": "outlier", "title": "Potential outliers", "text": f"{outlier_feature['name']} has {outlier_feature['outliers']:,} IQR-based outlier(s).", "feature": outlier_feature["name"]})
    if categorical_summary:
        dominant = max(categorical_summary, key=lambda x: x["topPct"])
        insights.append({"type": "category", "title": "Dominant category", "text": f"{dominant['top']} is the most common value in {dominant['name']} ({dominant['topPct']:.1f}% of non-missing values).", "feature": dominant["name"]})
        high_card = max(categorical_summary, key=lambda x: x["unique"])
        if high_card["unique"] > 20:
            insights.append({"type": "cardinality", "title": "High cardinality", "text": f"{high_card['name']} has {high_card['unique']:,} unique values and may behave like an identifier or detailed category.", "feature": high_card["name"]})
    if correlations:
        top = correlations[0]
        direction = "positive" if top["correlation"] >= 0 else "negative"
        insights.append({"type": "relationship", "title": "Strongest numeric relationship", "text": f"{top['x']} and {top['y']} have a {direction} Pearson correlation of {top['correlation']:.2f}.", "feature": f"{top['x']} ↔ {top['y']}"})
    if datetime_summary:
        widest = max(datetime_summary, key=lambda x: x["spanDays"])
        insights.append({"type": "time", "title": "Time coverage", "text": f"{widest['name']} spans {widest['spanDays']:.0f} days from {widest['min'][:10]} to {widest['max'][:10]}.", "feature": widest["name"]})
    if len(df) > 0 and len(df.columns) > 0:
        constant = [str(c) for c in df.columns if df[c].nunique(dropna=False) <= 1]
        if constant:
            insights.append({"type": "quality", "title": "Constant columns", "text": f"{len(constant)} column(s) contain only one observed value and provide little analytical variation.", "feature": constant[0]})
    return insights[:10]


def _generic_summary(df):
    column_types = {str(c): _infer_type(df[c], str(c)) for c in df.columns}
    numeric_cols = [c for c in df.columns if column_types[str(c)] == "numeric"]
    categorical_cols = [c for c in df.columns if column_types[str(c)] in {"categorical", "boolean"}]
    datetime_cols = [c for c in df.columns if column_types[str(c)] == "datetime"]
    text_cols = [c for c in df.columns if column_types[str(c)] == "text"]
    missing = _missing_summary(df)
    numeric_summary = _numeric_summary(df, numeric_cols)
    categorical_summary = _categorical_summary(df, categorical_cols)
    datetime_summary = _datetime_summary(df, datetime_cols)
    text_summary = _text_summary(df, text_cols)
    correlations = _correlations(df, numeric_cols)
    cat_associations = _categorical_associations(df, categorical_cols)
    distributions = _distributions(df, numeric_cols)
    ids = _identifier_columns(df, column_types)

    overview = {
        "rows": int(len(df)),
        "columns": int(len(df.columns)),
        "numericColumns": int(len(numeric_cols)),
        "categoricalColumns": int(len(categorical_cols)),
        "datetimeColumns": int(len(datetime_cols)),
        "textColumns": int(len(text_cols)),
        "booleanColumns": int(sum(column_types[str(c)] == "boolean" for c in df.columns)),
        "missingValues": int(missing["missingCells"]),
        "missingPct": float(missing["missingPct"]),
        "duplicateRows": int(df.duplicated().sum()),
        "duplicatePct": round(100.0 * int(df.duplicated().sum()) / max(len(df), 1), 2),
        "completePct": float(missing["completePct"]),
        "constantColumns": int(sum(df[c].nunique(dropna=False) <= 1 for c in df.columns)),
        "identifierLikeColumns": int(len(ids)),
    }

    return {
        "overview": overview,
        "columnTypes": column_types,
        "columnProfiles": [
            {
                "name": str(c),
                "type": column_types[str(c)],
                "missing": int(df[c].isna().sum()),
                "missingPct": round(100.0 * float(df[c].isna().mean()), 2),
                "unique": int(df[c].nunique(dropna=True)),
                "uniquePct": round(100.0 * float(df[c].nunique(dropna=True)) / max(len(df), 1), 2),
                "sampleValues": [_safe_text(v) for v in df[c].dropna().head(4).tolist()],
            }
            for c in df.columns
        ],
        "missingSummary": missing,
        "numericSummary": numeric_summary[:20],
        "categoricalSummary": categorical_summary[:20],
        "datetimeSummary": datetime_summary[:12],
        "textSummary": text_summary[:12],
        "distributions": distributions,
        "correlations": correlations,
        "categoricalAssociations": cat_associations,
        "identifierColumns": ids,
        "insights": _generic_insights(df, numeric_summary, categorical_summary, correlations, datetime_summary, missing),
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
    status_data = [
        {"name": name, "value": int((df["_status_bucket"] == name).sum())}
        for name in sorted(df["_status_bucket"].dropna().unique().tolist())
    ]

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
