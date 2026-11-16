"""
adaptive_pipeline.py — schema-aware ML engine for SupportIQ.

The engine adapts preprocessing and model candidates to the active tabular
dataset instead of assuming that every dataset has the same structure.

Adaptive behavior:
- numeric columns -> median imputation + missing indicators + scaling
- categorical columns -> explicit missing category + one-hot encoding
- date/time columns -> calendar features
- text-heavy columns -> text length / word-count / missingness features
- skewed non-negative numeric columns -> optional sqrt/log1p variants
- model family -> selected for classification vs regression
- cross-validation -> runs the full preprocessing + model pipeline per fold
"""

from copy import deepcopy

import numpy as np
import pandas as pd

from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import (
    ExtraTreesClassifier,
    ExtraTreesRegressor,
    GradientBoostingClassifier,
    GradientBoostingRegressor,
    HistGradientBoostingClassifier,
    HistGradientBoostingRegressor,
    RandomForestClassifier,
    RandomForestRegressor,
)
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    recall_score,
    r2_score,
)
from sklearn.model_selection import KFold, StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, RobustScaler, StandardScaler


DATE_NAME_HINTS = (
    "date",
    "time",
    "timestamp",
    "opened",
    "created",
    "updated",
    "closed",
)

TEXT_NAME_HINTS = (
    "description",
    "desc",
    "subject",
    "comment",
    "comments",
    "message",
    "notes",
    "note",
    "text",
    "summary",
)

ID_NAME_HINTS = (
    "id",
    "index",
    "uuid",
    "identifier",
)


def clean_adaptive_data(df, target_col):
    """
    Structural cleaning only.

    Learned imputations are deliberately NOT performed here. They belong
    inside the sklearn preprocessing pipeline so they are fitted on the
    training folds only and cannot leak test-set information.
    """
    work = df.copy()
    report = {
        "initial_shape": [int(work.shape[0]), int(work.shape[1])],
        "actions_taken": [],
    }

    if target_col in work.columns:
        missing_target = int(work[target_col].isna().sum())
        if missing_target:
            work = work.dropna(subset=[target_col]).copy()
            report["actions_taken"].append(
                f"Dropped {missing_target} rows with missing target values."
            )

    duplicates = int(work.duplicated().sum())
    if duplicates:
        work = work.drop_duplicates().copy()
        report["actions_taken"].append(
            f"Removed {duplicates} duplicate rows."
        )

    empty_cols = [str(c) for c in work.columns if work[c].isna().all()]
    if empty_cols:
        work = work.drop(columns=empty_cols).copy()
        report["actions_taken"].append(
            f"Dropped fully empty columns: {empty_cols}"
        )

    id_cols = []
    for col in work.columns:
        if col == target_col:
            continue
        name = str(col).strip().lower()
        if (
            name in ID_NAME_HINTS
            or name.endswith("_id")
            or name.endswith(" id")
            or name.endswith("_uuid")
        ):
            id_cols.append(col)

    if id_cols:
        work = work.drop(columns=id_cols).copy()
        report["actions_taken"].append(
            f"Dropped identifier-like columns: {[str(c) for c in id_cols]}"
        )

    report["final_shape"] = [int(work.shape[0]), int(work.shape[1])]
    return work, report


