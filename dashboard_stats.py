"""
dashboard_stats.py — computes the aggregated analytics needed by Dashboard.jsx
from raw Ericsson ticket data.
"""

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


def _extract_raw_case_info(row):
    """Helper to extract clean raw data fields for the frontend case detail modal."""
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


def filter_support_tickets(df: pd.DataFrame, filters: dict) -> pd.DataFrame:
    """
    Applies global dashboard filters to the master ticket DataFrame.
    """
    filtered_df = df.copy()
    
    # Date range filter
    if filters.get('start_date') and filters.get('end_date'):
        filtered_df['created_at'] = pd.to_datetime(filtered_df['created_at'])
        start = pd.to_datetime(filters['start_date'])
        end = pd.to_datetime(filters['end_date'])
        filtered_df = filtered_df[(filtered_df['created_at'] >= start) & (filtered_df['created_at'] <= end)]
    
    # Severity filter
    if filters.get('severity'):
        filtered_df = filtered_df[filtered_df['severity'].isin(filters['severity'])]

    # Region filter
    if filters.get('region'):
        filtered_df = filtered_df[filtered_df['region'].isin(filters['region'])]

    # Team Assignment filter
    if filters.get('team'):
        filtered_df = filtered_df[filtered_df['team'].isin(filters['team'])]

    return filtered_df


def build_dashboard_summary(df_raw, recent_n=5, attention_n=5):
    """
    Returns a dict shaped exactly to match Dashboard.jsx's expected props:
    { summary, priorityData, statusData, recentCases, attentionCases, volumeData }
    """
    df = _normalize_columns(df_raw)
    df = _parse_dates(df)
    
    # Reference date from dataset max or current time fallback
    if "date open" in df.columns and not df["date open"].dropna().empty:
        dataset_max_date = df["date open"].max()
    else:
        dataset_max_date = pd.Timestamp.now()

    df["_status_bucket"] = df["status"].apply(_bucket_status) if "status" in df.columns else "Open"
    df["_priority_bucket"] = df["priority"].apply(_bucket_priority) if "priority" in df.columns else "Low"

    is_closed = df["_status_bucket"] == "Closed"
    is_open = ~is_closed
    is_overdue = is_open & df["solution target"].notna() & (df["solution target"] < dataset_max_date)

    # ---- 1. Summary Stat Cards ----
    total_open = int(is_open.sum())
    total_overdue = int(is_overdue.sum())

    closed_df = df[is_closed]
    if len(closed_df) > 0 and "solution target" in df.columns and "date open" in df.columns:
        resolution_hours = (closed_df["solution target"] - closed_df["date open"]).dt.total_seconds() / 3600
        avg_resolution_hours = round(float(resolution_hours.mean()), 1) if not resolution_hours.empty else 0.0
    else:
        avg_resolution_hours = 0.0

    total_count = len(df)
    sla_compliance_pct = round(100.0 * (1.0 - total_overdue / total_count), 1) if total_count > 0 else 100.0

    summary = {
        "openCases": total_open,
        "overdueCases": total_overdue,
        "avgResolutionHours": avg_resolution_hours,
        "slaCompliancePct": sla_compliance_pct,
        "openCasesTrend": 0,
        "overdueCasesTrend": 0,
        "avgResolutionTrend": 0.0,
        "slaComplianceTrend": 0,
    }

    # ---- 2. Status Breakdown (Bar Chart: Day vs volume) ----
    day_order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    status_data = []
    if "date open" in df.columns and not df["date open"].dropna().empty:
        df["_day"] = df["date open"].dt.day_name().str[:3]
        one_week_ago = dataset_max_date - pd.Timedelta(days=7)
        two_weeks_ago = dataset_max_date - pd.Timedelta(days=14)

        this_week_df = df[df["date open"] >= one_week_ago]
        last_week_df = df[(df["date open"] >= two_weeks_ago) & (df["date open"] < one_week_ago)]

        this_counts = this_week_df["_day"].value_counts().to_dict() if not this_week_df.empty else df["_day"].value_counts().to_dict()
        last_counts = last_week_df["_day"].value_counts().to_dict() if not last_week_df.empty else {}

        for day in day_order:
            status_data.append({
                "day": day,
                "thisWeek": int(this_counts.get(day, 0)),
                "lastWeek": int(last_counts.get(day, 0)),
            })
    else:
        for day in day_order:
            status_data.append({"day": day, "thisWeek": 0, "lastWeek": 0})

    # ---- 3. Priority Distribution (Pie Chart) ----
    priority_data = [
        {"name": "Overdue", "value": total_overdue},
        {"name": "Pending", "value": int((df["_status_bucket"] == "Pending").sum())},
        {"name": "Closed", "value": int(is_closed.sum())},
        {"name": "Open", "value": int((df["_status_bucket"] == "Open").sum())},
    ]

    # ---- 4. Recent Activity (Filtered to n-1 date relative to dataset) ----
    recent_cases = []
    if "date open" in df.columns and not df["date open"].dropna().empty:
        n_minus_1_date = dataset_max_date - pd.Timedelta(days=1)
        recent_df = df[df["date open"] <= n_minus_1_date].sort_values("date open", ascending=False).head(recent_n)
        
        if recent_df.empty:
            recent_df = df.sort_values("date open", ascending=False).head(recent_n)

        for _, row in recent_df.iterrows():
            c_info = _extract_raw_case_info(row)
            c_info["lastUpdated"] = row["date open"].strftime("%Y-%m-%d") if pd.notna(row["date open"]) else "N/A"
            recent_cases.append(c_info)

    # ---- 5. Needs Attention (Excludes Finished/Closed Cases) ----
    attention_cases = []
    if "solution target" in df.columns:
        open_df = df[is_open & df["solution target"].notna()].copy()
        open_df["_days_until"] = (open_df["solution target"] - dataset_max_date).dt.total_seconds() / 86400.0
        attention_df = open_df.sort_values("_days_until").head(attention_n)
        
        for _, row in attention_df.iterrows():
            days_until = int(round(row["_days_until"]))
            if days_until < 0:
                issue_str = f"Overdue by {abs(days_until)}d"
            elif days_until == 0:
                issue_str = "SLA Target due today"
            else:
                issue_str = f"SLA Target in {days_until}d"

            c_info = _extract_raw_case_info(row)
            c_info["issue"] = issue_str
            attention_cases.append(c_info)

    # ---- 6. Monthly Volume ----
    volume_data = []
    if "date open" in df.columns and not df["date open"].dropna().empty:
        df["_month"] = df["date open"].dt.to_period("M")
        months = sorted(df["_month"].dropna().unique())[-6:]
        for month in months:
            month_df = df[df["_month"] == month]
            volume_data.append({
                "month": month.strftime("%b"),
                "opened": int(len(month_df)),
                "closed": int((month_df["_status_bucket"] == "Closed").sum()),
            })

    return {
        "summary": summary,
        "priorityData": priority_data,
        "statusData": status_data,
        "recentCases": recent_cases,
        "attentionCases": attention_cases,
        "volumeData": volume_data,
    }