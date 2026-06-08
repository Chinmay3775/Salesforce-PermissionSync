"""Pydantic models for report generation."""

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ReportFormat(str, Enum):
    CSV = "csv"
    EXCEL = "excel"
    PDF = "pdf"
    JSON = "json"


class ReportType(str, Enum):
    COMPARISON = "comparison"
    DRIFT = "drift"
    AUDIT = "audit"
    SYNC_HISTORY = "sync_history"
    FULL = "full"


class GenerateReportRequest(BaseModel):
    """Request to generate a report."""
    report_type: ReportType
    format: ReportFormat = ReportFormat.EXCEL
    source_env: Optional[str] = None
    target_env: Optional[str] = None
    title: Optional[str] = None


class ReportInfo(BaseModel):
    """Info about a generated report."""
    report_id: str
    title: str
    report_type: ReportType
    format: ReportFormat
    file_path: str
    file_size: int = 0
    generated_at: datetime
    environments: List[str] = []
