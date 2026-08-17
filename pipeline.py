"""
pipeline.py — Generalized ML pipeline backend.

Works on any tabular dataset for either classification or regression.
Only the target column and file path are dataset-specific; everything
else (cleaning, encoding, scaling, model choice, evaluation) adapts
automatically based on what's detected in the data.
"""

import numpy as np
import pandas as pd
import joblib
from sklearn.feature_selection import mutual_info_regression
from sklearn.model_selection import train_test_split, cross_val_score, KFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, RobustScaler, StandardScaler
from sklearn.linear_model import LogisticRegression, Ridge, HuberRegressor
from sklearn.ensemble import (
    RandomForestClassifier,
    RandomForestRegressor,
    GradientBoostingClassifier,
    GradientBoostingRegressor,
)
from sklearn.svm import SVC, SVR
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    mean_absolute_error,
    mean_squared_error,
    r2_score,
)


# ---------------------------------------------------------------------------
# 1. Input validation & Data Extraction
# ---------------------------------------------------------------------------

def validate_inputs(df, target_col):
    """
    Checks a dataframe + target column for common problems before any
    processing happens. Returns (errors, warnings) — both lists of strings.
    """
    errors = []
    warnings = []

    if target_col not in df.columns:
        errors.append(
            f"Target column '{target_col}' not found in dataset. "
            f"Available columns: {list(df.columns)}"
        )
        return errors, warnings

    if len(df) < 20:
        errors.append(
            f"Dataset has only {len(df)} rows — too small for a reliable train/test split."
        )

    if df[target_col].nunique() <= 1:
        errors.append(
            f"Target column '{target_col}' has only {df[target_col].nunique()} "
            f"unique value(s) — nothing to predict."
        )

    feature_cols = [c for c in df.columns if c != target_col]
    if len(feature_cols) == 0:
        errors.append("No feature columns found besides the target column.")

    null_pct = df.isnull().mean() * 100
    mostly_null_cols = null_pct[null_pct > 90].index.tolist()
    if mostly_null_cols:
        warnings.append(
            f"Columns over 90% missing (will likely be dropped): {mostly_null_cols}"
        )

    target_nulls = df[target_col].isnull().sum()
    if target_nulls > 0:
        warnings.append(
            f"Target column has {target_nulls} missing values — "
            f"these rows will need to be dropped before training."
        )

    return errors, warnings


def get_column_info(df):
    """
    Returns a list of dicts describing every column — name, dtype,
    unique value count, a few sample values, and missing count.
    """
    info = []
    for col in df.columns:
        info.append({
            "name": col,
            "dtype": str(df[col].dtype),
            "unique_count": int(df[col].nunique()),
            "sample_values": df[col].dropna().unique()[:3].tolist(),
            "missing_count": int(df[col].isnull().sum()),
        })
    return info


def get_raw_data_table(df, max_rows=None):
    """
    Returns raw tabular data formatted for frontend JSON API responses.
    Replaces NaNs/Infs with None to prevent JSON serialization errors.
    Pass max_rows=None to return all rows.
    """
    data = df.copy().replace({np.nan: None, np.inf: None, -np.inf: None})
    if max_rows is not None:
        data = data.head(max_rows)
    return {
        "total_rows": len(df),
        "columns": list(data.columns),
        "rows": data.to_dict(orient="records"),
    }


# ---------------------------------------------------------------------------
# 2. Problem type detection + target transforms
# ---------------------------------------------------------------------------

def detect_problem_type(y, task_name=None):
    """Detects whether a dataset target requires classification or regression."""
    if task_name == "resolution" or y.name == "resolution_hours":
        return "regression"

    if y.dtype == "object":
        return "classification"

    if pd.api.types.is_float_dtype(y):
        return "regression"

    unique_ratio = y.nunique() / len(y)
    if y.nunique() <= 20 or unique_ratio < 0.05:
        return "classification"

    return "regression"