def _looks_like_datetime(series, column_name):
    if pd.api.types.is_datetime64_any_dtype(series):
        return True

    if not (
        pd.api.types.is_object_dtype(series)
        or pd.api.types.is_string_dtype(series)
    ):
        return False

    values = series.dropna().astype(str).str.strip()
    if values.empty:
        return False

    name = str(column_name).lower()
    name_hint = any(token in name for token in DATE_NAME_HINTS)

    # Avoid interpreting ordinary numeric-looking strings as timestamps.
    if values.str.fullmatch(r"[-+]?\d+(\.\d+)?").all():
        return False

    parsed = pd.to_datetime(values, errors="coerce")
    ratio = float(parsed.notna().mean())

    if name_hint:
        return ratio >= 0.70

    # Be conservative for columns whose names do not suggest dates.
    return ratio >= 0.95 and values.nunique() >= min(10, max(3, len(values) // 20))


def infer_feature_types(df):
    """
    Classifies columns without using the target.

    Returns metadata used again during inference so training and prediction
    perform identical deterministic feature engineering.
    """
    numeric = []
    categorical = []
    datetime_cols = []
    text_cols = []
    transform_candidates = []

    for col in df.columns:
        series = df[col]

        if pd.api.types.is_bool_dtype(series):
            categorical.append(col)
            continue

        if pd.api.types.is_numeric_dtype(series):
            numeric.append(col)
            non_null = pd.to_numeric(series, errors="coerce").dropna()
            if (
                len(non_null) > 0
                and non_null.nunique() >= 5
                and float(non_null.min()) >= 0
                and not str(col).lower().startswith(("tfidf_", "prod_"))
            ):
                skew = float(non_null.skew()) if non_null.nunique() > 2 else 0.0
                if np.isfinite(skew) and abs(skew) > 1.0:
                    transform_candidates.append(col)
            continue

        if _looks_like_datetime(series, col):
            datetime_cols.append(col)
            continue

        values = series.dropna().astype(str)
        avg_len = float(values.str.len().mean()) if not values.empty else 0.0
        unique_ratio = (
            float(values.nunique() / len(values))
            if len(values)
            else 0.0
        )
        name_hint = any(token in str(col).lower() for token in TEXT_NAME_HINTS)

        if name_hint or (avg_len >= 35 and unique_ratio >= 0.15):
            text_cols.append(col)
        else:
            categorical.append(col)

    return {
        "numeric": [str(c) for c in numeric],
        "categorical": [str(c) for c in categorical],
        "datetime": [str(c) for c in datetime_cols],
        "text": [str(c) for c in text_cols],
        "transform_candidates": [str(c) for c in transform_candidates[:40]],
    }


def engineer_adaptive_features(df, metadata):
    """
    Applies deterministic, target-independent feature engineering.

    This function is run separately on train/test/inference data using the
    metadata learned from the training feature schema.
    """
    work = df.copy()

    datetime_cols = [c for c in metadata.get("datetime", []) if c in work.columns]
    for col in datetime_cols:
        parsed = pd.to_datetime(work[col], errors="coerce")
        prefix = f"{col}__"
        work[f"{prefix}year"] = parsed.dt.year
        work[f"{prefix}month"] = parsed.dt.month
        work[f"{prefix}day"] = parsed.dt.day
        work[f"{prefix}dayofweek"] = parsed.dt.dayofweek
        work[f"{prefix}quarter"] = parsed.dt.quarter
        work[f"{prefix}is_weekend"] = parsed.dt.dayofweek.isin([5, 6]).astype(int)
        if (parsed.dt.hour != 0).any():
            work[f"{prefix}hour"] = parsed.dt.hour
        work = work.drop(columns=[col])

    text_cols = [c for c in metadata.get("text", []) if c in work.columns]
    for col in text_cols:
        values = work[col].fillna("").astype(str)
        prefix = f"{col}__"
        work[f"{prefix}char_len"] = values.str.len().astype(float)
        work[f"{prefix}word_count"] = values.str.split().str.len().astype(float)
        work[f"{prefix}missing"] = values.eq("").astype(int)
        work = work.drop(columns=[col])

    for col in metadata.get("transform_candidates", []):
        if col not in work.columns:
            continue
        values = pd.to_numeric(work[col], errors="coerce")
        safe = values.clip(lower=0)
        work[f"{col}__sqrt"] = np.sqrt(safe)
        work[f"{col}__log"] = np.log1p(safe)

    return work


def _count_outlier_features(X):
    numeric = X.select_dtypes(include=np.number)
    summary = {}

    for col in numeric.columns:
        series = numeric[col].dropna()
        if len(series) < 5 or series.nunique() < 2:
            continue

        q1 = float(series.quantile(0.25))
        q3 = float(series.quantile(0.75))
        iqr = q3 - q1
        if iqr <= 0:
            continue

        low = q1 - 1.5 * iqr
        high = q3 + 1.5 * iqr
        count = int(((series < low) | (series > high)).sum())

        if count > 0:
            summary[str(col)] = count

    return summary


def _choose_numeric_scaler(X):
    numeric_count = len(X.select_dtypes(include=np.number).columns)
    if numeric_count == 0:
        return StandardScaler()

    outliers = _count_outlier_features(X)
    ratio = len(outliers) / numeric_count

    if ratio >= 0.30:
        return RobustScaler()
    return StandardScaler()


def build_adaptive_preprocessor(X_train):
    """
    Builds a schema-aware ColumnTransformer.

    Missing-value handling and category learning happen INSIDE the
    transformer so every CV fold learns preprocessing independently.
    """
    numeric_cols = X_train.select_dtypes(include=np.number).columns.tolist()
    categorical_cols = [
        c
        for c in X_train.columns
        if c not in numeric_cols
    ]

    scaler = _choose_numeric_scaler(X_train)

    numeric_pipeline = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(
                    strategy="median",
                    add_indicator=True,
                ),
            ),
            ("scaler", scaler),
        ]
    )

    categorical_pipeline = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(
                    strategy="constant",
                    fill_value="__MISSING__",
                ),
            ),
            (
                "onehot",
                OneHotEncoder(
                    handle_unknown="ignore",
                    min_frequency=2,
                    max_categories=50,
                    sparse_output=False,
                ),
            ),
        ]
    )

    transformers = []
    if numeric_cols:
        transformers.append(("numeric", numeric_pipeline, numeric_cols))
    if categorical_cols:
        transformers.append(("categorical", categorical_pipeline, categorical_cols))

    preprocessor = ColumnTransformer(
        transformers=transformers,
        remainder="drop",
        verbose_feature_names_out=False,
    )

    return preprocessor


