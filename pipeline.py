"""
pipeline.py — Generalized ML pipeline backend.

Works on any tabular dataset for either classification or regression.
Only the target column and file path are dataset-specific; everything
else (cleaning, encoding, scaling, model choice, evaluation) adapts
automatically based on what's detected in the data.

Typical usage:

    import pandas as pd
    from pipeline import (
        validate_inputs, clean_data, encode_categoricals, check_imbalance,
        encode_target, check_outliers, detect_problem_type, maybe_log_transform,
        split_data, choose_scaler, get_default_models, evaluate_model,
        recommend_model, save_model, load_model, predict_single,
        get_feature_importance,
    )

    df = pd.read_csv("data.csv")
    target_col = "price"

    errors, warnings = validate_inputs(df, target_col)
    if errors:
        raise ValueError(errors)

    problem_type = detect_problem_type(df[target_col])
    df, target_col, was_log_transformed = maybe_log_transform(df, target_col, problem_type)

    df, clean_report = clean_data(df)
    df = encode_categoricals(df, target_col)

    if problem_type == "classification":
        check_imbalance(df, target_col)
        df = encode_target(df, target_col)

    outlier_summary = check_outliers(df, target_col)

    if was_log_transformed:
        X = df.drop(columns=[target_col, target_col.replace("_log", "")])
    else:
        X = df.drop(columns=[target_col])
    y = df[target_col]

    X_train, X_test, y_train, y_test = split_data(X, y)
    scaler = choose_scaler(outlier_summary, total_features=X.shape[1])
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    models = get_default_models(problem_type)
    results_df, trained_models = train_and_evaluate(
        models, X_train_scaled, y_train, X_test_scaled, y_test, problem_type, was_log_transformed
    )

    best_model = recommend_model(results_df, trained_models, problem_type, priority="f1")
    save_model(best_model, scaler, X_train.columns.tolist(), problem_type, was_log_transformed, "model.joblib")
"""

import numpy as np
import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, RobustScaler, StandardScaler
from sklearn.linear_model import LogisticRegression, LinearRegression, Ridge, HuberRegressor
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
# 1. Input validation
# ---------------------------------------------------------------------------

