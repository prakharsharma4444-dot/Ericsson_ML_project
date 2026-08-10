"""
main.py — FastAPI backend for the ML pipeline app.

Wraps pipeline.py in a small set of REST endpoints so a React frontend
can drive the whole flow: upload a CSV, pick a target column, explore
the data, run the pipeline, compare model results, inspect feature
importance, predict on a new sample, and download the trained model.

Run with:
    uvicorn main:app --reload --port 8000
"""

import io
import tempfile
from typing import Any, Dict, Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel

from jsonsafe import to_jsonable
from session_store import Session, create_session, get_session
from ericsson_prep import prepare_ticket_data, get_negativity_score
from dashboard_stats import build_dashboard_summary
from pipeline import (
    validate_inputs,
    get_column_info,
    detect_problem_type,
    maybe_log_transform,
    encode_target,
    clean_data,
    encode_categoricals,
    check_imbalance,
    check_outliers,
    compare_two_columns,
    split_data,
    choose_scaler,
    get_default_models,
    train_and_evaluate,
    recommend_model,
    get_feature_importance,
    save_model,
    predict_single,
)

app = FastAPI(title="ML Pipeline API")

# Dev-friendly CORS: the Vite dev server runs on 5173 by default.
# Tighten this to your real frontend origin before deploying.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------

class ValidateRequest(BaseModel):
    target_col: str


class TrainRequest(BaseModel):
    target_col: Optional[str] = None
    priority: Optional[str] = None
    task: Optional[str] = None  # "priority" | "resolution" | "owner" — for Ericsson ticket data


class PredictRequest(BaseModel):
    model_name: str
    sample: Dict[str, Any]


class PivotRequest(BaseModel):
    cat_col: str
    num_col: str
    agg_func: str  # 'mean', 'sum', 'count', 'min', 'max'

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_session_or_404(session_id: str) -> Session:
    session = get_session(session_id)
    if session is None:
        raise HTTPException(404, "Session not found or expired. Please upload your CSV again.")
    return session


def build_feature_info(df: pd.DataFrame, cols):
    """
    Describes each pre-encoding feature column so the frontend can build
    a sensible predict form: number input for numeric columns, dropdown
    of observed values for categorical ones.
    """
    info = []
    for col in cols:
        is_numeric = pd.api.types.is_numeric_dtype(df[col])
        entry = {"name": col, "is_numeric": is_numeric}
        if is_numeric:
            entry["min"] = float(df[col].min()) if not pd.isna(df[col].min()) else None
            entry["max"] = float(df[col].max()) if not pd.isna(df[col].max()) else None
            entry["mean"] = float(df[col].mean()) if not pd.isna(df[col].mean()) else None
        else:
            options = df[col].dropna().unique().tolist()
            entry["options"] = [str(o) for o in options[:50]]
        info.append(entry)
    return info


TFIDF_PREFIX = "tfidf_"
TEXT_DERIVED_VIRTUAL_NAME = "case_description"


def split_text_derived_columns(cols):
    """
    Separates the auto-generated tfidf_* / text_negativity_score columns
    (opaque, not human-fillable) from everything else. Callers use this to
    hide the former from the predict form and replace them with a single
    free-text field instead.
    """
    text_derived = [c for c in cols if c.startswith(TFIDF_PREFIX) or c == "text_negativity_score"]
    plain = [c for c in cols if c not in text_derived]
    return plain, text_derived


def build_feature_defaults(df, plain_cols, text_derived_cols):
    """
    One representative value per original feature column: mean for numeric,
    most common value for categorical, 0 for text-derived columns (an
    absent-keyword baseline). Used to fill in anything the user's predict
    form doesn't ask about, instead of the misleading fallback of 0 for
    every missing field.
    """
    defaults = {}
    for col in plain_cols:
        if pd.api.types.is_numeric_dtype(df[col]):
            val = df[col].mean()
            defaults[col] = float(val) if pd.notna(val) else 0.0
        else:
            mode = df[col].mode()
            defaults[col] = str(mode.iloc[0]) if not mode.empty else ""
    for col in text_derived_cols:
        defaults[col] = 0.0
    return defaults


