"""
dashboard_stats.py — computes the aggregated analytics the new Dashboard UI
needs (StatCard totals, PriorityChart, StatusBreakdown, RecentActivity,
NeedsAttention, WeeklyVolume) from raw Ericsson ticket data.

The frontend components were built against a simplified schema (statuses:
Open/Closed/Pending/Escalated, priority: high/medium/low) that doesn't
exactly match your real ticket data (multi-word statuses like "In Progress",
4 priority levels including Critical). This module bridges that gap so the
frontend files don't need to change — everything is normalized here.

IMPORTANT CAVEATS (read before trusting the numbers):
  - There's no "date closed" column in this schema, only 'solution target'
    (the SLA deadline). So "avg resolution days" and "SLA compliance %"
    below are PROXIES based on target windows, not actual measured
    resolution times. Once real data includes an actual close timestamp,
    swap that in for a truer number — flagged inline below too.
  - Status values are heuristically bucketed into Open/Closed/Pending/
    Escalated by keyword matching (e.g. "in progress" -> Open). Adjust
    the STATUS_BUCKET_RULES below once you see real status values.
  - "Critical" priority is merged into "high" for the priority chart,
    since the chart component only has 3 bars (high/medium/low).
"""

import pandas as pd
from ericsson_prep import _normalize_columns, _parse_dates

STATUS_BUCKET_RULES = [
    (("closed", "resolved"), "Closed"),
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
        return "high"
    if p == "medium":
        return "medium"
    return "low"


def build_dashboard_summary(df_raw, recent_n=5, attention_n=5):
    """
    Returns a dict shaped exactly to match Dashboard.jsx's expected props:
    { summary, priorityData, statusData, recentCases, attentionCases, volumeData }
    """
    df = _normalize_columns(df_raw)
    df = _parse_dates(df)
    now = pd.Timestamp.now()

    df["_status_bucket"] = df["status"].apply(_bucket_status) if "status" in df.columns else "Open"
    df["_priority_bucket"] = df["priority"].apply(_bucket_priority) if "priority" in df.columns else "low"

    is_closed = df["_status_bucket"] == "Closed"
    is_open = ~is_closed
    is_overdue = is_open & df["solution target"].notna() & (df["solution target"] < now)

    # ---- summary stat cards ----
    total_open = int(is_open.sum())
    total_overdue = int(is_overdue.sum())

    # PROXY: uses SLA window (solution_target - date_open) for closed
    # tickets as a stand-in for actual resolution time, since there's no
    # real "date closed" column yet.
    closed_df = df[is_closed]
    if len(closed_df) > 0 and "solution target" in df.columns:
        resolution_days = (closed_df["solution target"] - closed_df["date open"]).dt.total_seconds() / 86400
        avg_resolution_days = round(resolution_days.mean(), 1) if not resolution_days.empty else 0
    else:
        avg_resolution_days = 0

    # PROXY: % of all tickets not currently overdue (can't measure true
    # compliance without an actual close timestamp).
    total_count = len(df)
    sla_compliance_pct = round(100 * (1 - total_overdue / total_count), 1) if total_count > 0 else 100

    summary = {
        "totalOpen": total_open,
        "totalOverdue": total_overdue,
        "avgResolutionDays": avg_resolution_days,
        "slaCompliancePct": sla_compliance_pct,
    }

    # ---- priority chart: counts by day of week (Mon-Sun) ----
    day_order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    priority_data = []
    if "date open" in df.columns:
        df["_day"] = df["date open"].dt.day_name().str[:3]
        for day in day_order:
            day_df = df[df["_day"] == day]
            priority_data.append({
                "day": day,
                "high": int((day_df["_priority_bucket"] == "high").sum()),
                "medium": int((day_df["_priority_bucket"] == "medium").sum()),
                "low": int((day_df["_priority_bucket"] == "low").sum()),
            })

    # ---- status breakdown pie chart ----
    status_counts = df["_status_bucket"].value_counts()
    status_data = [{"name": name, "value": int(count)} for name, count in status_counts.items()]

    # ---- recent activity: most recently opened tickets ----
    recent_cases = []
    if "date open" in df.columns:
        recent_df = df.sort_values("date open", ascending=False).head(recent_n)
        for _, row in recent_df.iterrows():
            recent_cases.append({
                "caseNumber": str(row.get("case number", "")),
                "subject": str(row.get("subject", "")),
                "contactName": str(row.get("contact name", "")),
                "status": row["_status_bucket"],
                "dateOpen": row["date open"].strftime("%Y-%m-%d") if pd.notna(row["date open"]) else "",
            })

    # ---- needs attention: open tickets closest to / past their deadline ----
    attention_cases = []
    if "solution target" in df.columns:
        open_df = df[is_open & df["solution target"].notna()].copy()
        open_df["_days_until"] = (open_df["solution target"] - now).dt.total_seconds() / 86400
        attention_df = open_df.sort_values("_days_until").head(attention_n)
        for _, row in attention_df.iterrows():
            attention_cases.append({
                "caseNumber": str(row.get("case number", "")),
                "subject": str(row.get("subject", "")),
                "caseOwner": str(row.get("case owner", "")),
                "daysUntilTarget": int(round(row["_days_until"])),
            })

    # ---- weekly volume: opened vs closed per month (last 6 months) ----
    volume_data = []
    if "date open" in df.columns:
        df["_month"] = df["date open"].dt.to_period("M")
        months = sorted(df["_month"].dropna().unique())[-6:]
        for month in months:
            month_df = df[df["_month"] == month]
            volume_data.append({
                "month": month.strftime("%b"),
                "opened": int(len(month_df)),
                # PROXY: counts tickets opened in this month that are
                # currently closed — not necessarily closed IN this month.
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