
"""
ai_analyst.py — General-purpose AI data analyst.

Architecture:
- Python/Pandas are the source of truth for dataset facts.
- Gemini interprets the user's question, selects tools, and explains results.
- The toolset is dataset-agnostic: profiling, querying, statistics, text search,
  time trends, date differences, correlations, and outlier analysis.
- Conversation state is kept per application session in process memory.
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from google import genai
from google.genai import types


MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")

# One Gemini chat per application session. Session IDs are already unique per
# uploaded dataset, so conversation memory is naturally dataset-scoped.
_CHAT_SESSIONS: Dict[str, Dict[str, Any]] = {}

TEXT_NAME_HINTS = (
    "description", "desc", "subject", "comment", "message", "notes",
    "summary", "answer", "text", "details", "address", "remarks",
)

ALLOWED_AGGREGATIONS = {
    "count", "nunique", "sum", "mean", "median", "min", "max", "std",
}

ALLOWED_FILTER_OPERATORS = {
    "equals", "not_equals", "contains", "starts_with", "ends_with",
    "greater_than", "greater_or_equal", "less_than", "less_or_equal",
    "in", "not_in", "is_null", "not_null",
}

ALLOWED_TIME_FREQUENCIES = {"day", "week", "month", "quarter", "year"}


# ---------------------------------------------------------------------------
# Schema/type inference
# ---------------------------------------------------------------------------

def _safe_text(value: Any) -> str:
    if pd.isna(value):
        return "Missing"
    return str(value)


def _looks_numeric(series: pd.Series) -> bool:
    non_null = series.dropna()
    if non_null.empty or pd.api.types.is_bool_dtype(non_null):
        return False
    if pd.api.types.is_numeric_dtype(non_null):
        return True

    coerced = pd.to_numeric(
        non_null.astype(str).str.replace(",", "", regex=False),
        errors="coerce",
    )
    if coerced.empty:
        return False
    valid_ratio = float(coerced.notna().mean())
    if valid_ratio < 0.85:
        return False

    finite = coerced.dropna()
    finite_ratio = float(np.isfinite(finite).mean()) if len(finite) else 0.0
    return finite_ratio >= 0.85


def _looks_datetime(series: pd.Series) -> bool:
    non_null = series.dropna()
    if non_null.empty:
        return False
    if pd.api.types.is_datetime64_any_dtype(non_null):
        return True
    if pd.api.types.is_numeric_dtype(non_null):
        return False

    sample = non_null.astype(str).head(150)
    mean_len = float(sample.str.len().mean()) if len(sample) else 0.0
    if mean_len > 80:
        return False

    parsed = pd.to_datetime(sample, errors="coerce", format="mixed")
    return float(parsed.notna().mean()) >= 0.90


def _looks_text(series: pd.Series, column_name: str) -> bool:
    non_null = series.dropna()
    if non_null.empty or _looks_numeric(series) or _looks_datetime(series):
        return False

    name = str(column_name).strip().lower()
    if any(hint in name for hint in TEXT_NAME_HINTS):
        return True

    sample = non_null.astype(str).head(300)
    avg_length = float(sample.str.len().mean()) if len(sample) else 0.0
    unique_ratio = float(
        non_null.nunique(dropna=True) / max(len(non_null), 1)
    )
    return avg_length >= 50 or (avg_length >= 24 and unique_ratio >= 0.35)


def infer_column_type(df: pd.DataFrame, column: str) -> str:
    if column not in df.columns:
        return "unknown"

    series = df[column]
    if series.dropna().empty:
        return "empty"
    if pd.api.types.is_bool_dtype(series):
        return "boolean"
    if _looks_numeric(series):
        return "numeric"
    if _looks_datetime(series):
        return "datetime"
    if _looks_text(series, column):
        return "text"
    return "categorical"


def _numeric_series(df: pd.DataFrame, column: str) -> Optional[pd.Series]:
    if column not in df.columns or infer_column_type(df, column) != "numeric":
        return None

    raw = df[column]
    result = pd.to_numeric(
        raw.astype(str).str.replace(",", "", regex=False)
        if not pd.api.types.is_numeric_dtype(raw)
        else raw,
        errors="coerce",
    )
    return result.replace([np.inf, -np.inf], np.nan)


def _datetime_series(df: pd.DataFrame, column: str) -> Optional[pd.Series]:
    if column not in df.columns or infer_column_type(df, column) != "datetime":
        return None
    return pd.to_datetime(df[column], errors="coerce", format="mixed")


def get_dataset_profile(df: pd.DataFrame) -> Dict[str, Any]:
    column_types: Dict[str, str] = {}
    numeric: List[str] = []
    categorical: List[str] = []
    datetime_cols: List[str] = []
    text: List[str] = []
    boolean: List[str] = []
    empty: List[str] = []
    likely_ids: List[str] = []

    for col in df.columns:
        name = str(col)
        kind = infer_column_type(df, col)
        column_types[name] = kind

        if kind == "numeric":
            numeric.append(name)
        elif kind == "categorical":
            categorical.append(name)
        elif kind == "datetime":
            datetime_cols.append(name)
        elif kind == "text":
            text.append(name)
        elif kind == "boolean":
            boolean.append(name)
        elif kind == "empty":
            empty.append(name)

        unique = int(df[col].nunique(dropna=True))
        n = max(len(df), 1)
        if (
            unique == n
            and not pd.api.types.is_numeric_dtype(df[col])
        ) or any(
            token in name.lower()
            for token in ("id", "case number", "case_no", "number", "key", "uuid")
        ):
            likely_ids.append(name)

    missing = {
        str(col): int(count)
        for col, count in df.isna().sum().items()
        if int(count) > 0
    }

    candidate_measures = [
        col for col in numeric
        if col not in set(likely_ids)
    ]

    name_text = " ".join(str(col).lower() for col in df.columns)
    candidate_target_columns = []
    for col in df.columns:
        name = str(col).lower()
        if any(token in name for token in (
            "target", "outcome", "label", "class", "price", "cost",
            "sales", "revenue", "profit", "score", "rating", "amount",
            "diagnosis", "status", "churn", "default", "severity",
        )):
            candidate_target_columns.append(str(col))

    # Date columns are often the natural basis for "what changed over time?"
    candidate_time_columns = list(datetime_cols)

    return {
        "rows": int(len(df)),
        "columns": int(len(df.columns)),
        "column_types": column_types,
        "numeric_columns": numeric,
        "categorical_columns": categorical,
        "datetime_columns": datetime_cols,
        "text_columns": text,
        "boolean_columns": boolean,
        "empty_columns": empty,
        "likely_identifier_columns": sorted(set(likely_ids)),
        "candidate_measure_columns": candidate_measures,
        "candidate_target_columns": list(dict.fromkeys(candidate_target_columns)),
        "candidate_time_columns": candidate_time_columns,
        "missing_values": missing,
        "duplicate_rows": int(df.duplicated().sum()),
    }


def get_column_profile(df: pd.DataFrame, column: str) -> Dict[str, Any]:
    if column not in df.columns:
        return {"error": f"Unknown column: {column}"}

    series = df[column]
    kind = infer_column_type(df, column)

    result: Dict[str, Any] = {
        "column": column,
        "type": kind,
        "count": int(series.notna().sum()),
        "missing": int(series.isna().sum()),
        "unique_values": int(series.nunique(dropna=True)),
    }

    if kind == "numeric":
        clean = _numeric_series(df, column)
        clean = clean.dropna() if clean is not None else pd.Series(dtype=float)
        if clean.empty:
            return {**result, "error": "No valid numeric values."}

        result.update({
            "mean": round(float(clean.mean()), 4),
            "median": round(float(clean.median()), 4),
            "min": round(float(clean.min()), 4),
            "max": round(float(clean.max()), 4),
            "std": round(float(clean.std()), 4) if len(clean) > 1 else 0.0,
            "skewness": round(float(clean.skew()), 4) if len(clean) > 2 else 0.0,
        })

    elif kind == "datetime":
        parsed = _datetime_series(df, column)
        parsed = parsed.dropna() if parsed is not None else pd.Series(dtype="datetime64[ns]")
        if not parsed.empty:
            result.update({
                "min": parsed.min().isoformat(),
                "max": parsed.max().isoformat(),
            })

    elif kind == "text":
        sample = series.dropna().astype(str)
        if not sample.empty:
            lengths = sample.str.len()
            result.update({
                "average_text_length": round(float(lengths.mean()), 2),
                "max_text_length": int(lengths.max()),
            })

    elif kind in {"categorical", "boolean"}:
        counts = series.value_counts(dropna=False).head(15)
        total = max(len(df), 1)
        result["top_categories"] = [
            {
                "value": _safe_text(value),
                "count": int(count),
                "percentage": round(float(count / total * 100), 2),
            }
            for value, count in counts.items()
        ]

    return result


# ---------------------------------------------------------------------------
# Generic query engine
# ---------------------------------------------------------------------------

def _coerce_comparable(series: pd.Series, value: Any) -> Any:
    kind = None
    if pd.api.types.is_datetime64_any_dtype(series):
        return pd.to_datetime(value, errors="coerce")

    if pd.api.types.is_numeric_dtype(series):
        try:
            return float(value)
        except Exception:
            return value

    return value


def _apply_filters(
    df: pd.DataFrame,
    filters: Optional[List[Dict[str, Any]]],
) -> pd.DataFrame:
    if not filters:
        return df

    result = df.copy()

    for filt in filters:
        column = str(filt.get("column", ""))
        operator = str(filt.get("operator", "")).lower()
        value = filt.get("value")

        if column not in result.columns:
            raise ValueError(f"Unknown filter column: {column}")
        if operator not in ALLOWED_FILTER_OPERATORS:
            raise ValueError(f"Unsupported filter operator: {operator}")

        series = result[column]
        kind = infer_column_type(result, column)
        comparison_series = series
        if kind == "datetime":
            comparison_series = pd.to_datetime(series, errors="coerce", format="mixed")
        elif kind == "numeric":
            numeric = _numeric_series(result, column)
            if numeric is not None:
                comparison_series = numeric

        if operator == "is_null":
            mask = series.isna()
        elif operator == "not_null":
            mask = series.notna()
        elif operator == "contains":
            mask = series.astype(str).str.contains(
                str(value), case=False, na=False, regex=False
            )
        elif operator == "starts_with":
            mask = series.astype(str).str.startswith(
                str(value), na=False
            )
        elif operator == "ends_with":
            mask = series.astype(str).str.endswith(
                str(value), na=False
            )
        elif operator == "in":
            values = value if isinstance(value, list) else [v.strip() for v in str(value).split(",")]
            if kind == "datetime":
                values = [pd.to_datetime(v, errors="coerce") for v in values]
            elif kind == "numeric":
                values = [pd.to_numeric(v, errors="coerce") for v in values]
            mask = comparison_series.isin(values)
        elif operator == "not_in":
            values = value if isinstance(value, list) else [v.strip() for v in str(value).split(",")]
            if kind == "datetime":
                values = [pd.to_datetime(v, errors="coerce") for v in values]
            elif kind == "numeric":
                values = [pd.to_numeric(v, errors="coerce") for v in values]
            mask = ~comparison_series.isin(values)
        else:
            comparable = _coerce_comparable(series, value)
            if operator == "equals":
                mask = comparison_series == comparable
            elif operator == "not_equals":
                mask = comparison_series != comparable
            elif operator == "greater_than":
                mask = comparison_series > comparable
            elif operator == "greater_or_equal":
                mask = comparison_series >= comparable
            elif operator == "less_than":
                mask = comparison_series < comparable
            elif operator == "less_or_equal":
                mask = comparison_series <= comparable
            else:
                raise ValueError(f"Unsupported filter operator: {operator}")

        result = result.loc[mask]

    return result


def _safe_aggregation(
    grouped,
    source_column: str,
    agg: str,
    alias: str,
):
    if agg == "count":
        if source_column == "*":
            return grouped.size().rename(alias)
        return grouped[source_column].count().rename(alias)

    if agg == "nunique":
        return grouped[source_column].nunique().rename(alias)

    series = grouped[source_column]
    if agg == "sum":
        return series.sum().rename(alias)
    if agg == "mean":
        return series.mean().rename(alias)
    if agg == "median":
        return series.median().rename(alias)
    if agg == "min":
        return series.min().rename(alias)
    if agg == "max":
        return series.max().rename(alias)
    if agg == "std":
        return series.std().rename(alias)

    raise ValueError(f"Unsupported aggregation: {agg}")


def query_dataset(
    df: pd.DataFrame,
    group_by: Optional[List[str]] = None,
    aggregations: Optional[List[Dict[str, Any]]] = None,
    filters: Optional[List[Dict[str, Any]]] = None,
    sort_by: Optional[str] = None,
    sort_direction: str = "desc",
    limit: int = 20,
) -> Dict[str, Any]:
    """General safe tabular query: filter, group, aggregate, sort, limit."""
    group_by = group_by or []
    aggregations = aggregations or []

    if len(group_by) > 4:
        raise ValueError("A maximum of 4 group-by columns is supported.")
    limit = max(1, min(int(limit or 20), 100))

    for column in group_by:
        if column not in df.columns:
            raise ValueError(f"Unknown group-by column: {column}")

    clean = _apply_filters(df, filters).copy()

    for spec in aggregations:
        column = str(spec.get("column", "*"))
        if column != "*" and infer_column_type(clean, column) == "numeric":
            numeric = _numeric_series(clean, column)
            if numeric is not None:
                clean[column] = numeric

    if not group_by and not aggregations:
        sample = clean.head(limit)
        return {
            "rows_after_filters": int(len(clean)),
            "result": sample.to_dict(orient="records"),
        }

    if not aggregations:
        aggregations = [
            {
                "column": "*",
                "function": "count",
                "alias": "count",
            }
        ]

    prepared = []
    for spec in aggregations:
        column = str(spec.get("column", "*"))
        agg = str(spec.get("function", "")).lower()
        alias = str(spec.get("alias") or (
            f"{agg}_{column}" if column != "*" else "count"
        ))

        if agg not in ALLOWED_AGGREGATIONS:
            raise ValueError(f"Unsupported aggregation: {agg}")
        if column != "*" and column not in clean.columns:
            raise ValueError(f"Unknown aggregation column: {column}")

        prepared.append((column, agg, alias))

    if group_by:
        grouped = clean.groupby(
            group_by,
            dropna=False,
            sort=False,
        )
        result_parts = [
            grouped.size().rename("__group_size")
        ]

        for column, agg, alias in prepared:
            result_parts.append(
                _safe_aggregation(grouped, column, agg, alias)
            )

        result_df = pd.concat(result_parts, axis=1).reset_index()
        result_df = result_df.drop(columns=["__group_size"], errors="ignore")

    else:
        data: Dict[str, Any] = {}
        for column, agg, alias in prepared:
            if agg == "count":
                value = int(clean.shape[0]) if column == "*" else int(clean[column].count())
            elif agg == "nunique":
                value = int(clean[column].nunique())
            else:
                series = clean[column]
                value = getattr(series, agg)()
                value = float(value) if pd.notna(value) else None
            data[alias] = value
        result_df = pd.DataFrame([data])

    if sort_by:
        if sort_by not in result_df.columns:
            raise ValueError(
                f"sort_by '{sort_by}' is not a result column. "
                f"Available: {result_df.columns.tolist()}"
            )
        result_df = result_df.sort_values(
            sort_by,
            ascending=(str(sort_direction).lower() == "asc"),
            na_position="last",
        )

    result_df = result_df.head(limit)

    return {
        "rows_after_filters": int(len(clean)),
        "group_by": group_by,
        "aggregations": prepared,
        "result": result_df.to_dict(orient="records"),
    }


# ---------------------------------------------------------------------------
# Statistical / analytical tools
# ---------------------------------------------------------------------------

def calculate_relationship(
    df: pd.DataFrame,
    column_a: str,
    column_b: str,
) -> Dict[str, Any]:
    a = _numeric_series(df, column_a)
    b = _numeric_series(df, column_b)

    if a is None:
        return {"error": f"{column_a} is not a numeric column."}
    if b is None:
        return {"error": f"{column_b} is not a numeric column."}

    clean = pd.DataFrame({"a": a, "b": b}).dropna()
    if len(clean) < 2:
        return {"error": "At least two complete observations are required."}

    corr = clean["a"].corr(clean["b"])
    if pd.isna(corr):
        return {"error": "Correlation could not be calculated."}

    strength = abs(float(corr))
    if strength >= 0.8:
        label = "very strong"
    elif strength >= 0.6:
        label = "strong"
    elif strength >= 0.4:
        label = "moderate"
    elif strength >= 0.2:
        label = "weak"
    else:
        label = "very weak"

    direction = (
        "positive" if corr > 0
        else "negative" if corr < 0
        else "near-zero"
    )

    return {
        "column_a": column_a,
        "column_b": column_b,
        "pearson_correlation": round(float(corr), 4),
        "relationship": f"{label} {direction}",
        "observations_used": int(len(clean)),
        "note": "Correlation describes linear association; it does not prove causation.",
    }


def find_top_correlations(
    df: pd.DataFrame,
    columns: Optional[List[str]] = None,
    top_n: int = 10,
) -> Dict[str, Any]:
    candidates = []
    for col in (columns or df.columns.tolist()):
        if col in df.columns and infer_column_type(df, col) == "numeric":
            candidates.append(col)

    if len(candidates) < 2:
        return {"error": "At least two numeric columns are required."}

    top_n = max(1, min(int(top_n or 10), 30))
    numeric_frame = pd.DataFrame({
        col: _numeric_series(df, col) for col in candidates
    })
    corr = numeric_frame.corr()
    pairs = []

    for i, col_a in enumerate(candidates):
        for col_b in candidates[i + 1:]:
            value = corr.loc[col_a, col_b]
            if pd.isna(value):
                continue
            pairs.append({
                "column_a": col_a,
                "column_b": col_b,
                "correlation": round(float(value), 4),
                "absolute_correlation": round(abs(float(value)), 4),
            })

    pairs.sort(key=lambda item: item["absolute_correlation"], reverse=True)

    return {"pairs": pairs[:top_n]}


def detect_outliers(
    df: pd.DataFrame,
    column: str,
) -> Dict[str, Any]:
    series = _numeric_series(df, column)
    if series is None:
        return {"error": f"{column} is not a numeric column."}

    series = series.dropna()
    if series.empty:
        return {"error": "No valid numeric values were found."}

    q1 = float(series.quantile(0.25))
    q3 = float(series.quantile(0.75))
    iqr = q3 - q1

    if iqr == 0:
        return {
            "column": column,
            "outliers": 0,
            "outlier_percentage": 0.0,
            "method": "IQR",
        }

    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr
    mask = (series < lower) | (series > upper)

    return {
        "column": column,
        "outliers": int(mask.sum()),
        "outlier_percentage": round(float(mask.mean() * 100), 2),
        "lower_bound": round(lower, 4),
        "upper_bound": round(upper, 4),
        "method": "IQR",
    }


def analyze_time_trend(
    df: pd.DataFrame,
    date_column: str,
    value_column: Optional[str] = None,
    aggregation: str = "mean",
    frequency: str = "month",
    limit: int = 24,
) -> Dict[str, Any]:
    if date_column not in df.columns:
        return {"error": f"Unknown date column: {date_column}"}
    if infer_column_type(df, date_column) != "datetime":
        return {"error": f"{date_column} is not a datetime column."}

    frequency = frequency.lower()
    aggregation = aggregation.lower()

    if frequency not in ALLOWED_TIME_FREQUENCIES:
        return {"error": f"Unsupported frequency: {frequency}"}
    if aggregation not in {"count", "sum", "mean", "median", "min", "max"}:
        return {"error": f"Unsupported aggregation: {aggregation}"}

    dates = _datetime_series(df, date_column)
    work = df.copy()
    work["_ai_date"] = dates

    if value_column:
        if value_column not in work.columns:
            return {"error": f"Unknown value column: {value_column}"}
        if aggregation != "count" and _numeric_series(work, value_column) is None:
            return {
                "error": (
                    f"{value_column} must be numeric for {aggregation}. "
                    "Use count for categorical/text columns."
                )
            }
        if _numeric_series(work, value_column) is not None:
            work["_ai_value"] = _numeric_series(work, value_column)
        else:
            work["_ai_value"] = work[value_column]
    else:
        if aggregation != "count":
            return {"error": "value_column is required for this aggregation."}

    work = work.dropna(subset=["_ai_date"])
    if work.empty:
        return {"error": "No valid dates were found."}

    freq_map = {
        "day": "D",
        "week": "W",
        "month": "M",
        "quarter": "Q",
        "year": "Y",
    }
    period = work["_ai_date"].dt.to_period(freq_map[frequency])

    if aggregation == "count":
        series = work.groupby(period).size()
    else:
        series = getattr(work.groupby(period)["_ai_value"], aggregation)()

    result = [
        {
            "period": str(index),
            "value": (
                int(value) if aggregation == "count"
                else round(float(value), 4) if pd.notna(value)
                else None
            ),
        }
        for index, value in series.tail(max(1, min(limit, 100))).items()
    ]

    return {
        "date_column": date_column,
        "value_column": value_column,
        "frequency": frequency,
        "aggregation": aggregation,
        "result": result,
    }


def calculate_date_difference(
    df: pd.DataFrame,
    start_column: str,
    end_column: str,
    aggregation: str = "mean",
    group_by: Optional[List[str]] = None,
    unit: str = "hours",
    limit: int = 20,
) -> Dict[str, Any]:
    if start_column not in df.columns or end_column not in df.columns:
        return {"error": "Both date columns must exist."}

    start = pd.to_datetime(
        df[start_column],
        errors="coerce",
        format="mixed",
    )
    end = pd.to_datetime(
        df[end_column],
        errors="coerce",
        format="mixed",
    )

    delta_hours = (end - start).dt.total_seconds() / 3600
    if unit == "days":
        values = delta_hours / 24
    elif unit == "minutes":
        values = delta_hours * 60
    else:
        values = delta_hours

    work = df.copy()
    work["_ai_delta"] = values

    filters = work["_ai_delta"].notna()
    work = work.loc[filters]

    if work.empty:
        return {"error": "No valid date pairs were found."}

    if aggregation not in {"count", "mean", "median", "min", "max", "std"}:
        return {"error": f"Unsupported aggregation: {aggregation}"}

    if group_by:
        for col in group_by:
            if col not in work.columns:
                return {"error": f"Unknown group-by column: {col}"}
        grouped = work.groupby(group_by, dropna=False)["_ai_delta"]
        if aggregation == "count":
            result = grouped.count().rename("count")
        else:
            result = getattr(grouped, aggregation)().rename(aggregation)
        result_df = result.reset_index().sort_values(
            aggregation if aggregation != "count" else "count",
            ascending=False,
        ).head(max(1, min(limit, 100)))

        return {
            "start_column": start_column,
            "end_column": end_column,
            "unit": unit,
            "aggregation": aggregation,
            "group_by": group_by,
            "result": result_df.to_dict(orient="records"),
        }

    value = (
        int(work["_ai_delta"].count())
        if aggregation == "count"
        else getattr(work["_ai_delta"], aggregation)()
    )
    return {
        "start_column": start_column,
        "end_column": end_column,
        "unit": unit,
        "aggregation": aggregation,
        "result": round(float(value), 4) if aggregation != "count" else int(value),
        "observations_used": int(len(work)),
    }


def search_text(
    df: pd.DataFrame,
    query: str,
    columns: Optional[List[str]] = None,
    limit: int = 10,
) -> Dict[str, Any]:
    if not query or not str(query).strip():
        return {"error": "A non-empty query is required."}

    selected = columns or [
        str(c)
        for c in df.columns
        if infer_column_type(df, c) == "text"
    ]

    selected = [c for c in selected if c in df.columns]
    if not selected:
        return {"error": "No searchable text columns were found."}

    mask = pd.Series(False, index=df.index)
    for column in selected:
        mask = mask | df[column].astype(str).str.contains(
            str(query),
            case=False,
            na=False,
            regex=False,
        )

    matches = df.loc[mask].head(max(1, min(limit, 25)))

    return {
        "query": query,
        "columns_searched": selected,
        "match_count": int(mask.sum()),
        "sample_matches": matches.to_dict(orient="records"),
    }


def get_missingness_summary(df: pd.DataFrame) -> Dict[str, Any]:
    total_cells = max(int(df.shape[0] * df.shape[1]), 1)
    rows = []

    for col in df.columns:
        count = int(df[col].isna().sum())
        rows.append({
            "column": str(col),
            "missing_count": count,
            "missing_percentage": round(float(count / max(len(df), 1) * 100), 2),
        })

    rows.sort(key=lambda item: item["missing_count"], reverse=True)

    return {
        "total_missing_cells": int(df.isna().sum().sum()),
        "overall_missing_percentage": round(
            float(df.isna().sum().sum() / total_cells * 100),
            2,
        ),
        "by_column": rows,
    }


# ---------------------------------------------------------------------------
# Gemini tool declarations
# ---------------------------------------------------------------------------

def _schema_object(properties=None, required=None):
    return types.Schema(
        type="OBJECT",
        properties=properties or {},
        required=required or [],
    )


def build_tool_declarations():
    return types.Tool(function_declarations=[
        types.FunctionDeclaration(
            name="get_dataset_profile",
            description=(
                "Profile the current dataset: row/column counts, inferred "
                "column types, likely identifier columns, missing values, and duplicates."
            ),
            parameters=_schema_object(),
        ),
        types.FunctionDeclaration(
            name="get_column_profile",
            description=(
                "Describe one column using type-appropriate statistics, "
                "category frequencies, date ranges, or text characteristics."
            ),
            parameters=_schema_object(
                {
                    "column": types.Schema(
                        type="STRING",
                        description="Exact dataset column name.",
                    )
                },
                ["column"],
            ),
        ),
        types.FunctionDeclaration(
            name="query_dataset",
            description=(
                "Generic tabular query. Filter rows, group by one or more columns, "
                "aggregate numeric/categorical data, sort results, and limit output. "
                "Use this for questions like 'which group has the highest average X', "
                "'how many rows belong to each category', 'what is the total by region', "
                "or 'compare groups'."
            ),
            parameters=_schema_object({
                "group_by": types.Schema(
                    type="ARRAY",
                    items=types.Schema(type="STRING"),
                    description="Columns to group by. Empty for no grouping.",
                ),
                "aggregations": types.Schema(
                    type="ARRAY",
                    items=types.Schema(
                        type="OBJECT",
                        properties={
                            "column": types.Schema(
                                type="STRING",
                                description="Column name, or '*' for row count.",
                            ),
                            "function": types.Schema(
                                type="STRING",
                                enum=[
                                    "count", "nunique", "sum", "mean",
                                    "median", "min", "max", "std",
                                ],
                            ),
                            "alias": types.Schema(
                                type="STRING",
                                description="Optional result column name.",
                            ),
                        },
                        required=["column", "function"],
                    ),
                ),
                "filters": types.Schema(
                    type="ARRAY",
                    items=types.Schema(
                        type="OBJECT",
                        properties={
                            "column": types.Schema(type="STRING"),
                            "operator": types.Schema(
                                type="STRING",
                                enum=[
                                    "equals", "not_equals", "contains",
                                    "starts_with", "ends_with",
                                    "greater_than", "greater_or_equal",
                                    "less_than", "less_or_equal",
                                    "in", "not_in", "is_null", "not_null",
                                ],
                            ),
                            "value": types.Schema(
                                type="STRING",
                                description=(
                                    "Comparison value. For 'in'/'not_in', "
                                    "provide a JSON-compatible array."
                                ),
                            ),
                        },
                        required=["column", "operator"],
                    ),
                ),
                "sort_by": types.Schema(
                    type="STRING",
                    description="Result column to sort by.",
                ),
                "sort_direction": types.Schema(
                    type="STRING",
                    enum=["asc", "desc"],
                ),
                "limit": types.Schema(
                    type="INTEGER",
                    description="Maximum number of rows to return, up to 100.",
                ),
            }),
        ),
        types.FunctionDeclaration(
            name="calculate_relationship",
            description=(
                "Calculate Pearson correlation between two numeric columns and "
                "return an interpreted strength/direction. Use for questions about "
                "relationships between numeric variables."
            ),
            parameters=_schema_object({
                "column_a": types.Schema(type="STRING"),
                "column_b": types.Schema(type="STRING"),
            }, ["column_a", "column_b"]),
        ),
        types.FunctionDeclaration(
            name="find_top_correlations",
            description=(
                "Find the strongest pairwise Pearson correlations among numeric columns."
            ),
            parameters=_schema_object({
                "columns": types.Schema(
                    type="ARRAY",
                    items=types.Schema(type="STRING"),
                ),
                "top_n": types.Schema(type="INTEGER"),
            }),
        ),
        types.FunctionDeclaration(
            name="detect_outliers",
            description="Detect IQR-based outliers in a numeric column.",
            parameters=_schema_object({
                "column": types.Schema(type="STRING"),
            }, ["column"]),
        ),
        types.FunctionDeclaration(
            name="analyze_time_trend",
            description=(
                "Aggregate a dataset over time by day/week/month/quarter/year. "
                "Use for trends, changes over time, and time-based comparisons."
            ),
            parameters=_schema_object({
                "date_column": types.Schema(type="STRING"),
                "value_column": types.Schema(type="STRING"),
                "aggregation": types.Schema(
                    type="STRING",
                    enum=["count", "sum", "mean", "median", "min", "max"],
                ),
                "frequency": types.Schema(
                    type="STRING",
                    enum=["day", "week", "month", "quarter", "year"],
                ),
                "limit": types.Schema(type="INTEGER"),
            }, ["date_column", "aggregation", "frequency"]),
        ),
        types.FunctionDeclaration(
            name="calculate_date_difference",
            description=(
                "Calculate elapsed time between two date columns, optionally "
                "grouped by other columns. Useful for lifecycle, duration, "
                "turnaround, resolution, delivery, or response-time questions."
            ),
            parameters=_schema_object({
                "start_column": types.Schema(type="STRING"),
                "end_column": types.Schema(type="STRING"),
                "aggregation": types.Schema(
                    type="STRING",
                    enum=["count", "mean", "median", "min", "max", "std"],
                ),
                "group_by": types.Schema(
                    type="ARRAY",
                    items=types.Schema(type="STRING"),
                ),
                "unit": types.Schema(
                    type="STRING",
                    enum=["minutes", "hours", "days"],
                ),
                "limit": types.Schema(type="INTEGER"),
            }, ["start_column", "end_column", "aggregation"]),
        ),
        types.FunctionDeclaration(
            name="search_text",
            description=(
                "Search free-form text columns for a phrase/keyword and return "
                "matching row count plus sample matches."
            ),
            parameters=_schema_object({
                "query": types.Schema(type="STRING"),
                "columns": types.Schema(
                    type="ARRAY",
                    items=types.Schema(type="STRING"),
                ),
                "limit": types.Schema(type="INTEGER"),
            }, ["query"]),
        ),
        types.FunctionDeclaration(
            name="get_missingness_summary",
            description="Summarize missing values overall and by column.",
            parameters=_schema_object(),
        ),
        types.FunctionDeclaration(
            name="summarize_categorical_columns",
            description=(
                "Summarize categorical/boolean columns and their most frequent "
                "values. Use this when the user asks about categories, the most "
                "common category, or which categorical field has the most records."
            ),
            parameters=_schema_object({
                "columns": types.Schema(
                    type="ARRAY",
                    items=types.Schema(type="STRING"),
                ),
                "top_n": types.Schema(type="INTEGER"),
            }),
        ),
        types.FunctionDeclaration(
            name="calculate_general_relationship",
            description=(
                "Analyze relationships between numeric-numeric, categorical-categorical, "
                "or numeric-categorical columns using an appropriate statistical measure."
            ),
            parameters=_schema_object({
                "column_a": types.Schema(type="STRING"),
                "column_b": types.Schema(type="STRING"),
            }, ["column_a", "column_b"]),
        ),
        types.FunctionDeclaration(
            name="find_strongest_relationships",
            description=(
                "Find the strongest supported relationships in the dataset. "
                "Can focus on a target column. Uses Pearson/Spearman, Cramer's V, "
                "or eta-squared depending on column types."
            ),
            parameters=_schema_object({
                "target_column": types.Schema(type="STRING"),
                "columns": types.Schema(
                    type="ARRAY",
                    items=types.Schema(type="STRING"),
                ),
                "top_n": types.Schema(type="INTEGER"),
            }),
        ),
    ])


# ---------------------------------------------------------------------------
# Tool dispatcher
# ---------------------------------------------------------------------------

def _execute_tool(df: pd.DataFrame, function_name: str, args: Dict[str, Any]):
    if function_name == "get_dataset_profile":
        return get_dataset_profile(df)

    if function_name == "get_column_profile":
        return get_column_profile(df, str(args.get("column", "")))

    if function_name == "query_dataset":
        return query_dataset(
            df,
            group_by=args.get("group_by"),
            aggregations=args.get("aggregations"),
            filters=args.get("filters"),
            sort_by=args.get("sort_by"),
            sort_direction=args.get("sort_direction", "desc"),
            limit=args.get("limit", 20),
        )

    if function_name == "calculate_relationship":
        return calculate_relationship(
            df,
            str(args.get("column_a", "")),
            str(args.get("column_b", "")),
        )

    if function_name == "find_top_correlations":
        return find_top_correlations(
            df,
            columns=args.get("columns"),
            top_n=args.get("top_n", 10),
        )

    if function_name == "detect_outliers":
        return detect_outliers(df, str(args.get("column", "")))

    if function_name == "analyze_time_trend":
        return analyze_time_trend(
            df,
            date_column=str(args.get("date_column", "")),
            value_column=args.get("value_column"),
            aggregation=str(args.get("aggregation", "count")),
            frequency=str(args.get("frequency", "month")),
            limit=args.get("limit", 24),
        )

    if function_name == "calculate_date_difference":
        return calculate_date_difference(
            df,
            start_column=str(args.get("start_column", "")),
            end_column=str(args.get("end_column", "")),
            aggregation=str(args.get("aggregation", "mean")),
            group_by=args.get("group_by"),
            unit=str(args.get("unit", "hours")),
            limit=args.get("limit", 20),
        )

    if function_name == "search_text":
        return search_text(
            df,
            query=str(args.get("query", "")),
            columns=args.get("columns"),
            limit=args.get("limit", 10),
        )

    if function_name == "get_missingness_summary":
        return get_missingness_summary(df)

    if function_name == "summarize_categorical_columns":
        return summarize_categorical_columns(
            df,
            columns=args.get("columns"),
            top_n=args.get("top_n", 5),
        )

    if function_name == "calculate_general_relationship":
        return calculate_general_relationship(
            df,
            column_a=str(args.get("column_a", "")),
            column_b=str(args.get("column_b", "")),
        )

    if function_name == "find_strongest_relationships":
        return find_strongest_relationships(
            df,
            target_column=args.get("target_column"),
            columns=args.get("columns"),
            top_n=args.get("top_n", 10),
        )

    return {"error": f"Unknown tool: {function_name}"}


# ---------------------------------------------------------------------------
# Generic semantic-analysis helpers
# ---------------------------------------------------------------------------

def summarize_categorical_columns(
    df: pd.DataFrame,
    columns: Optional[List[str]] = None,
    top_n: int = 5,
) -> Dict[str, Any]:
    """
    Return the most frequent value from each categorical/boolean column.

    This is intentionally generic and helps resolve ambiguous questions such as
    "which category has the most records?" without confusing a column with
    the values inside that column.
    """
    candidates = columns or [
        str(col)
        for col in df.columns
        if infer_column_type(df, str(col)) in {"categorical", "boolean"}
    ]

    top_n = max(1, min(int(top_n or 5), 20))
    results = []

    for column in candidates:
        if column not in df.columns:
            continue

        kind = infer_column_type(df, column)
        if kind not in {"categorical", "boolean"}:
            continue

        counts = df[column].value_counts(dropna=False).head(top_n)
        top = []

        for value, count in counts.items():
            top.append({
                "value": _safe_text(value),
                "count": int(count),
                "percentage": round(float(count / max(len(df), 1) * 100), 2),
            })

        results.append({
            "column": column,
            "unique_values": int(df[column].nunique(dropna=True)),
            "top_values": top,
        })

    # Sort columns by the largest observed category so the answer to
    # "which category is most common?" is immediately visible.
    results.sort(
        key=lambda item: (
            -(item["top_values"][0]["count"] if item["top_values"] else 0),
            item["column"],
        )
    )

    return {
        "columns_analyzed": [item["column"] for item in results],
        "results": results,
    }


def _cramers_v(a: pd.Series, b: pd.Series) -> Optional[float]:
    from scipy.stats import chi2_contingency

    table = pd.crosstab(a, b)
    if table.empty or min(table.shape) < 2:
        return None

    chi2 = chi2_contingency(table, correction=False)[0]
    n = table.to_numpy().sum()

    if n <= 1:
        return None

    phi2 = chi2 / n
    rows, cols = table.shape
    phi2corr = max(
        0.0,
        phi2 - ((cols - 1) * (rows - 1)) / max(n - 1, 1),
    )
    rcorr = rows - ((rows - 1) ** 2) / max(n - 1, 1)
    kcorr = cols - ((cols - 1) ** 2) / max(n - 1, 1)

    denominator = max(min(kcorr - 1, rcorr - 1), 1e-12)
    return float(np.sqrt(phi2corr / denominator))


def calculate_general_relationship(
    df: pd.DataFrame,
    column_a: str,
    column_b: str,
) -> Dict[str, Any]:
    if column_a not in df.columns:
        return {"error": f"Unknown column: {column_a}"}
    if column_b not in df.columns:
        return {"error": f"Unknown column: {column_b}"}

    type_a = infer_column_type(df, column_a)
    type_b = infer_column_type(df, column_b)

    if {type_a, type_b} <= {"numeric"}:
        a = _numeric_series(df, column_a)
        b = _numeric_series(df, column_b)

        clean = pd.DataFrame({"a": a, "b": b}).dropna()
        if len(clean) < 2:
            return {"error": "At least two complete observations are required."}

        pearson = float(clean["a"].corr(clean["b"]))
        spearman = float(clean["a"].rank().corr(clean["b"].rank()))

        return {
            "column_a": column_a,
            "column_b": column_b,
            "type_a": type_a,
            "type_b": type_b,
            "method": "numeric_numeric",
            "pearson": round(pearson, 4),
            "spearman": round(spearman, 4) if pd.notna(spearman) else None,
            "observations_used": int(len(clean)),
            "note": "Association does not prove causation.",
        }

    categorical_types = {"categorical", "boolean"}
    if type_a in categorical_types and type_b in categorical_types:
        work = df[[column_a, column_b]].dropna()
        value = _cramers_v(work[column_a], work[column_b])

        return {
            "column_a": column_a,
            "column_b": column_b,
            "type_a": type_a,
            "type_b": type_b,
            "method": "categorical_categorical",
            "cramers_v": round(value, 4) if value is not None else None,
            "observations_used": int(len(work)),
            "note": "Cramér's V measures association between categorical variables; it does not imply causation.",
        }

    # Numeric + categorical: eta-squared based on between-group variance.
    if (type_a == "numeric" and type_b in categorical_types) or (
        type_b == "numeric" and type_a in categorical_types
    ):
        numeric_col = column_a if type_a == "numeric" else column_b
        category_col = column_b if type_a == "numeric" else column_a

        numeric = _numeric_series(df, numeric_col)
        work = pd.DataFrame({
            "numeric": numeric,
            "category": df[category_col],
        }).dropna()

        if len(work) < 2:
            return {"error": "Not enough complete observations."}

        grand_mean = float(work["numeric"].mean())
        total_ss = float(((work["numeric"] - grand_mean) ** 2).sum())

        if total_ss == 0:
            eta_squared = 0.0
        else:
            group_stats = work.groupby("category")["numeric"].agg(["count", "mean"])
            between_ss = float(
                (
                    group_stats["count"]
                    * (group_stats["mean"] - grand_mean) ** 2
                ).sum()
            )
            eta_squared = between_ss / total_ss

        return {
            "column_a": column_a,
            "column_b": column_b,
            "type_a": type_a,
            "type_b": type_b,
            "method": "numeric_categorical",
            "eta_squared": round(float(eta_squared), 4),
            "observations_used": int(len(work)),
            "note": "Eta-squared measures how much numeric variance is associated with group membership; it does not prove causation.",
        }

    return {
        "error": (
            f"No supported relationship method for {type_a} × {type_b}. "
            "Use numeric, categorical/boolean, or date/time columns appropriately."
        )
    }


def find_strongest_relationships(
    df: pd.DataFrame,
    target_column: Optional[str] = None,
    columns: Optional[List[str]] = None,
    top_n: int = 10,
) -> Dict[str, Any]:
    candidate_columns = columns or [
        str(col)
        for col in df.columns
        if infer_column_type(df, str(col)) in {
            "numeric", "categorical", "boolean"
        }
    ]

    candidate_columns = [
        col for col in candidate_columns
        if col in df.columns
        and infer_column_type(df, col) in {"numeric", "categorical", "boolean"}
    ]

    if target_column:
        if target_column not in df.columns:
            return {"error": f"Unknown target column: {target_column}"}
        pairs = [
            (col, target_column)
            for col in candidate_columns
            if col != target_column
        ]
    else:
        # Cap pairwise work for wide datasets.
        capped = candidate_columns[:20]
        pairs = [
            (capped[i], capped[j])
            for i in range(len(capped))
            for j in range(i + 1, len(capped))
        ]

    results = []

    for col_a, col_b in pairs:
        try:
            result = calculate_general_relationship(df, col_a, col_b)
        except Exception:
            continue

        if "error" in result:
            continue

        score = (
            result.get("pearson")
            if result.get("method") == "numeric_numeric"
            else result.get("cramers_v")
            if result.get("method") == "categorical_categorical"
            else result.get("eta_squared")
        )

        if score is None or pd.isna(score):
            continue

        results.append({
            **result,
            "strength_score": round(abs(float(score)), 4),
        })

    results.sort(key=lambda item: item["strength_score"], reverse=True)

    return {
        "target_column": target_column,
        "relationships": results[:max(1, min(int(top_n or 10), 30))],
    }



# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

def reset_chat_session(session_id: str) -> None:
    state = _CHAT_SESSIONS.pop(session_id, None)
    if state:
        client = state.get("client")
        if client is not None:
            try:
                client.close()
            except Exception:
                pass


def _build_system_instruction(profile: Dict[str, Any]) -> str:
    return (
        "You are the AI Analyst inside a general-purpose tabular data application. "
        "Your job is to answer questions about the CURRENT dataset accurately using "
        "the supplied analytics tools. Python/Pandas are the source of truth for all "
        "dataset facts and calculations. Never invent a number, category, column, "
        "date, trend, correlation, or conclusion that is not supported by tool results. "
        "Follow this analysis protocol for every question: (1) identify the user's "
        "actual intent and important nouns such as category, group, measure, target, "
        "owner, product, date, or outcome; (2) map those concepts to real columns in "
        "the dataset profile; (3) choose the appropriate analytical operation; (4) "
        "execute the needed tools; (5) validate that the tool results actually answer "
        "the user's question before finalizing. "
        "For ambiguous phrases like 'which category has the most records', do not "
        "reinterpret the question as 'which column has the most unique values'. "
        "Usually interpret 'category' as a value within a categorical column and, "
        "when more than one categorical column could fit, either compare the most "
        "relevant candidates or state the interpretation explicitly. "
        "Use conversation context to resolve references such as 'he', 'that one', "
        "'the other group', or 'is this better?'. "
        "Do not confuse counts/workload with performance, and do not claim causation "
        "from correlation. When evidence is insufficient, say exactly what is missing. "
        "When comparing groups, prefer directly comparable metrics and mention the "
        "metrics used. "
        "Before giving the final answer, check every number and named entity against "
        "the latest tool results and correct any unsupported inference. "
        "Keep answers understandable and concise, but provide enough evidence for the conclusion. "
        "This application supports generic tabular datasets: business data, support "
        "tickets, sales, finance, healthcare, experiments, sensors, and more. "
        "Do not assume Ericsson-specific semantics unless the current columns support them. "
        f"Here is the current dataset profile for orientation: {profile}"
    )


def analyze_question(
    session_id: str,
    df: pd.DataFrame,
    question: str,
) -> Dict[str, Any]:
    if not question or not question.strip():
        raise ValueError("Question cannot be empty.")

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not configured on the backend."
        )

    profile = get_dataset_profile(df)
    state = _CHAT_SESSIONS.get(session_id)

    if state is None:
        # Keep the Gemini client alive for as long as the chat session lives.
        # Storing only the Chat object can leave its underlying httpx client
        # to be garbage-collected/closed between FastAPI requests.
        client = genai.Client(api_key=api_key)
        chat = client.chats.create(
            model=MODEL_NAME,
            config=types.GenerateContentConfig(
                tools=[build_tool_declarations()],
                system_instruction=_build_system_instruction(profile),
            ),
        )
        state = {"client": client, "chat": chat}
        _CHAT_SESSIONS[session_id] = state
    else:
        client = state.get("client")
        chat = state.get("chat")

        # Recover gracefully if an older/invalid state contains a closed client.
        if client is None or chat is None:
            client = genai.Client(api_key=api_key)
            chat = client.chats.create(
                model=MODEL_NAME,
                config=types.GenerateContentConfig(
                    tools=[build_tool_declarations()],
                    system_instruction=_build_system_instruction(profile),
                ),
            )
            state = {"client": client, "chat": chat}
            _CHAT_SESSIONS[session_id] = state

    response = chat.send_message(question)
    tools_used: List[Dict[str, Any]] = []

    # Gemini supports multi-step/compositional function calling. We execute
    # requested functions locally, return their results, and let the model
    # decide whether it needs another tool before answering.
    max_tool_steps = 12

    for _ in range(max_tool_steps):
        parts = response.candidates[0].content.parts
        function_calls = [
            part.function_call
            for part in parts
            if part.function_call is not None
        ]

        if not function_calls:
            break

        # Execute the first call, then let the model inspect the result.
        # This also makes sequential dependencies explicit.
        function_call = function_calls[0]
        args = dict(function_call.args)

        try:
            tool_result = _execute_tool(df, function_call.name, args)
        except Exception as exc:
            tool_result = {
                "error": f"Tool execution failed: {type(exc).__name__}: {exc}"
            }

        tools_used.append({
            "tool": function_call.name,
            "arguments": args,
        })

        tool_response = types.Part.from_function_response(
            name=function_call.name,
            response=tool_result,
        )

        response = chat.send_message(tool_response)

    # Final validation pass: ask the same analyst to audit its own answer
    # against the evidence it just computed. If the audit needs another tool,
    # execute it through the same loop.
    validation_prompt = (
        "Validate the answer you just produced before returning it. "
        "Check that it directly answers the user's original question, that "
        "all numeric values and named categories are supported by tool results, "
        "that ambiguous terms were interpreted reasonably, and that workload "
        "is not being presented as performance. If anything is unsupported or "
        "misinterpreted, correct it. Return only the improved final answer."
    )

    validation_response = chat.send_message(validation_prompt)

    for _ in range(4):
        validation_calls = [
            part.function_call
            for part in validation_response.candidates[0].content.parts
            if part.function_call is not None
        ]

        if not validation_calls:
            break

        function_call = validation_calls[0]
        args = dict(function_call.args)

        try:
            tool_result = _execute_tool(df, function_call.name, args)
        except Exception as exc:
            tool_result = {
                "error": f"Tool execution failed: {type(exc).__name__}: {exc}"
            }

        tools_used.append({
            "tool": function_call.name,
            "arguments": args,
        })

        validation_response = chat.send_message(
            types.Part.from_function_response(
                name=function_call.name,
                response=tool_result,
            )
        )

    answer = (
        validation_response.text.strip()
        if validation_response.text
        else response.text.strip()
        if response.text
        else ""
    )

    if not answer:
        answer = (
            "I could not produce a final answer from the available "
            "dataset information."
        )

    return {
        "answer": answer,
        "tools_used": tools_used,
        "model": MODEL_NAME,
        "dataset_profile": {
            "rows": profile["rows"],
            "columns": profile["columns"],
            "numeric_columns": profile["numeric_columns"],
            "categorical_columns": profile["categorical_columns"],
            "datetime_columns": profile["datetime_columns"],
            "text_columns": profile["text_columns"],
        },
    }
