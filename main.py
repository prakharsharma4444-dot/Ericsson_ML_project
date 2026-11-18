# main.py — FastAPI backend[cite: 6]
import io
import tempfile
from typing import Any, Dict, Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Query
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from pydantic import BaseModel
from sklearn.model_selection import train_test_split

from jsonsafe import to_jsonable
from session_store import Session, create_session, get_session
from support_ticket_prep import prepare_ticket_data, get_negativity_score
from ai_analyst import analyze_question
from dashboard_stats import build_dashboard_summary
from adaptive_pipeline import (
    clean_adaptive_data,
    infer_feature_types,
    engineer_adaptive_features,
    build_adaptive_pipelines,
    cross_validate_adaptive,
    train_adaptive_models,
    recommend_adaptive_model,
    adaptive_feature_names,
    get_adaptive_feature_importance,
    predict_adaptive_single,
)
from pipeline import (
    validate_inputs,
    get_column_info,
    detect_problem_type,
    maybe_log_transform,
    encode_target,
    clean_data,
    encode_categoricals,
    add_standard_transforms,          
    build_cv_pipelines,
    cross_validate_models,
    select_informative_features,      
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

app = FastAPI(title="InsightForge API")

# Dev-friendly CORS: the Vite dev server runs on 5173 by default.
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
    task: Optional[str] = None
    test_size: Optional[float] = None
    
class PredictRequest(BaseModel):
    model_name: str
    sample: Dict[str, Any]


class PivotRequest(BaseModel):
    cat_col: str
    num_col: str
    agg_func: str  # 'mean', 'sum', 'count', 'min', 'max'


class SheetSelectRequest(BaseModel):
    sheet_name: str

class AIChatRequest(BaseModel):
    question: str

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_session_or_404(session_id: str) -> Session:
    session = get_session(session_id)
    if session is None:
        raise HTTPException(404, "Session not found or expired. Please upload your CSV again.")
    return session


def read_uploaded_file(filename: str, content: bytes) -> pd.DataFrame:
    """
    Read a single dataset from an uploaded file.

    This helper is intentionally kept for operations such as the existing
    two-file merge endpoint, where each input should resolve to one DataFrame.
    """
    lower = filename.lower()
    try:
        if lower.endswith(".csv"):
            return pd.read_csv(io.BytesIO(content))
        elif lower.endswith(".xlsx"):
            return pd.read_excel(io.BytesIO(content), engine="openpyxl")
        elif lower.endswith(".xls"):
            return pd.read_excel(io.BytesIO(content), engine="xlrd")
        else:
            raise HTTPException(400, "Please upload a .csv, .xlsx, or .xls file.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"Could not read '{filename}': {e}")


def read_uploaded_sheets(
    filename: str,
    content: bytes,
) -> Dict[str, pd.DataFrame]:
    """
    Read an uploaded file as one or more named datasets.

    CSV files are represented as a single logical sheet named "Sheet1".
    Excel workbooks load all worksheets.
    """
    lower = filename.lower()

    try:
        if lower.endswith(".csv"):
            return {
                "Sheet1": pd.read_csv(io.BytesIO(content))
            }

        if lower.endswith(".xlsx"):
            return pd.read_excel(
                io.BytesIO(content),
                sheet_name=None,
                engine="openpyxl",
            )

        if lower.endswith(".xls"):
            return pd.read_excel(
                io.BytesIO(content),
                sheet_name=None,
                engine="xlrd",
            )

        raise HTTPException(
            400,
            "Please upload a .csv, .xlsx, or .xls file."
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            400,
            f"Could not read '{filename}': {e}"
        )


def build_feature_info(df: pd.DataFrame, cols):
    info = []
    feature_meta = infer_feature_types(df[cols]) if cols else {
        "numeric": [], "categorical": [], "datetime": [], "text": [], "transform_candidates": []
    }

    datetime_cols = set(feature_meta.get("datetime", []))
    text_cols = set(feature_meta.get("text", []))

    for col in cols:
        is_numeric = pd.api.types.is_numeric_dtype(df[col])
        entry = {
            "name": col,
            "is_numeric": is_numeric,
            "is_datetime": col in datetime_cols,
            "is_text": col in text_cols,
        }

        if is_numeric:
            entry["min"] = float(df[col].min()) if not pd.isna(df[col].min()) else None
            entry["max"] = float(df[col].max()) if not pd.isna(df[col].max()) else None
            entry["mean"] = float(df[col].mean()) if not pd.isna(df[col].mean()) else None
        elif col in datetime_cols or col in text_cols:
            entry["options"] = []
        else:
            options = df[col].dropna().unique().tolist()
            entry["options"] = [str(o) for o in options[:50]]

        info.append(entry)
    return info


TFIDF_PREFIX = "tfidf_"
TEXT_DERIVED_VIRTUAL_NAME = "case_description"


def split_text_derived_columns(cols):
    text_derived = [c for c in cols if c.startswith(TFIDF_PREFIX) or c == "text_negativity_score"]
    plain = [c for c in cols if c not in text_derived]
    return plain, text_derived


def build_feature_defaults(df, plain_cols, text_derived_cols):
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


PRODUCT_VIRTUAL_NAME = "product"


def build_predict_form_fields(df, plain_cols, has_text_derived):
    # Hide engineered product one-hot columns from the user.
    product_cols = [
        c for c in plain_cols
        if str(c).lower().startswith("prod_")
    ]

    visible_cols = [
        c for c in plain_cols
        if c not in product_cols
        and c not in {"target_solution_hours", "resolution_hours"}
    ]

    fields = build_feature_info(df, visible_cols)

    if product_cols:
        product_options = [
            c[len("prod_"):]
            for c in product_cols
            if c[len("prod_"):].strip()
        ]

        fields.insert(
            0,
            {
                "name": PRODUCT_VIRTUAL_NAME,
                "is_numeric": False,
                "is_text": False,
                "options": sorted(set(product_options)),
            },
        )

    if has_text_derived:
        fields.insert(
            0,
            {
                "name": TEXT_DERIVED_VIRTUAL_NAME,
                "is_numeric": False,
                "is_text": True,
            },
        )

    return fields

def rank_top_features(model, feature_columns, plain_cols, text_derived_cols):
    importances = get_adaptive_feature_importance(model)
    if not importances:
        return []

    ranked = []
    for encoded_col, score in importances:
        parent = encoded_col
        for plain in plain_cols:
            if encoded_col == plain or encoded_col.startswith(f"{plain}_"):
                parent = plain
                break
        if encoded_col.startswith("text_negativity_score") or encoded_col.startswith("case_description"):
            parent = TEXT_DERIVED_VIRTUAL_NAME
        ranked.append((parent, float(score)))

    aggregated = {}
    for parent, score in ranked:
        aggregated[parent] = aggregated.get(parent, 0.0) + score

    return sorted(aggregated.items(), key=lambda item: item[1], reverse=True)


def generate_column_stats(df):
    stats = []
    alerts = []
    
    duplicate_rows = df.duplicated().sum()
    if duplicate_rows > 0:
        alerts.append(f"Found {duplicate_rows} exact duplicate row(s) in the dataset.")

    for col in df.columns:
        missing_count = df[col].isnull().sum()
        missing_pct = round((missing_count / len(df)) * 100, 1) if len(df) > 0 else 0.0
        n_unique = df[col].nunique()
        is_numeric = pd.api.types.is_numeric_dtype(df[col])

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
    if not file.filename.lower().endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(400, "Please upload a .csv, .xlsx, or .xls file.")

    content = await file.read()
    sheets = read_uploaded_sheets(file.filename, content)

    if not sheets:
        raise HTTPException(
            400,
            "The uploaded workbook contains no worksheets."
        )

    # Ignore completely empty worksheets so the user cannot accidentally
    # select a blank tab and break downstream analysis.
    non_empty_sheets = {
        str(name): df
        for name, df in sheets.items()
        if df is not None and not df.empty
    }

    if not non_empty_sheets:
        raise HTTPException(
            400,
            "The uploaded workbook contains no non-empty worksheets."
        )

    # Make sure every sheet has at least one column.
    invalid_sheets = [
        name
        for name, df in non_empty_sheets.items()
        if df.shape[1] == 0
    ]
    if invalid_sheets:
        # Keep useful sheets and simply ignore structurally empty ones.
        non_empty_sheets = {
            name: df
            for name, df in non_empty_sheets.items()
            if df.shape[1] > 0
        }

    if not non_empty_sheets:
        raise HTTPException(
            400,
            "The uploaded workbook contains no usable worksheets."
        )

    session_id = create_session()
    session = get_session(session_id)

    session.file_name = file.filename
    session.sheets = non_empty_sheets

    # First usable sheet becomes the initial active dataset.
    session.active_sheet = next(iter(non_empty_sheets))
    session.df_raw = non_empty_sheets[session.active_sheet]

    active_df = session.df_raw

    return {
        "session_id": session_id,
        "filename": file.filename,
        "active_sheet": session.active_sheet,
        "sheets": [
            {
                "name": str(name),
                "n_rows": int(len(df)),
                "n_cols": int(len(df.columns)),
            }
            for name, df in non_empty_sheets.items()
        ],
        "n_rows": len(active_df),
        "n_cols": len(active_df.columns),
        "columns": to_jsonable(get_column_info(active_df)),
    }


@app.get("/api/sessions/{session_id}/sheets")
def get_sheets(session_id: str):
    session = get_session_or_404(session_id)

    return {
        "filename": session.file_name,
        "active_sheet": session.active_sheet,
        "sheets": [
            {
                "name": str(name),
                "n_rows": int(len(df)),
                "n_cols": int(len(df.columns)),
            }
            for name, df in session.sheets.items()
        ],
    }


@app.post("/api/sessions/{session_id}/sheet")
def select_sheet(session_id: str, req: SheetSelectRequest):
    session = get_session_or_404(session_id)

    if req.sheet_name not in session.sheets:
        raise HTTPException(
            404,
            f"Worksheet '{req.sheet_name}' was not found in this workbook."
        )

    session.active_sheet = req.sheet_name
    session.df_raw = session.sheets[req.sheet_name]

    # Any trained model belongs to the previous active sheet and must not be
    # reused after switching worksheets.
    session.target_col = None
    session.problem_type = None
    session.clean_report = None
    session.outlier_summary = None
    session.imbalance_counts = None
    session.original_feature_info = None
    session.original_feature_defaults = None
    session.text_derived_cols = None
    session.tfidf_vectorizer = None
    session.categorical_columns = None
    session.feature_columns = None
    session.scaler = None
    session.trained_models = {}
    session.results = None
    session.cv_results = None
    session.recommended_model = None
    session.top_features = None
    session.label_classes = None

    df = session.df_raw

    return {
        "filename": session.file_name,
        "active_sheet": session.active_sheet,
        "n_rows": int(len(df)),
        "n_cols": int(len(df.columns)),
        "columns": to_jsonable(get_column_info(df)),
    }


ID_LIKE_KEYWORDS = ("id", "number", "key", "code", "no")


def pick_join_column(df_a: pd.DataFrame, df_b: pd.DataFrame, common_cols):
    id_like = [c for c in common_cols if any(kw in c.lower() for kw in ID_LIKE_KEYWORDS)]
    candidates = id_like if id_like else common_cols
    return max(candidates, key=lambda c: df_a[c].nunique())


@app.post("/api/merge")
async def merge_files(
    file_a: UploadFile = File(...),
    file_b: UploadFile = File(...),
    mode: str = Form("concat"),
    join_column: Optional[str] = Form(None),
):
    content_a = await file_a.read()
    content_b = await file_b.read()

    df_a = read_uploaded_file(file_a.filename, content_a)
    df_b = read_uploaded_file(file_b.filename, content_b)

    common_cols = [c for c in df_a.columns if c in df_b.columns]

    if mode == "join":
        if not common_cols:
            raise HTTPException(
                400,
                "These two files don't share any column names, so there's nothing to join "
                "on. Make sure both files have a shared key column (e.g. 'ID', 'Case Number') "
                "with the exact same name, then try again.",
            )

        col = join_column if join_column in common_cols else pick_join_column(df_a, df_b, common_cols)

        try:
            combined = pd.merge(df_a, df_b, on=col, how="inner", suffixes=("_a", "_b"))
        except Exception as e:
            raise HTTPException(400, f"Could not join these files: {e}")

        if combined.shape[0] == 0:
            raise HTTPException(
                400,
                f"Tried joining on '{col}' but got zero matching rows. The values in "
                f"'{col}' don't actually overlap between the two files — double check "
                "both files really describe the same records.",
            )

        suffix = "joined"

    else:
        if not common_cols:
            raise HTTPException(
                400,
                "These two files don't share any column names at all, so stacking them "
                "wouldn't produce a sensible combined dataset. Make sure both files use "
                "the same column headers.",
            )

        combined = pd.concat([df_a, df_b], ignore_index=True, sort=False)
        suffix = "combined"

    buf = io.StringIO()
    combined.to_csv(buf, index=False)
    buf.seek(0)

    name_a = file_a.filename.rsplit(".", 1)[0]
    name_b = file_b.filename.rsplit(".", 1)[0]
    merged_filename = f"{name_a}_{name_b}_{suffix}.csv"

    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{merged_filename}"'},
    )


@app.get("/api/sessions/{session_id}/columns")
def columns(session_id: str):
    session = get_session_or_404(session_id)
    return {"columns": to_jsonable(get_column_info(session.df_raw))}


@app.get("/api/sessions/{session_id}/preview")
def preview(session_id: str, rows: Optional[int] = None):
    session = get_session_or_404(session_id)
    df = session.df_raw
    
    column_stats, alerts = generate_column_stats(df)
    preview_df = df.head(rows) if rows is not None else df
    
    return {
        "preview": to_jsonable(preview_df.to_dict("records")),
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
    df, target_col_final, was_log = maybe_log_transform(
        df,
        target_col,
        problem_type,
    )

    if was_log and not np.isfinite(df[target_col_final]).all():
        raise HTTPException(
            400,
            f"'{target_col}' has values <= -1, so a log transform produces invalid "
            "numbers for some rows. This target cannot be safely log-transformed.",
        )

    if was_log and target_col in df.columns and target_col != target_col_final:
        df = df.drop(columns=[target_col])

    # Structural cleaning only. Imputation is deliberately handled inside
    # the adaptive sklearn preprocessing pipeline after the train/test split.
    df, clean_report = clean_adaptive_data(df, target_col_final)

    original_feature_cols = [
        c for c in df.columns
        if c not in (target_col, target_col_final)
    ]

    plain_feature_cols, text_derived_cols = split_text_derived_columns(
        original_feature_cols
    )
    has_text_derived = bool(text_derived_cols) and tfidf_vectorizer is not None

    original_feature_info = build_predict_form_fields(
        df,
        plain_feature_cols,
        has_text_derived,
    )
    original_feature_defaults = build_feature_defaults(
        df,
        plain_feature_cols,
        text_derived_cols,
    )

    categorical_columns = [
        c
        for c in original_feature_cols
        if df[c].dtype == "object"
    ]

    imbalance_counts = None
    label_classes = None

    if problem_type == "classification":
        raw_classes = df[target_col_final].dropna().unique().tolist()
        if not pd.api.types.is_numeric_dtype(df[target_col_final]):
            label_classes = sorted([str(v) for v in raw_classes])

        df = encode_target(df, target_col_final)

        # Keep a small class-balance report for the UI / diagnostics.
        imbalance_counts = df[target_col_final].value_counts().to_dict()

    drop_cols = [
        c
        for c in (target_col, target_col_final)
        if c in df.columns
    ]

    X_raw = df.drop(columns=drop_cols)
    y = df[target_col_final]

    if X_raw.shape[1] == 0:
        raise HTTPException(
            400,
            "No feature columns left after cleaning. Try a different target.",
        )

    test_size = req.test_size if req.test_size is not None else 0.2
    if not 0.1 <= test_size <= 0.5:
        raise HTTPException(400, "test_size must be between 0.1 and 0.5.")

    # Split raw feature data first. Any learned preprocessing now happens
    # strictly inside the training/CV pipeline.
    split_problem = (
        "classification"
        if problem_type == "classification"
        else "regression"
    )
    if split_problem == "classification":
        X_train_raw, X_test_raw, y_train, y_test = train_test_split(
            X_raw,
            y,
            test_size=test_size,
            random_state=42,
            stratify=y,
        )
    else:
        X_train_raw, X_test_raw, y_train, y_test = train_test_split(
            X_raw,
            y,
            test_size=test_size,
            random_state=42,
        )

    # Learn the schema only from training features.
    adaptive_metadata = infer_feature_types(X_train_raw)

    X_train = engineer_adaptive_features(
        X_train_raw,
        adaptive_metadata,
    )
    X_test = engineer_adaptive_features(
        X_test_raw,
        adaptive_metadata,
    )

    # Ensure deterministic feature schema across train/test.
    X_test = X_test.reindex(
        columns=X_train.columns,
        fill_value=np.nan,
    )

    if X_train.shape[1] == 0:
        raise HTTPException(
            400,
            "No usable feature columns remain after adaptive feature engineering.",
        )

    models = build_adaptive_pipelines(
        X_train,
        problem_type,
    )

    cv_results_df = cross_validate_adaptive(
        models,
        X_train,
        y_train,
        problem_type,
    )

    results_df, trained_models = train_adaptive_models(
        models,
        X_train,
        y_train,
        X_test,
        y_test,
        problem_type,
        was_log_transformed=was_log,
    )

    try:
        recommended_name = recommend_adaptive_model(
            results_df,
            trained_models,
            cv_results_df,
            problem_type,
            priority=req.priority,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

    recommended_model = trained_models[recommended_name]

    # Reporting-only outlier summary. It does not influence imputation.
    outlier_df = X_train.copy()
    outlier_df[target_col_final] = y_train
    outlier_summary = check_outliers(
        outlier_df,
        target_col_final,
    )

    session_feature_columns = adaptive_feature_names(recommended_model)
    top_features = rank_top_features(
        recommended_model,
        session_feature_columns,
        plain_feature_cols,
        text_derived_cols,
    )

    adaptive_summary = {
        "numeric_columns": len(adaptive_metadata.get("numeric", [])),
        "categorical_columns": len(adaptive_metadata.get("categorical", [])),
        "datetime_columns": len(adaptive_metadata.get("datetime", [])),
        "text_columns": len(adaptive_metadata.get("text", [])),
        "transformed_numeric_columns": len(
            adaptive_metadata.get("transform_candidates", [])
        ),
        "engineered_feature_columns": int(X_train.shape[1]),
        "model_feature_columns": int(len(session_feature_columns)),
        "categorical_encoding": "One-hot encoding with unseen-category handling",
        "numeric_imputation": "Median + missing-value indicators",
        "date_engineering": "Year, month, day, weekday, quarter, weekend/hour when available",
        "text_engineering": "Character count, word count, and missing-text indicators",
    }

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
    session.tfidf_vectorizer = (
        tfidf_vectorizer if has_text_derived else None
    )
    session.categorical_columns = categorical_columns
    session.adaptive_metadata = adaptive_metadata
    session.adaptive_summary = adaptive_summary
    session.feature_columns = session_feature_columns
    session.scaler = None
    session.trained_models = trained_models
    session.results = results_df.to_dict("records")
    session.cv_results = cv_results_df.to_dict("records")
    session.recommended_model = recommended_name
    session.top_features = top_features
    session.label_classes = label_classes

    return to_jsonable({
        "problem_type": problem_type,
        "target_col": target_col,
        "was_log_transformed": was_log,
        "clean_report": clean_report,
        "outlier_summary": outlier_summary,
        "imbalance_counts": imbalance_counts,
        "results": session.results,
        "cv_results": session.cv_results,
        "recommended_model": recommended_name,
        "warnings": warnings,
        "feature_columns": session.feature_columns,
        "original_feature_info": original_feature_info,
        "top_features": top_features,
        "adaptive_summary": adaptive_summary,
        "test_size": test_size,
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

    importances = get_adaptive_feature_importance(model)
    return {
        "supported": bool(importances),
        "importances": [
            {
                "feature": feature,
                "importance": to_jsonable(score),
            }
            for feature, score in importances
        ],
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
        raise HTTPException(
            404,
            f"No trained model named '{req.model_name}'.",
        )

    full_sample = dict(
        getattr(session, "original_feature_defaults", None) or {}
    )

    user_sample = dict(req.sample)

    case_description = user_sample.pop(
        TEXT_DERIVED_VIRTUAL_NAME,
        None,
    )

    selected_product = user_sample.pop(
        PRODUCT_VIRTUAL_NAME,
        None,
    )

    full_sample.update(user_sample)

    # Support-ticket virtual product field -> one-hot product inputs.
    if selected_product:
        for col in list(full_sample.keys()):
            if str(col).lower().startswith("prod_"):
                full_sample[col] = (
                    1.0
                    if str(col).lower()
                    == f"prod_{str(selected_product).lower()}"
                    else 0.0
                )

    # Support-ticket virtual description field -> the same TF-IDF features
    # created during training.
    if case_description and getattr(session, "tfidf_vectorizer", None) is not None:
        vectorizer = session.tfidf_vectorizer
        vec = vectorizer.transform(
            [str(case_description).lower()]
        )
        tfidf_names = [
            f"tfidf_{word}"
            for word in vectorizer.get_feature_names_out()
        ]

        for name, value in zip(tfidf_names, vec.toarray()[0]):
            full_sample[name] = float(value)

        full_sample["text_negativity_score"] = (
            get_negativity_score(case_description)
        )

    try:
        if getattr(session, "adaptive_metadata", None):
            sample_raw = pd.DataFrame([full_sample])
            sample_features = engineer_adaptive_features(
                sample_raw,
                session.adaptive_metadata,
            )

            result = predict_adaptive_single(
                model,
                sample_features,
                session.problem_type,
                was_log_transformed=session.was_log_transformed,
            )
        else:
            # Backward-compatible fallback for sessions trained before the
            # adaptive engine was introduced.
            sample_df = pd.DataFrame([full_sample])

            cat_cols = [
                c
                for c in (session.categorical_columns or [])
                if c in sample_df.columns
            ]
            if cat_cols:
                sample_df = pd.get_dummies(
                    sample_df,
                    columns=cat_cols,
                )

            sample_df = sample_df.reindex(
                columns=session.feature_columns,
                fill_value=0,
            )
            sample_dict = sample_df.iloc[0].to_dict()

            result = predict_single(
                model,
                session.scaler,
                sample_dict,
                session.feature_columns,
                was_log_transformed=session.was_log_transformed,
            )

    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(400, f"Prediction failed: {e}")

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

@app.post("/api/sessions/{session_id}/ai/chat")
def ai_chat(session_id: str, req: AIChatRequest):
    session = get_session_or_404(session_id)

    try:
        result = analyze_question(session_id, session.df_raw, req.question)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except RuntimeError as e:
        raise HTTPException(500, str(e))
    except Exception as e:
        print(f"AI analyst error: {e}")
        raise HTTPException(500, f"AI analyst request failed: {e}")

    return to_jsonable(result)
