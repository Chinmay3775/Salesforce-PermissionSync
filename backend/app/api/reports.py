"""API routes for report generation and management."""

import logging
import os
from fastapi import APIRouter
from fastapi.responses import FileResponse

from app.services.report_service import generate_report, list_reports

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/generate-report")
async def create_report(request: dict):
    """Generate a new report."""
    report_type = request.get("report_type", "comparison")
    format = request.get("format", "excel")
    source_env = request.get("source_env")
    target_env = request.get("target_env")
    title = request.get("title")

    report = generate_report(
        report_type=report_type,
        format=format,
        source_env=source_env,
        target_env=target_env,
        title=title,
    )

    return {"status": "success", "report": report}


@router.get("/reports")
async def get_reports():
    """List all generated reports."""
    reports = list_reports()
    return {"reports": reports}


@router.get("/reports/download/{report_id}")
async def download_report(report_id: str):
    """Download a specific report file."""
    reports = list_reports()
    report = next((r for r in reports if r["report_id"] == report_id), None)

    if not report:
        return {"status": "error", "message": "Report not found"}

    filepath = report.get("file_path", "")
    if os.path.exists(filepath):
        return FileResponse(
            filepath,
            filename=report.get("file_name", "report"),
            media_type="application/octet-stream",
        )

    return {"status": "error", "message": "Report file not found"}