def maybe_log_transform(df, target_col, problem_type, skew_threshold=1.0):
    """Applies a log1p transform to right-skewed regression targets."""
    if problem_type != "regression" or not pd.api.types.is_numeric_dtype(df[target_col]):
        print(f"Target '{target_col}' is categorical/non-numeric or a classification task. Skipping log transform.")
        return df, target_col, False

    skew = df[target_col].skew()

    if skew > skew_threshold:
        print(f"Target is skewed ({skew:.2f}) -> applying log transform.")
        log_col = f"{target_col}_log"
        df[log_col] = np.log1p(df[target_col])
        return df, log_col, True

    print(f"Target skewness ({skew:.2f}) is acceptable. No log transform needed.")
    return df, target_col, False


def encode_target(df, target_col):
    """Converts a text classification target into numeric labels via LabelEncoder."""
    df_copy = df.copy()
    if not pd.api.types.is_numeric_dtype(df_copy[target_col]):
        le = LabelEncoder()
        df_copy[target_col] = le.fit_transform(df_copy[target_col])
    return df_copy


# ---------------------------------------------------------------------------
# 3. Cleaning + encoding
# ---------------------------------------------------------------------------

def clean_data(df, target_col=None):
    """
    Removes duplicate rows, fully-empty columns, missing target rows, and obvious ID columns.
    Imputes missing values in numeric feature columns (median) so downstream
    models (e.g. Ridge, SVR) that can't natively handle NaNs don't error out.
    Returns (df, report) summarizing operations.
    """
    report = {"initial_shape": df.shape, "actions_taken": []}

    if target_col and target_col in df.columns:
        target_nulls = df[target_col].isnull().sum()
        if target_nulls > 0:
            df = df.dropna(subset=[target_col])
            report["actions_taken"].append(f"Dropped {target_nulls} rows with null target values")

    dup_count = df.duplicated().sum()
    if dup_count > 0:
        df = df.drop_duplicates()
        report["actions_taken"].append(f"Removed {dup_count} duplicate rows")

    empty_cols = df.columns[df.isnull().all()]
    if len(empty_cols) > 0:
        df = df.drop(columns=empty_cols)
        report["actions_taken"].append(f"Dropped empty columns: {list(empty_cols)}")

    id_cols = [col for col in df.columns if col.lower() in ["id", "patient_id", "index"]]
    if id_cols:
        df = df.drop(columns=id_cols)
        report["actions_taken"].append(f"Dropped ID columns: {id_cols}")

    # --- Impute missing values in numeric feature columns ---
    # Models like Ridge and SVR can't handle NaNs natively, so any numeric
    # feature nulls need to be filled before training. Median is used since
    # it's robust to outliers (consistent with the outlier-aware scaler choice below).
    feature_cols = [c for c in df.columns if c != target_col]
    numeric_feature_cols = df[feature_cols].select_dtypes(include=["int64", "float64"]).columns.tolist()
    numeric_nulls = df[numeric_feature_cols].isnull().sum()
    cols_with_nulls = numeric_nulls[numeric_nulls > 0]

    if len(cols_with_nulls) > 0:
        for col in cols_with_nulls.index:
            median_val = df[col].median()
            df[col] = df[col].fillna(median_val)
        report["actions_taken"].append(
            f"Imputed missing values with median for: {cols_with_nulls.to_dict()}"
        )

    report["final_shape"] = df.shape
    return df, report


def encode_categoricals(df, target_col):
    """One-hot encodes categorical feature columns, leaving the target untouched."""
    feature_cols = [col for col in df.columns if col != target_col]
    categorical_feature_cols = df[feature_cols].select_dtypes(include=["object", "str"]).columns.tolist()

    if categorical_feature_cols:
        print(f"One-hot encoding: {categorical_feature_cols}")
        df = pd.get_dummies(df, columns=categorical_feature_cols)
    else:
        print("No categorical features to encode.")

    return df


# ---------------------------------------------------------------------------
# 3b. Generalized feature engineering + selection (Stage 1)
# ---------------------------------------------------------------------------