def get_adaptive_models(problem_type):
    if problem_type == "classification":
        return {
            "Logistic Regression": LogisticRegression(
                max_iter=2500,
                class_weight="balanced",
                random_state=42,
            ),
            "Extra Trees": ExtraTreesClassifier(
                n_estimators=300,
                min_samples_leaf=2,
                class_weight="balanced",
                random_state=42,
                n_jobs=-1,
            ),
            "Random Forest": RandomForestClassifier(
                n_estimators=300,
                min_samples_leaf=2,
                class_weight="balanced",
                random_state=42,
                n_jobs=-1,
            ),
            "Gradient Boosting": GradientBoostingClassifier(
                n_estimators=180,
                learning_rate=0.05,
                max_depth=3,
                random_state=42,
            ),
            "Histogram Gradient Boosting": HistGradientBoostingClassifier(
                max_iter=220,
                learning_rate=0.06,
                max_leaf_nodes=31,
                l2_regularization=0.5,
                random_state=42,
            ),
        }

    return {
        "Ridge Regression": Ridge(alpha=1.0),
        "Extra Trees Regressor": ExtraTreesRegressor(
            n_estimators=300,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1,
        ),
        "Random Forest Regressor": RandomForestRegressor(
            n_estimators=300,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1,
        ),
        "Gradient Boosting Regressor": GradientBoostingRegressor(
            n_estimators=180,
            learning_rate=0.05,
            max_depth=3,
            subsample=0.9,
            random_state=42,
        ),
        "Histogram Gradient Boosting Regressor": HistGradientBoostingRegressor(
            max_iter=220,
            learning_rate=0.06,
            max_leaf_nodes=31,
            l2_regularization=0.5,
            random_state=42,
        ),
    }


def build_adaptive_pipelines(X_train, problem_type):
    preprocessor = build_adaptive_preprocessor(X_train)
    estimators = get_adaptive_models(problem_type)

    pipelines = {}
    for name, estimator in estimators.items():
        pipelines[name] = Pipeline(
            steps=[
                ("preprocessor", clone(preprocessor)),
                ("model", estimator),
            ]
        )

    return pipelines


def _cv_splitter(problem_type, y):
    if problem_type == "classification":
        counts = pd.Series(y).value_counts()
        min_class = int(counts.min()) if not counts.empty else 2
        folds = max(2, min(5, min_class))
        return StratifiedKFold(
            n_splits=folds,
            shuffle=True,
            random_state=42,
        )

    return KFold(
        n_splits=5,
        shuffle=True,
        random_state=42,
    )


def cross_validate_adaptive(models, X_train, y_train, problem_type):
    scoring = "f1_macro" if problem_type == "classification" else "r2"
    cv = _cv_splitter(problem_type, y_train)

    rows = []
    for name, pipeline in models.items():
        scores = cross_val_score(
            clone(pipeline),
            X_train,
            y_train,
            cv=cv,
            scoring=scoring,
            n_jobs=None,
        )
        rows.append(
            {
                "model": name,
                f"cv_{scoring}_mean": float(scores.mean()),
                f"cv_{scoring}_std": float(scores.std()),
            }
        )

    return pd.DataFrame(rows)


