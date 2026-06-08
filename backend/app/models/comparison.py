"""Pydantic models for comparison and drift analysis."""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class DriftSeverity(str, Enum):
    CRITICAL = "Critical"
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class ComparisonStatus(str, Enum):
    MATCH = "Match"
    MISMATCH = "Mismatch"
    MISSING_SOURCE = "Missing in Source"
    MISSING_TARGET = "Missing in Target"
    ADDED = "Added"
    REMOVED = "Removed"
    CHANGED = "Changed"


class FieldComparisonResult(BaseModel):
    """Comparison result for a single field permission."""
    field: str
    source_env: str
    target_env: str
    source: Optional[Dict[str, Any]] = None
    target: Optional[Dict[str, Any]] = None
    status: ComparisonStatus
    severity: DriftSeverity = DriftSeverity.MEDIUM
    category: str = "Field Permission"


class ObjectComparisonResult(BaseModel):
    """Comparison result for object permissions."""
    object_name: str
    source_env: str
    target_env: str
    source: Optional[Dict[str, Any]] = None
    target: Optional[Dict[str, Any]] = None
    status: ComparisonStatus
    severity: DriftSeverity = DriftSeverity.HIGH
    category: str = "Object Permission"


class ComparisonRequest(BaseModel):
    """Request to compare two environments."""
    source_env: str
    target_env: str
    profile_name: Optional[str] = None
    metadata_types: Optional[List[str]] = None


class ComparisonSummary(BaseModel):
    """Summary of comparison results."""
    source_env: str
    target_env: str
    total_compared: int = 0
    matches: int = 0
    mismatches: int = 0
    missing_in_source: int = 0
    missing_in_target: int = 0
    critical_drifts: int = 0
    high_drifts: int = 0
    medium_drifts: int = 0
    low_drifts: int = 0
    compared_at: datetime
    details: List[Dict[str, Any]] = []


class DriftItem(BaseModel):
    """A single drift detection item."""
    id: str
    severity: DriftSeverity
    category: str
    item_name: str
    profile_or_permset: str
    source_env: str
    target_env: str
    source_value: Optional[Any] = None
    target_value: Optional[Any] = None
    description: str
    detected_at: datetime


class DriftReport(BaseModel):
    """Full drift report."""
    report_id: str
    source_env: str
    target_env: str
    total_drifts: int
    critical: int
    high: int
    medium: int
    low: int
    items: List[DriftItem] = []
    generated_at: datetime


class SyncRequest(BaseModel):
    """Request to sync permissions."""
    source_env: str
    target_env: str
    items: List[str] = []
    sync_all: bool = False
    dry_run: bool = True


class SyncResult(BaseModel):
    """Result of a sync operation."""
    sync_id: str
    source_env: str
    target_env: str
    items_synced: int
    items_failed: int
    dry_run: bool
    status: str
    details: List[Dict[str, Any]] = []
    synced_at: datetime
