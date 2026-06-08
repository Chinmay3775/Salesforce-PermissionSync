"""
Report generation service — CSV, Excel, PDF output.
"""

import os
import logging
import uuid
import json
from datetime import datetime
from typing import Dict, Any, List, Optional
import pandas as pd

from app.services.comparison_service import compare_environments, get_drift_report

logger = logging.getLogger(__name__)

BASE_PATH = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
EXPORTS_DIR = os.path.join(BASE_PATH, "exports")

# In-memory report registry
_reports: List[Dict[str, Any]] = []


def generate_report(
    report_type: str,
    format: str = "excel",
    source_env: Optional[str] = None,
    target_env: Optional[str] = None,
    title: Optional[str] = None,
) -> Dict[str, Any]:
    """Generate a report in the specified format."""

    os.makedirs(EXPORTS_DIR, exist_ok=True)
    report_id = str(uuid.uuid4())[:8]
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    if not title:
        title = f"{report_type.title()} Report - {source_env or 'All'} vs {target_env or 'All'}"

    # Get data based on report type
    if report_type == "comparison" and source_env and target_env:
        data = compare_environments(source_env, target_env)
        rows = data.get("details", [])
    elif report_type == "drift" and source_env and target_env:
        data = get_drift_report(source_env, target_env)
        rows = data.get("items", [])
    else:
        # Generate a full comparison across all env pairs
        rows = []
        for src, tgt in [("DEV", "UAT"), ("UAT", "PROD"), ("DEV", "PROD")]:
            result = compare_environments(src, tgt)
            for item in result.get("details", []):
                item["comparison"] = f"{src} vs {tgt}"
                rows.append(item)

    # Flatten for tabular output
    flat_rows = []
    for row in rows:
        flat = {
            "Category": row.get("category", ""),
            "Item": row.get("item", ""),
            "Profile": row.get("profile", ""),
            "Status": row.get("status", ""),
            "Severity": row.get("severity", ""),
            "Source Env": row.get("source_env", source_env or ""),
            "Target Env": row.get("target_env", target_env or ""),
        }
        # Add source/target values
        src = row.get("source", {})
        tgt = row.get("target", {})
        if isinstance(src, dict):
            for k, v in src.items():
                if k not in ["field", "object_name", "apexClass", "tab", "name"]:
                    flat[f"Source_{k}"] = v
        if isinstance(tgt, dict):
            for k, v in tgt.items():
                if k not in ["field", "object_name", "apexClass", "tab", "name"]:
                    flat[f"Target_{k}"] = v
        flat_rows.append(flat)

    df = pd.DataFrame(flat_rows)
    filename = f"{report_type}_{timestamp}_{report_id}"

    if format == "csv":
        filepath = os.path.join(EXPORTS_DIR, f"{filename}.csv")
        df.to_csv(filepath, index=False)
    elif format == "excel":
        filepath = os.path.join(EXPORTS_DIR, f"{filename}.xlsx")
        with pd.ExcelWriter(filepath, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Report")
    elif format == "json":
        filepath = os.path.join(EXPORTS_DIR, f"{filename}.json")
        with open(filepath, "w") as f:
            json.dump({"title": title, "rows": flat_rows}, f, indent=2, default=str)
    else:
        # Default to CSV
        filepath = os.path.join(EXPORTS_DIR, f"{filename}.csv")
        df.to_csv(filepath, index=False)

    file_size = os.path.getsize(filepath) if os.path.exists(filepath) else 0

    report_info = {
        "report_id": report_id,
        "title": title,
        "report_type": report_type,
        "format": format,
        "file_path": filepath,
        "file_name": os.path.basename(filepath),
        "file_size": file_size,
        "generated_at": datetime.utcnow().isoformat(),
        "environments": [e for e in [source_env, target_env] if e],
        "row_count": len(flat_rows),
    }

    _reports.append(report_info)
    logger.info(f"Generated report: {filepath} ({file_size} bytes, {len(flat_rows)} rows)")

    return report_info


def list_reports() -> List[Dict[str, Any]]:
    """List all generated reports."""
    # Also scan exports directory
    if os.path.exists(EXPORTS_DIR):
        existing_ids = {r["report_id"] for r in _reports}
        for fname in os.listdir(EXPORTS_DIR):
            fpath = os.path.join(EXPORTS_DIR, fname)
            if os.path.isfile(fpath):
                rid = fname.split("_")[-1].split(".")[0]
                if rid not in existing_ids:
                    _reports.append({
                        "report_id": rid,
                        "title": fname,
                        "report_type": "unknown",
                        "format": fname.split(".")[-1],
                        "file_path": fpath,
                        "file_name": fname,
                        "file_size": os.path.getsize(fpath),
                        "generated_at": datetime.fromtimestamp(os.path.getmtime(fpath)).isoformat(),
                        "environments": [],
                        "row_count": 0,
                    })

    return sorted(_reports, key=lambda r: r["generated_at"], reverse=True)