def validate_inputs(df, target_col):
    """
    Checks a dataframe + target column for common problems before any
    processing happens. Returns (errors, warnings) — both lists of strings.

    errors: fatal problems, caller should stop and surface these to the user.
    warnings: non-fatal issues, safe to proceed but worth telling the user.
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
    Intended for a frontend column picker / data preview screen.
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


# ---------------------------------------------------------------------------
# 2. Problem type detection + target transforms
# ---------------------------------------------------------------------------

def detect_problem_type(y):
    """
    Looks at a target series and decides whether this is a classification
    or regression problem. Text targets, or numeric targets with few
    unique values relative to the dataset size, are treated as classification.
    """
    if y.dtype == "object":
        return "classification"
    unique_ratio = y.nunique() / len(y)
    if y.nunique() <= 20 or unique_ratio < 0.05:
        return "classification"
    return "regression"


def maybe_log_transform(df, target_col, problem_type, skew_threshold=1.0):
    """
    For regression targets with meaningful right-skew (e.g. prices),
    applies a log1p transform and returns the new target column name.
    No-ops for classification targets or already-reasonable distributions.

    Returns (df, target_col, was_log_transformed). If was_log_transformed
    is True, predictions must be reversed with np.expm1() before reporting
    them to a user.
    """
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
    """
    Converts a text classification target (e.g. 'M'/'B') into numeric
    labels via LabelEncoder. No-ops if the target is already numeric.
    """
    df_copy = df.copy()
    if not pd.api.types.is_numeric_dtype(df_copy[target_col]):
        le = LabelEncoder()
        df_copy[target_col] = le.fit_transform(df_copy[target_col])
    return df_copy


# ---------------------------------------------------------------------------
# 3. Cleaning + encoding
# ---------------------------------------------------------------------------

def clean_data(df):
    """
    Removes duplicate rows, fully-empty columns, and obvious ID columns.
    Returns (df, report) where report is a dict summarizing what was done —
    safe to return directly to a frontend as JSON.
    """
    report = {"initial_shape": df.shape, "actions_taken": []}

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

    report["final_shape"] = df.shape
    return df, report


def encode_categoricals(df, target_col):
    """
    One-hot encodes every categorical (text) feature column, leaving the
    target column untouched. No-ops if there are no categorical features.
    """
    feature_cols = [col for col in df.columns if col != target_col]
    categorical_feature_cols = df[feature_cols].select_dtypes(include=["object", "str"]).columns.tolist()

    if categorical_feature_cols:
        print(f"One-hot encoding: {categorical_feature_cols}")
        df = pd.get_dummies(df, columns=categorical_feature_cols)
    else:
        print("No categorical features to encode.")

    return df


# ---------------------------------------------------------------------------
# 4. Data quality checks
# ---------------------------------------------------------------------------

def check_imbalance(df, target_col):
    """
    Reports class balance for a classification target and flags severe
    or moderate imbalance. Only meaningful for classification problems.
    """
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
    """
    Flags numeric feature columns with outliers via the IQR method.
    Returns a dict of {column_name: outlier_count}. Used to decide
    whether to use RobustScaler over StandardScaler.
    """
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
    """
    Compares any two columns for a frontend-driven "explore data" screen.
    Returns a dict shaped differently depending on the column types:

      numeric vs numeric   -> {'chart_type': 'scatter', 'correlation': ..., 'data': [...]}
      numeric vs categorical -> {'chart_type': 'boxplot', 'data': [...]}   (grouped stats)
      categorical vs categorical -> {'chart_type': 'crosstab', 'data': {...}}
    """
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
# 5. EDA plots (for local/notebook use — see compare_two_columns for API use)
# ---------------------------------------------------------------------------

def generate_eda_plots(df, target_col, problem_type):
    """
    Renders a correlation heatmap, per-feature distribution histograms,
    and top-feature-vs-target plots. Uses plt.show(), so this is intended
    for notebook/local use — a web frontend should use compare_two_columns()
    and render charts client-side instead.
    """
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
    """
    Train/test split that auto-detects problem type and applies stratified
    sampling for classification (preserves class balance in both splits).
    """
    problem_type = detect_problem_type(y)
    if problem_type == "classification":
        return train_test_split(X, y, test_size=test_size, random_state=42, stratify=y)
    return train_test_split(X, y, test_size=test_size, random_state=42)


def choose_scaler(outlier_summary, total_features):
    """
    Picks RobustScaler when >=30% of features have notable outliers
    (robust to extreme values), otherwise StandardScaler.
    """
    outlier_ratio = len(outlier_summary) / total_features
    if outlier_ratio >= 0.3:
        print(f"Significant outliers detected ({len(outlier_summary)}/{total_features} features) -> using RobustScaler")
        return RobustScaler()
    print("Few outliers detected -> using StandardScaler")
    return StandardScaler()


# ---------------------------------------------------------------------------
# 7. Models
# ---------------------------------------------------------------------------

def get_default_models(problem_type):
    """
    Returns a dict of {model_name: untrained sklearn estimator}, chosen
    based on problem type. Classification models use class_weight='balanced'
    where supported, to handle imbalanced targets automatically.
    """
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
    """
    Computes standard metrics for either problem type:
      classification -> accuracy, precision, recall, f1 (+ optional confusion matrix)
      regression      -> mae, rmse, r2
    Handles both binary and multiclass classification automatically.
    """
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
    """
    Trains every model in `models`, evaluates each on the test set, and
    returns (results_df, trained_models). If was_log_transformed is True,
    predictions and y_test are reversed with expm1() before scoring so
    metrics are reported in the original target scale.
    """
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
    """
    Picks the best model from a results_df based on a chosen metric.
    Defaults to f1 (classification) or r2 (regression) if no priority given.
    Valid priorities:
      classification -> accuracy, precision, recall, f1
      regression      -> mae, rmse, r2   (lower is better for mae/rmse)
    """
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
    """
    Returns a list of (feature_name, importance_score) tuples, sorted
    descending. Works for tree-based models (feature_importances_) and
    linear models (coef_). Returns None if the model type doesn't expose
    either attribute (e.g. SVR/SVC with non-linear kernels).
    """
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
    """
    Bundles a trained model with everything needed to use it correctly
    later: the fitted scaler, the exact feature column order, the problem
    type, and whether predictions need to be un-logged.
    """
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
    """Loads a bundle saved by save_model(). Returns the bundle dict."""
    bundle = joblib.load(filepath)
    print(f"Model loaded from {filepath}")
    return bundle


def predict_single(model, scaler, sample_dict, feature_columns, was_log_transformed=False):
    """
    Predicts on one new sample, given as a dict of {feature_name: value}.
    Applies the same scaling used during training, reverses any log
    transform automatically, and returns a JSON-safe dict:

      {'prediction': float, ['confidence': float, 'class_probabilities': [...]]}

    The confidence/probabilities keys are only present for classifiers
    that support predict_proba.
    """
    sample_df = pd.DataFrame([sample_dict])

    missing_cols = set(feature_columns) - set(sample_df.columns)
    if missing_cols:
        raise ValueError(f"Missing required features: {missing_cols}")

    sample_df = sample_df[feature_columns]
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
