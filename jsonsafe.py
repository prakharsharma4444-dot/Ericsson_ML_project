"""
jsonsafe.py — recursively convert numpy/pandas types into plain
Python types so FastAPI can serialize pipeline.py's return values
(which are full of np.int64, np.float64, NaN, etc.) without choking.
"""

import numpy as np
import pandas as pd


def to_jsonable(obj):
    if isinstance(obj, dict):
        return {_key(k): to_jsonable(v) for k, v in obj.items()}

    if isinstance(obj, (list, tuple, set)):
        return [to_jsonable(v) for v in obj]

    if isinstance(obj, np.integer):
        return int(obj)

    if isinstance(obj, np.floating):
        v = float(obj)
        return None if np.isnan(v) else v

    if isinstance(obj, float):
        return None if np.isnan(obj) else obj

    if isinstance(obj, np.bool_):
        return bool(obj)

    if isinstance(obj, np.ndarray):
        return to_jsonable(obj.tolist())

    if isinstance(obj, (pd.Timestamp,)):
        return str(obj)

    if isinstance(obj, pd.Series):
        return to_jsonable(obj.to_dict())

    return obj


def _key(k):
    """Dict keys must be strings in JSON; numpy scalars need casting first."""
    if isinstance(k, np.integer):
        return str(int(k))
    if isinstance(k, np.floating):
        return str(float(k))
    return str(k)