def build_predict_form_fields(df, plain_cols, has_text_derived):
    """
    The actual list of fields to show a human. Text-derived columns never
    appear individually — if any exist, they're represented by a single
    free-text 'case_description' field instead.
    """
    fields = build_feature_info(df, plain_cols)
    if has_text_derived:
        fields = [{"name": TEXT_DERIVED_VIRTUAL_NAME, "is_numeric": False, "is_text": True}] + fields
    return fields


def rank_top_features(model, feature_columns, plain_cols, text_derived_cols):
    """
    Aggregates encoded-column importances back to the original, human-facing
    field they came from: one-hot dummies collapse back to their parent
    categorical column, and every tfidf_*/text_negativity_score column
    collapses into the single 'case_description' field. Returns the top
    original field names, most important first.
    """
    importances = get_feature_importance(model, feature_columns)
    if not importances:
        return []

    text_derived_set = set(text_derived_cols)
    agg = {}
    for encoded_col, score in importances:
        if encoded_col in text_derived_set:
            parent = TEXT_DERIVED_VIRTUAL_NAME
        else:
            parent = next(
                (c for c in plain_cols if encoded_col == c or encoded_col.startswith(c + "_")),
                encoded_col,
            )
        agg[parent] = agg.get(parent, 0.0) + float(score)

    return sorted(agg, key=agg.get, reverse=True)