def _evaluate(y_true, y_pred, problem_type):
    if problem_type == "classification":
        return {
            "accuracy": float(accuracy_score(y_true, y_pred)),
            "balanced_accuracy": float(
                balanced_accuracy_score(y_true, y_pred)
            ),
            "precision": float(
                precision_score(
                    y_true,
                    y_pred,
                    average="weighted",
                    zero_division=0,
                )
            ),
            "recall": float(
                recall_score(
                    y_true,
                    y_pred,
                    average="weighted",
                    zero_division=0,
                )
            ),
            "f1": float(
                f1_score(
                    y_true,
                    y_pred,
                    average="weighted",
                    zero_division=0,
                )
            ),
            "f1_macro": float(
                f1_score(
                    y_true,
                    y_pred,
                    average="macro",
                    zero_division=0,
                )
            ),
        }

    return {
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "r2": float(r2_score(y_true, y_pred)),
    }


def train_adaptive_models(
    models,
    X_train,
    y_train,
    X_test,
    y_test,
    problem_type,
    was_log_transformed=False,
):
    results = []
    trained = {}

    for name, pipeline in models.items():
        model = clone(pipeline)
        model.fit(X_train, y_train)
        predictions = model.predict(X_test)

        if was_log_transformed:
            eval_pred = np.expm1(predictions)
            eval_true = np.expm1(np.asarray(y_test))
        else:
            eval_pred = predictions
            eval_true = y_test

        metrics = _evaluate(eval_true, eval_pred, problem_type)
        metrics["model"] = name
        results.append(metrics)
        trained[name] = model

    return pd.DataFrame(results), trained


def recommend_adaptive_model(
    results_df,
    trained_models,
    cv_results_df,
    problem_type,
    priority=None,
):
    if priority:
        valid = (
            {"accuracy", "balanced_accuracy", "precision", "recall", "f1", "f1_macro"}
            if problem_type == "classification"
            else {"mae", "rmse", "r2"}
        )
        if priority not in valid:
            raise ValueError(
                f"For {problem_type}, priority must be one of {sorted(valid)}"
            )

        ascending = priority in {"mae", "rmse"}
        row = results_df.sort_values(priority, ascending=ascending).iloc[0]
        return row["model"]

    metric = "cv_f1_macro_mean" if problem_type == "classification" else "cv_r2_mean"
    if cv_results_df is not None and not cv_results_df.empty:
        row = cv_results_df.sort_values(metric, ascending=False).iloc[0]
        return row["model"]

    row = results_df.sort_values(
        "f1_macro" if problem_type == "classification" else "r2",
        ascending=False,
    ).iloc[0]
    return row["model"]


def adaptive_feature_names(model):
    """
    Returns post-preprocessing feature names for reporting / feature importance.
    """
    if isinstance(model, Pipeline):
        preprocessor = model.named_steps.get("preprocessor")
        if preprocessor is not None:
            try:
                return list(preprocessor.get_feature_names_out())
            except Exception:
                return []

    return []


def get_adaptive_feature_importance(model):
    """
    Extracts feature importance from the final estimator and maps it back to
    post-preprocessing feature names.
    """
    estimator = model
    if isinstance(model, Pipeline):
        estimator = model.named_steps.get("model", model)

    feature_names = adaptive_feature_names(model)

    if hasattr(estimator, "feature_importances_"):
        values = np.asarray(estimator.feature_importances_, dtype=float)
    elif hasattr(estimator, "coef_"):
        coef = np.asarray(estimator.coef_, dtype=float)
        if coef.ndim == 1:
            values = np.abs(coef)
        else:
            values = np.mean(np.abs(coef), axis=0)
    else:
        return []

    if len(feature_names) != len(values):
        feature_names = [f"feature_{i+1}" for i in range(len(values))]

    pairs = [
        (str(name), float(value))
        for name, value in zip(feature_names, values)
    ]
    return sorted(pairs, key=lambda item: item[1], reverse=True)


def predict_adaptive_single(
    model,
    sample_features,
    problem_type,
    was_log_transformed=False,
):
    sample_df = sample_features.copy()
    prediction = model.predict(sample_df)[0]

    if was_log_transformed:
        prediction = np.expm1(prediction)

    result = {"prediction": float(prediction)}

    estimator = model.named_steps.get("model", model)
    if problem_type == "classification" and hasattr(estimator, "predict_proba"):
        probabilities = estimator.predict_proba(sample_df)[0]
        result["confidence"] = float(np.max(probabilities))
        result["class_probabilities"] = [float(p) for p in probabilities]

    return result