def add_standard_transforms(df, target_col):
    """
    Adds sqrt and log1p versions of every non-negative numeric feature.
    Lets downstream feature selection decide whether the raw, sqrt, or log
    version of a feature carries the most signal — without needing to know
    in advance whether a relationship is linear, sqrt-shaped, or log-shaped.
    """
    numeric_cols = df.select_dtypes(include=["int64", "float64"]).columns.tolist()
    numeric_cols = [c for c in numeric_cols if c != target_col]

    added_cols = []
    for col in numeric_cols:
        if (df[col] >= 0).all():
            sqrt_col = f"{col}_sqrt"
            log_col = f"{col}_log"
            df[sqrt_col] = np.sqrt(df[col])
            df[log_col] = np.log1p(df[col])
            added_cols.extend([sqrt_col, log_col])

    if added_cols:
        print(f"Added transformed features: {added_cols}")

    return df, added_cols


def select_informative_features(df, target_col, n_permutations=10, random_state=42):
    """
    For each base numeric feature, compares its raw/sqrt/log variants (if
    present) by mutual information with the target and keeps only the
    single best-scoring version -- avoiding redundant, highly correlated
    duplicates. Any feature (or its best variant) below a permutation-based
    noise threshold is dropped entirely.
    """
    numeric_cols = df.select_dtypes(include=["int64", "float64"]).columns.tolist()
    numeric_cols = [c for c in numeric_cols if c != target_col]

    if len(numeric_cols) == 0:
        return df, []

    rng = np.random.RandomState(random_state)

    real_mi = mutual_info_regression(df[numeric_cols], df[target_col], random_state=random_state)
    mi_series = pd.Series(real_mi, index=numeric_cols)

    # More permutations = a more stable noise threshold, less sensitive to luck.
    noise_scores = []
    for _ in range(n_permutations):
        shuffled = df[numeric_cols].apply(lambda col: rng.permutation(col.values))
        noise_scores.append(
            mutual_info_regression(shuffled, df[target_col], random_state=random_state)
        )
    noise_scores = np.array(noise_scores)
    noise_threshold = noise_scores.mean() + 0.5 * noise_scores.std()

    # Group each column with its transformed siblings (e.g. age_years,
    # age_years_sqrt, age_years_log all belong to the "age_years" family).
    families = {}
    for col in numeric_cols:
        base = col
        for suffix in ("_sqrt", "_log"):
            if col.endswith(suffix):
                base = col[: -len(suffix)]
                break
        families.setdefault(base, []).append(col)

    keep_cols = []
    dropped_cols = []
    for base, variants in families.items():
        best_variant = max(variants, key=lambda c: mi_series[c])
        if mi_series[best_variant] > noise_threshold:
            keep_cols.append(best_variant)
            dropped_cols.extend(v for v in variants if v != best_variant)
        else:
            dropped_cols.extend(variants)

    print(f"MI noise threshold: {noise_threshold:.5f}")
    print(f"Keeping {len(keep_cols)} numeric features, dropping {len(dropped_cols)}: {dropped_cols}")

    non_numeric_cols = [c for c in df.columns if c not in numeric_cols and c != target_col]
    df = df[keep_cols + non_numeric_cols + [target_col]]

    return df, dropped_cols


# ---------------------------------------------------------------------------
# 4. Data quality checks
# ---------------------------------------------------------------------------

def check_imbalance(df, target_col):
    """Reports class balance for classification targets."""
    counts = df[target_col].value_counts()
    percentages = df[target_col].value_counts(normalize=True) * 100

    print("Class counts:")
    print(counts)
    print("\nClass percentages:")
    print(percentages.round(2))

    minority_pct = percentages.min()
    if minority_pct < 10:
        print(f"\nSevere imbalance detected (minority class: {minority_pct:.1f}%). Consider resampling or class_weight='balanced'.")
    elif minority_pct < 30:
        print(f"\nMild-to-moderate imbalance (minority class: {minority_pct:.1f}%). Use class_weight='balanced' and check precision/recall, not just accuracy.")
    else:
        print(f"\nClasses are reasonably balanced (minority class: {minority_pct:.1f}%).")

    return counts