def generate_column_stats(df):
    stats = []
    alerts = []
    
    # Dataset-level health checks
    duplicate_rows = df.duplicated().sum()
    if duplicate_rows > 0:
        alerts.append(f"Found {duplicate_rows} exact duplicate row(s) in the dataset.")

    for col in df.columns:
        missing_count = df[col].isnull().sum()
        missing_pct = round((missing_count / len(df)) * 100, 1) if len(df) > 0 else 0.0
        n_unique = df[col].nunique()
        is_numeric = pd.api.types.is_numeric_dtype(df[col])

        # Column-level alerts
        if n_unique == 1:
            non_null_series = df[col].dropna()
            first_val = str(non_null_series.iloc[0]) if not non_null_series.empty else "N/A"
            alerts.append(f"Column '{col}' has zero variance (only 1 unique value: '{first_val}').")
        if missing_pct > 30:
            alerts.append(f"Column '{col}' has a high missing rate ({missing_pct}%).")
        if n_unique == len(df) and len(df) > 0 and not is_numeric:
            alerts.append(f"Column '{col}' appears to be a unique text ID/Index.")

        col_stat = {
            "name": col,
            "type": "Numeric" if is_numeric else "Categorical",
            "missing_pct": missing_pct,
            "missing_count": int(missing_count),
            "unique_count": int(n_unique),
        }

        if is_numeric:
            col_stat.update({
                "mean": round(float(df[col].mean()), 2) if not pd.isna(df[col].mean()) else None,
                "min": round(float(df[col].min()), 2) if not pd.isna(df[col].min()) else None,
                "max": round(float(df[col].max()), 2) if not pd.isna(df[col].max()) else None,
                "median": round(float(df[col].median()), 2) if not pd.isna(df[col].median()) else None,
            })

        stats.append(col_stat)

    return stats, alerts


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/sessions/upload")
async def upload(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Please upload a .csv file.")

    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(400, f"Could not read that CSV: {e}")

    if df.shape[1] == 0:
        raise HTTPException(400, "That file has no columns.")

    session_id = create_session()
    session = get_session(session_id)
    session.df_raw = df

    return {
        "session_id": session_id,
        "filename": file.filename,
        "n_rows": len(df),
        "n_cols": len(df.columns),
        "columns": to_jsonable(get_column_info(df)),
    }


@app.get("/api/sessions/{session_id}/columns")
def columns(session_id: str):
    session = get_session_or_404(session_id)
    return {"columns": to_jsonable(get_column_info(session.df_raw))}


@app.get("/api/sessions/{session_id}/preview")
def preview(session_id: str, rows: int = 10):
    session = get_session_or_404(session_id)
    df = session.df_raw
    
    column_stats, alerts = generate_column_stats(df)
    
    return {
        "preview": to_jsonable(df.head(rows).to_dict("records")),
        "n_rows": len(df),
        "n_cols": len(df.columns),
        "missing_values": int(df.isnull().sum().sum()),
        "numeric_features": int(df.select_dtypes(include="number").shape[1]),
        "column_stats": to_jsonable(column_stats),
        "alerts": alerts,
    }


@app.get("/api/sessions/{session_id}/columns/{column_name}")
def get_column_detail(session_id: str, column_name: str):
    try:
        session = get_session_or_404(session_id)
        df = session.df_raw

        target_col = column_name
        if target_col not in df.columns:
            matches = [c for c in df.columns if str(c).strip() == str(column_name).strip()]
            if matches:
                target_col = matches[0]
            else:
                raise HTTPException(status_code=404, detail=f"Column '{column_name}' not found")

        col_data = df[target_col]
        if isinstance(col_data, pd.DataFrame):
            col_data = col_data.iloc[:, 0]

        series = col_data.dropna()

        if len(series) == 0:
            return to_jsonable({
                "name": str(target_col),
                "type": "Empty",
                "distribution": [],
                "skewness": 0.0,
                "outliers_count": 0,
                "total_count": 0
            })

        is_bool = pd.api.types.is_bool_dtype(series)
        is_numeric = pd.api.types.is_numeric_dtype(series) and not is_bool

        if not is_numeric and not is_bool:
            coerced = pd.to_numeric(series, errors='coerce').dropna()
            if len(coerced) > 0 and len(coerced) >= len(series) * 0.8:
                series = coerced
                is_numeric = True

        if is_numeric:
            series = series.replace([np.inf, -np.inf], np.nan).dropna()
            if len(series) == 0:
                return to_jsonable({
                    "name": str(target_col),
                    "type": "Numeric",
                    "distribution": [],
                    "skewness": 0.0,
                    "outliers_count": 0,
                    "total_count": 0
                })

            counts, bin_edges = np.histogram(series, bins=10)
            histogram = []
            for i in range(len(counts)):
                bin_label = f"{round(float(bin_edges[i]), 2)} - {round(float(bin_edges[i+1]), 2)}"
                histogram.append({"bin": bin_label, "count": int(counts[i])})

            try:
                q1 = float(series.quantile(0.25))
                q3 = float(series.quantile(0.75))
                iqr = q3 - q1
                outliers_count = int(((series < (q1 - 1.5 * iqr)) | (series > (q3 + 1.5 * iqr))).sum()) if iqr > 0 else 0
            except Exception:
                outliers_count = 0

            try:
                skew_val = series.skew()
                skewness = round(float(skew_val), 2) if (pd.notna(skew_val) and np.isfinite(skew_val)) else 0.0
            except Exception:
                skewness = 0.0

            return to_jsonable({
                "name": str(target_col),
                "type": "Numeric",
                "distribution": histogram,
                "skewness": skewness,
                "outliers_count": outliers_count,
                "total_count": int(len(series))
            })
        else:
            top_counts = series.value_counts().head(10)
            freq_data = [{"bin": str(k), "count": int(v)} for k, v in top_counts.items()]

            return to_jsonable({
                "name": str(target_col),
                "type": "Categorical",
                "distribution": freq_data,
                "skewness": 0.0,
                "outliers_count": 0,
                "total_count": int(len(series))
            })

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error loading column '{column_name}': {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/sessions/{session_id}/validate")
def validate(session_id: str, req: ValidateRequest):
    session = get_session_or_404(session_id)
    errors, warnings = validate_inputs(session.df_raw, req.target_col)

    problem_type = None
    if not errors:
        problem_type = detect_problem_type(session.df_raw[req.target_col])

    return {"errors": errors, "warnings": warnings, "problem_type": problem_type}


@app.get("/api/sessions/{session_id}/compare")
def compare(session_id: str, col1: str, col2: str):
    session = get_session_or_404(session_id)
    if col1 not in session.df_raw.columns or col2 not in session.df_raw.columns:
        raise HTTPException(400, "Unknown column name.")
    result = compare_two_columns(session.df_raw, col1, col2)
    return to_jsonable(result)


@app.post("/api/sessions/{session_id}/train")
def train(session_id: str, req: TrainRequest):
    session = get_session_or_404(session_id)
    df = session.df_raw.copy()

    tfidf_vectorizer = None
    if req.task:
        df, target_col, tfidf_vectorizer = prepare_ticket_data(df, task=req.task)
    elif req.target_col:
        target_col = req.target_col
    else:
        raise HTTPException(400, "Must provide either 'target_col' or 'task'.")

    errors, warnings = validate_inputs(df, target_col)
    if errors:
        raise HTTPException(400, {"errors": errors, "warnings": warnings})

    problem_type = detect_problem_type(df[target_col])
    df, target_col_final, was_log = maybe_log_transform(df, target_col, problem_type)

    if was_log and not np.isfinite(df[target_col_final]).all():
        raise HTTPException(
            400,
            f"'{target_col}' has values <= -1, so a log transform produces invalid "
            "numbers for some rows. This column looks too skewed to log-transform "
            "safely — you may need to clean it (remove negative/zero values) first.",
        )

    df, clean_report = clean_data(df)

    original_feature_cols = [c for c in df.columns if c not in (target_col, target_col_final)]
    plain_feature_cols, text_derived_cols = split_text_derived_columns(original_feature_cols)
    has_text_derived = bool(text_derived_cols) and tfidf_vectorizer is not None

    original_feature_info = build_predict_form_fields(df, plain_feature_cols, has_text_derived)
    original_feature_defaults = build_feature_defaults(df, plain_feature_cols, text_derived_cols)

    categorical_columns = [
        c for c in original_feature_cols if df[c].dtype == "object"
    ]

    df = encode_categoricals(df, target_col_final)

    imbalance_counts = None
    label_classes = None
    if problem_type == "classification":
        counts = check_imbalance(df, target_col_final)
        imbalance_counts = counts.to_dict()
        if not pd.api.types.is_numeric_dtype(df[target_col_final]):
            label_classes = sorted(df[target_col_final].dropna().unique().tolist())
        df = encode_target(df, target_col_final)

    outlier_summary = check_outliers(df, target_col_final)

    drop_cols = [c for c in (target_col, target_col_final) if c in df.columns]
    X = df.drop(columns=drop_cols)
    y = df[target_col_final]

    if len(X.columns) == 0:
        raise HTTPException(400, "No feature columns left after cleaning. Try a different target.")

    X_train, X_test, y_train, y_test = split_data(X, y)
    scaler = choose_scaler(outlier_summary, total_features=X.shape[1])
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    models = get_default_models(problem_type)
    results_df, trained_models = train_and_evaluate(
        models, X_train_scaled, y_train, X_test_scaled, y_test, problem_type, was_log
    )

    try:
        best_model = recommend_model(results_df, trained_models, problem_type, priority=req.priority)
    except ValueError as e:
        raise HTTPException(400, str(e))

    recommended_name = next(name for name, m in trained_models.items() if m is best_model)
    top_features = rank_top_features(best_model, session_feature_columns := X_train.columns.tolist(), plain_feature_cols, text_derived_cols)

    session.target_col = target_col
    session.problem_type = problem_type
    session.was_log_transformed = was_log
    session.log_target_col = target_col_final if was_log else None
    session.clean_report = clean_report
    session.outlier_summary = outlier_summary
    session.imbalance_counts = imbalance_counts
    session.original_feature_info = original_feature_info
    session.original_feature_defaults = original_feature_defaults
    session.text_derived_cols = text_derived_cols
    session.tfidf_vectorizer = tfidf_vectorizer if has_text_derived else None
    session.categorical_columns = categorical_columns
    session.feature_columns = session_feature_columns
    session.scaler = scaler
    session.trained_models = trained_models
    session.results = results_df.to_dict("records")
    session.recommended_model = recommended_name
    session.top_features = top_features
    session.label_classes = label_classes

    return to_jsonable({
        "problem_type": problem_type,
        "was_log_transformed": was_log,
        "clean_report": clean_report,
        "outlier_summary": outlier_summary,
        "imbalance_counts": imbalance_counts,
        "results": session.results,
        "recommended_model": recommended_name,
        "warnings": warnings,
        "feature_columns": session.feature_columns,
        "original_feature_info": original_feature_info,
        "top_features": top_features,
    })


@app.get("/api/sessions/{session_id}/models")
def models(session_id: str):
    session = get_session_or_404(session_id)
    if not session.trained_models:
        raise HTTPException(400, "No trained models yet — run the pipeline first.")
    return {
        "models": list(session.trained_models.keys()),
        "recommended_model": session.recommended_model,
        "results": session.results,
    }


@app.get("/api/sessions/{session_id}/feature-importance/{model_name}")
def feature_importance(session_id: str, model_name: str):
    session = get_session_or_404(session_id)
    model = session.trained_models.get(model_name)
    if model is None:
        raise HTTPException(404, f"No trained model named '{model_name}'.")

    importances = get_feature_importance(model, session.feature_columns)
    if importances is None:
        return {"supported": False, "importances": []}

    return {
        "supported": True,
        "importances": [{"feature": f, "importance": to_jsonable(v)} for f, v in importances],
    }


@app.get("/api/sessions/{session_id}/dashboard-summary")
def dashboard_summary(session_id: str):
    session = get_session_or_404(session_id)
    try:
        result = build_dashboard_summary(session.df_raw)
    except Exception as e:
        raise HTTPException(400, f"Could not compute dashboard summary: {e}")
    return to_jsonable(result)


@app.post("/api/sessions/{session_id}/predict")
def predict(session_id: str, req: PredictRequest):
    session = get_session_or_404(session_id)
    model = session.trained_models.get(req.model_name)
    if model is None:
        raise HTTPException(404, f"No trained model named '{req.model_name}'.")

    # Start from the dataset's real averages/most-common values, not 0 —
    # 0 is a plausible real value for many columns and silently distorts
    # the prediction for every field the user didn't fill in.
    full_sample = dict(getattr(session, "original_feature_defaults", None) or {})

    user_sample = dict(req.sample)
    case_description = user_sample.pop(TEXT_DERIVED_VIRTUAL_NAME, None)
    full_sample.update(user_sample)

    if case_description and getattr(session, "tfidf_vectorizer", None) is not None:
        vectorizer = session.tfidf_vectorizer
        vec = vectorizer.transform([str(case_description).lower()])
        tfidf_names = [f"tfidf_{w}" for w in vectorizer.get_feature_names_out()]
        for name, val in zip(tfidf_names, vec.toarray()[0]):
            full_sample[name] = float(val)
        full_sample["text_negativity_score"] = get_negativity_score(case_description)

    sample_df = pd.DataFrame([full_sample])

    cat_cols = [c for c in (session.categorical_columns or []) if c in sample_df.columns]
    if cat_cols:
        sample_df = pd.get_dummies(sample_df, columns=cat_cols)

    sample_df = sample_df.reindex(columns=session.feature_columns, fill_value=0)
    sample_dict = sample_df.iloc[0].to_dict()

    try:
        result = predict_single(
            model,
            session.scaler,
            sample_dict,
            session.feature_columns,
            was_log_transformed=session.was_log_transformed,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

    if session.label_classes and session.problem_type == "classification":
        idx = int(round(result["prediction"]))
        if 0 <= idx < len(session.label_classes):
            result["predicted_class"] = session.label_classes[idx]
            if "class_probabilities" in result:
                result["class_labels"] = session.label_classes

    return to_jsonable(result)


@app.get("/api/sessions/{session_id}/download-model/{model_name}")
def download_model(session_id: str, model_name: str):
    session = get_session_or_404(session_id)
    model = session.trained_models.get(model_name)
    if model is None:
        raise HTTPException(404, f"No trained model named '{model_name}'.")

    tmp = tempfile.NamedTemporaryFile(suffix=".joblib", delete=False)
    save_model(
        model,
        session.scaler,
        session.feature_columns,
        session.problem_type,
        session.was_log_transformed,
        tmp.name,
    )

    safe_name = "".join(c if c.isalnum() else "_" for c in model_name)
    return FileResponse(
        tmp.name,
        media_type="application/octet-stream",
        filename=f"{safe_name}.joblib",
    )


# ---------------------------------------------------------------------------
# Feature 4 & 5: Pivot Aggregator & Standalone HTML Profiling Report
# ---------------------------------------------------------------------------

@app.post("/api/sessions/{session_id}/pivot")
def build_pivot(session_id: str, req: PivotRequest):
    session = get_session_or_404(session_id)
    df = session.df_raw

    if req.cat_col not in df.columns or req.num_col not in df.columns:
        raise HTTPException(status_code=400, detail="Selected column not found in dataset.")

    valid_aggs = ['mean', 'sum', 'count', 'min', 'max']
    agg_lower = req.agg_func.lower()
    if agg_lower not in valid_aggs:
        raise HTTPException(status_code=400, detail=f"Invalid aggregation method. Choose from {valid_aggs}")

    try:
        grouped = (
            df.groupby(req.cat_col)[req.num_col]
            .agg(agg_lower)
            .reset_index()
            .dropna()
        )
        grouped.columns = ["category", "value"]

        grouped["value"] = grouped["value"].apply(
            lambda v: round(float(v), 2) if isinstance(v, (int, float, np.number)) and not pd.isna(v) else v
        )

        return to_jsonable(grouped.to_dict("records"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sessions/{session_id}/report", response_class=HTMLResponse)
def generate_report(session_id: str):
    session = get_session_or_404(session_id)
    df = session.df_raw

    n_rows, n_cols = df.shape
    missing_cells = int(df.isnull().sum().sum())
    missing_pct = round((missing_cells / (n_rows * n_cols or 1)) * 100, 2)
    duplicates = int(df.duplicated().sum())

    col_rows_html = ""
    for col in df.columns:
        dtype = str(df[col].dtype)
        col_missing = int(df[col].isnull().sum())
        col_missing_pct = round((col_missing / (n_rows or 1)) * 100, 1)
        unique_cnt = int(df[col].nunique())

        is_num = pd.api.types.is_numeric_dtype(df[col]) and not pd.api.types.is_bool_dtype(df[col])

        if is_num:
            mean_val = f"{df[col].mean():.2f}" if pd.notna(df[col].mean()) else "N/A"
            min_val = f"{df[col].min():.2f}" if pd.notna(df[col].min()) else "N/A"
            max_val = f"{df[col].max():.2f}" if pd.notna(df[col].max()) else "N/A"
        else:
            mean_val, min_val, max_val = "-", "-", "-"

        col_rows_html += f"""
        <tr>
            <td class="font-bold">{col}</td>
            <td><span class="badge">{dtype}</span></td>
            <td>{unique_cnt}</td>
            <td>{col_missing} ({col_missing_pct}%)</td>
            <td>{mean_val}</td>
            <td>{min_val}</td>
            <td>{max_val}</td>
        </tr>
        """

    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Dataset Health Report — Session {session_id[:8]}</title>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 2rem; }}
            .container {{ max-width: 1100px; margin: 0 auto; }}
            h1 {{ font-size: 1.8rem; margin-bottom: 0.5rem; color: #38bdf8; }}
            p.sub {{ color: #94a3b8; font-size: 0.9rem; margin-bottom: 2rem; }}
            .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }}
            .card {{ background: #1e293b; padding: 1.2rem; border-radius: 10px; border: 1px solid #334155; }}
            .card h3 {{ margin: 0; font-size: 0.8rem; text-transform: uppercase; color: #94a3b8; }}
            .card p {{ margin: 0.5rem 0 0 0; font-size: 1.5rem; font-weight: bold; color: #f1f5f9; }}
            table {{ width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 10px; overflow: hidden; border: 1px solid #334155; }}
            th, td {{ padding: 0.8rem 1rem; text-align: left; font-size: 0.85rem; border-bottom: 1px solid #334155; }}
            th {{ background: #0f172a; color: #94a3b8; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; }}
            tr:hover {{ background: rgba(51, 65, 85, 0.5); }}
            .font-bold {{ font-weight: 600; color: #38bdf8; }}
            .badge {{ background: #0284c7; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-family: monospace; }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>📑 Interactive Data Health Report</h1>
            <p class="sub">Generated for Session ID: <code>{session_id}</code></p>

            <div class="grid">
                <div class="card">
                    <h3>Total Rows</h3>
                    <p>{n_rows:,}</p>
                </div>
                <div class="card">
                    <h3>Total Columns</h3>
                    <p>{n_cols}</p>
                </div>
                <div class="card">
                    <h3>Missing Cells</h3>
                    <p>{missing_cells:,} ({missing_pct}%)</p>
                </div>
                <div class="card">
                    <h3>Duplicate Rows</h3>
                    <p>{duplicates}</p>
                </div>
            </div>

            <h2>Column Breakdown</h2>
            <table>
                <thead>
                    <tr>
                        <th>Column</th>
                        <th>Type</th>
                        <th>Unique Values</th>
                        <th>Missing</th>
                        <th>Mean</th>
                        <th>Min</th>
                        <th>Max</th>
                    </tr>
                </thead>
                <tbody>
                    {col_rows_html}
                </tbody>
            </table>
        </div>
    </body>
    </html>
    """

    return HTMLResponse(content=html_content, status_code=200)