def check_outliers(df, target_col):
    """Flags numeric feature columns with outliers via the IQR method."""
    feature_cols = [col for col in df.columns if col != target_col]
    numeric_cols = df[feature_cols].select_dtypes(include=["int64", "float64"]).columns.tolist()

    outlier_summary = {}
    for col in numeric_cols:
        Q1 = df[col].quantile(0.25)
        Q3 = df[col].quantile(0.75)
        IQR = Q3 - Q1
        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 1.5 * IQR
        outliers = df[(df[col] < lower_bound) | (df[col] > upper_bound)]
        if len(outliers) > 0:
            outlier_summary[col] = len(outliers)

    print("Columns with outliers (IQR method):")
    for col, count in sorted(outlier_summary.items(), key=lambda x: -x[1]):
        print(f"  {col}: {count} outliers")

    return outlier_summary


def compare_two_columns(df, col1, col2, max_scatter_points=1000):
    """Comparative summary for two dataset columns."""
    result = {"col1": col1, "col2": col2}

    col1_numeric = pd.api.types.is_numeric_dtype(df[col1])
    col2_numeric = pd.api.types.is_numeric_dtype(df[col2])

    if col1_numeric and col2_numeric:
        result["chart_type"] = "scatter"
        result["correlation"] = float(df[col1].corr(df[col2]))
        sample = df[[col1, col2]].dropna()
        if len(sample) > max_scatter_points:
            sample = sample.sample(max_scatter_points, random_state=42)
        result["data"] = sample.to_dict("records")

    elif col1_numeric != col2_numeric:
        numeric_col = col1 if col1_numeric else col2
        category_col = col2 if col1_numeric else col1
        result["chart_type"] = "boxplot"
        result["data"] = df.groupby(category_col)[numeric_col].describe().reset_index().to_dict("records")

    else:
        result["chart_type"] = "crosstab"
        result["data"] = pd.crosstab(df[col1], df[col2]).to_dict()

    return result


# ---------------------------------------------------------------------------
# 5. EDA plots
# ---------------------------------------------------------------------------

def generate_eda_plots(df, target_col, problem_type):
    """Renders correlation heatmaps and distribution plots for notebook analysis."""
    import matplotlib.pyplot as plt
    import seaborn as sns

    numeric_cols = df.select_dtypes(include=["int64", "float64"]).columns.tolist()
    feature_cols = [c for c in numeric_cols if c != target_col]

    plt.figure(figsize=(10, 8))
    sns.heatmap(df[numeric_cols].corr(), annot=True, fmt=".2f", cmap="coolwarm", center=0)
    plt.title("Correlation Heatmap")
    plt.tight_layout()
    plt.show()

    n_cols = 4
    n_rows = -(-len(feature_cols) // n_cols)
    fig, axes = plt.subplots(n_rows, n_cols, figsize=(16, 3 * n_rows))
    axes = axes.flatten()
    for i, col in enumerate(feature_cols):
        sns.histplot(df[col], kde=True, ax=axes[i])
        axes[i].set_title(col, fontsize=10)
    for j in range(i + 1, len(axes)):
        axes[j].axis("off")
    plt.tight_layout()
    plt.show()

    top_features = df[numeric_cols].corr()[target_col].abs().sort_values(ascending=False).index[1:7]
    fig, axes = plt.subplots(2, 3, figsize=(16, 8))
    axes = axes.flatten()
    for i, col in enumerate(top_features):
        if problem_type == "classification":
            sns.boxplot(x=df[target_col], y=df[col], ax=axes[i])
        else:
            sns.scatterplot(x=df[col], y=df[target_col], alpha=0.5, ax=axes[i])
        axes[i].set_title(f"{col} vs {target_col}", fontsize=10)
    plt.tight_layout()
    plt.show()


# ---------------------------------------------------------------------------
# 6. Split + scale
# ---------------------------------------------------------------------------

def split_data(X, y, test_size=0.2):
    """Train/test split with automated stratified sampling for classification."""
    problem_type = detect_problem_type(y)
    if problem_type == "classification":
        return train_test_split(X, y, test_size=test_size, random_state=42, stratify=y)
    return train_test_split(X, y, test_size=test_size, random_state=42)


def choose_scaler(outlier_summary, total_features):
    """Selects RobustScaler if >=30% of features contain outliers, else StandardScaler."""
    outlier_ratio = len(outlier_summary) / total_features if total_features > 0 else 0
    if outlier_ratio >= 0.3:
        print(f"Significant outliers detected ({len(outlier_summary)}/{total_features} features) -> using RobustScaler")
        return RobustScaler()
    print("Few outliers detected -> using StandardScaler")
    return StandardScaler()


# ---------------------------------------------------------------------------
# 6b. Cross-validation (Stage 2)
# ---------------------------------------------------------------------------

def build_cv_pipelines(models, scaler):
    """
    Wraps each model together with a *fresh clone* of the given scaler type,
    so every CV fold fits its own scaler on that fold's training data only.
    Prevents scaling leakage across folds (fitting on data the fold hasn't
    "seen" yet), the same class of bug as the earlier target-leakage issue.
    """
    from sklearn.base import clone
    return {name: Pipeline([("scaler", clone(scaler)), ("model", model)]) for name, model in models.items()}


def cross_validate_models(models, X, y, problem_type, was_log_transformed=False, cv_folds=5):
    """
    Runs k-fold cross-validation for each model, reporting mean and std R²
    (or accuracy, for classification) across folds -- a more trustworthy
    signal than a single train/test split, especially on smaller datasets
    or when comparing small changes (e.g. feature selection tweaks) where
    a single split's noise can be bigger than the effect being measured.

    Note: `models` should already be wrapped via build_cv_pipelines() so
    scaling happens per-fold, not on the whole dataset beforehand.
    """
    scoring = "r2" if problem_type == "regression" else "accuracy"
    kf = KFold(n_splits=cv_folds, shuffle=True, random_state=42)

    cv_results = []
    for name, pipeline in models.items():
        scores = cross_val_score(pipeline, X, y, cv=kf, scoring=scoring)
        cv_results.append({
            "model": name,
            f"cv_{scoring}_mean": scores.mean(),
            f"cv_{scoring}_std": scores.std(),
        })
        print(f"{name}: CV {scoring} = {scores.mean():.4f} (+/- {scores.std():.4f})")

    return pd.DataFrame(cv_results)


# ---------------------------------------------------------------------------
# 7. Models & Evaluation
# ---------------------------------------------------------------------------

def get_default_models(problem_type):
    """Returns default model set based on problem type."""
    if problem_type == "classification":
        return {
            "Logistic Regression": LogisticRegression(class_weight="balanced", random_state=42),
            "Random Forest": RandomForestClassifier(class_weight="balanced", random_state=42),
            "Gradient Boosting": GradientBoostingClassifier(random_state=42),
            "Support Vector Classifier": SVC(class_weight="balanced", random_state=42, probability=True),
        }
    return {
        "Ridge Regression": Ridge(alpha=1.0),
        "Huber Regression (Robust)": HuberRegressor(max_iter=1000),
        "Support Vector Regressor": SVR(C=1.0, epsilon=0.1),
        "Random Forest (Tuned)": RandomForestRegressor(n_estimators=100, max_depth=5, random_state=42),
        "Gradient Boosting (Tuned)": GradientBoostingRegressor(
            n_estimators=100, learning_rate=0.05, max_depth=3, subsample=0.8, random_state=42
        ),
    }


def evaluate_model(y_test, y_pred, problem_type="classification", show_confusion_matrix=True):
    """Computes standard evaluation metrics."""
    results = {}

    if problem_type == "classification":
        unique_classes = np.unique(y_test)
        is_binary = len(unique_classes) == 2
        avg_method = "binary" if is_binary else "weighted"

        results["accuracy"] = accuracy_score(y_test, y_pred)
        results["precision"] = precision_score(y_test, y_pred, average=avg_method, zero_division=0)
        results["recall"] = recall_score(y_test, y_pred, average=avg_method, zero_division=0)
        results["f1"] = f1_score(y_test, y_pred, average=avg_method, zero_division=0)

        if show_confusion_matrix:
            print("Confusion Matrix:")
            print(confusion_matrix(y_test, y_pred))
    else:
        results["mae"] = mean_absolute_error(y_test, y_pred)
        results["rmse"] = np.sqrt(mean_squared_error(y_test, y_pred))
        results["r2"] = r2_score(y_test, y_pred)

    return results


def train_and_evaluate(models, X_train_scaled, y_train, X_test_scaled, y_test, problem_type, was_log_transformed=False):
    """Trains and evaluates models, reversing log-transformed targets when evaluating."""
    all_results = []
    trained_models = {}

    for name, model in models.items():
        model.fit(X_train_scaled, y_train)
        y_pred = model.predict(X_test_scaled)

        if was_log_transformed:
            y_pred_eval = np.expm1(y_pred)
            y_test_eval = np.expm1(y_test.values if hasattr(y_test, "values") else y_test)
        else:
            y_pred_eval = y_pred
            y_test_eval = y_test

        metrics = evaluate_model(y_test_eval, y_pred_eval, problem_type, show_confusion_matrix=False)
        metrics["model"] = name
        all_results.append(metrics)
        trained_models[name] = model

    results_df = pd.DataFrame(all_results)
    return results_df, trained_models


def recommend_model(results_df, trained_models, problem_type, priority=None):
    """Selects the top-performing model based on priority metric."""
    if priority is None:
        priority = "f1" if problem_type == "classification" else "r2"

    valid_priorities = {
        "classification": ["accuracy", "precision", "recall", "f1"],
        "regression": ["mae", "rmse", "r2"],
    }

    if priority not in valid_priorities[problem_type]:
        raise ValueError(f"For {problem_type}, priority must be one of {valid_priorities[problem_type]}")

    ascending = priority in ["mae", "rmse"]
    best_row = results_df.sort_values(priority, ascending=ascending).iloc[0]
    best_model_name = best_row["model"]

    print(f"Recommended model based on '{priority}': {best_model_name}")
    for col in results_df.columns:
        if col != "model":
            print(f"  {col}: {best_row[col]:.4f}")

    return trained_models[best_model_name]


def get_feature_importance(model, feature_names):
    """Returns sorted feature importances for tree or linear models."""
    if hasattr(model, "feature_importances_"):
        importances = model.feature_importances_
    elif hasattr(model, "coef_"):
        importances = abs(model.coef_).flatten()
    else:
        return None
    return sorted(zip(feature_names, importances), key=lambda x: -x[1])


# ---------------------------------------------------------------------------
# 8. Persistence + prediction
# ---------------------------------------------------------------------------

def save_model(model, scaler, feature_columns, problem_type, was_log_transformed, filepath):
    """Saves model bundle with artifacts necessary for deployment."""
    bundle = {
        "model": model,
        "scaler": scaler,
        "feature_columns": feature_columns,
        "problem_type": problem_type,
        "was_log_transformed": was_log_transformed,
    }
    joblib.dump(bundle, filepath)
    print(f"Model saved to {filepath}")


def load_model(filepath):
    """Loads a saved model bundle."""
    bundle = joblib.load(filepath)
    print(f"Model loaded from {filepath}")
    return bundle


def predict_single(model, scaler, sample_dict, feature_columns, was_log_transformed=False):
    """Executes single-sample inference and aligns unseen or missing feature columns."""
    sample_df = pd.DataFrame([sample_dict])

    # Recreate any sqrt/log engineered columns the pipeline added during
    # training, so the sample lands in the same feature space as the model.
    for col in feature_columns:
        if col in sample_df.columns:
            continue
        if col.endswith("_sqrt"):
            base = col[:-len("_sqrt")]
            if base in sample_df.columns and pd.api.types.is_numeric_dtype(sample_df[base]):
                val = sample_df[base].iloc[0]
                sample_df[col] = np.sqrt(val) if pd.notna(val) and val >= 0 else 0.0
        elif col.endswith("_log"):
            base = col[:-len("_log")]
            if base in sample_df.columns and pd.api.types.is_numeric_dtype(sample_df[base]):
                val = sample_df[base].iloc[0]
                sample_df[col] = np.log1p(val) if pd.notna(val) and val >= 0 else 0.0

    sample_df = pd.get_dummies(sample_df)
    sample_df = sample_df.reindex(columns=feature_columns, fill_value=0)

    sample_scaled = scaler.transform(sample_df)

    prediction = model.predict(sample_scaled)[0]
    if was_log_transformed:
        prediction = np.expm1(prediction)

    result = {"prediction": float(prediction)}

    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(sample_scaled)[0]
        result["confidence"] = float(proba.max())
        result["class_probabilities"] = [float(p) for p in proba]
    return result