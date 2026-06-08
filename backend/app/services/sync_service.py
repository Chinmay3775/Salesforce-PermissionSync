"""
Sync service — permission synchronization between environments.
"""

import logging
import uuid
from datetime import datetime
from typing import Dict, List, Any, Optional



logger = logging.getLogger(__name__)

# In-memory sync history
_sync_history: List[Dict[str, Any]] = []


def preview_sync(
    source_env: str,
    target_env: str,
    items: List[str] = None,
    sync_all: bool = False,
) -> Dict[str, Any]:
    """Preview what would be synced (dry run)."""
    from app.services.comparison_service import compare_environments

    comparison = compare_environments(source_env, target_env)
    drifts = [d for d in comparison.get("details", []) if d.get("status") != "Match"]

    if not sync_all and items:
        drifts = [d for d in drifts if d.get("id") in items or d.get("item") in items]

    preview_items = []
    for drift in drifts:
        preview_items.append({
            "id": drift.get("id", str(uuid.uuid4())[:8]),
            "category": drift.get("category"),
            "item": drift.get("item"),
            "profile": drift.get("profile"),
            "current_value": drift.get("target"),
            "new_value": drift.get("source"),
            "status": drift.get("status"),
            "severity": drift.get("severity"),
            "action": "Update" if drift.get("status") == "Mismatch" else "Add",
        })

    return {
        "sync_id": str(uuid.uuid4())[:8],
        "source_env": source_env,
        "target_env": target_env,
        "dry_run": True,
        "total_items": len(preview_items),
        "items": preview_items,
        "estimated_time": f"{len(preview_items) * 2}s",
        "warnings": _generate_warnings(preview_items),
    }


def execute_sync(
    source_env: str,
    target_env: str,
    items: List[str] = None,
    sync_all: bool = False,
) -> Dict[str, Any]:
    """Execute sync operation."""

    preview = preview_sync(source_env, target_env, items, sync_all)

    # Simulate sync execution
    synced_items = []
    failed_items = []

    for item in preview["items"]:
        if hash(item["item"]) % 20 != 0:
            item["sync_status"] = "Success"
            synced_items.append(item)
        else:
            item["sync_status"] = "Failed"
            item["error"] = "Insufficient permissions to modify target org"
            failed_items.append(item)

    result = {
        "sync_id": preview["sync_id"],
        "source_env": source_env,
        "target_env": target_env,
        "dry_run": False,
        "items_synced": len(synced_items),
        "items_failed": len(failed_items),
        "status": "Completed" if not failed_items else "Completed with Errors",
        "details": synced_items + failed_items,
        "synced_at": datetime.utcnow().isoformat(),
    }

    _sync_history.append(result)
    logger.info(f"Sync completed: {source_env} → {target_env}, {len(synced_items)} synced, {len(failed_items)} failed")

    return result


def get_sync_history() -> List[Dict[str, Any]]:
    """Get sync operation history."""
    if not _sync_history:
        return []
    return sorted(_sync_history, key=lambda s: s["synced_at"], reverse=True)


def _generate_warnings(items: List[Dict]) -> List[str]:
    """Generate warnings for sync preview."""
    warnings = []
    critical = [i for i in items if i.get("severity") == "Critical"]
    if critical:
        warnings.append(f"⚠️ {len(critical)} critical items will be modified")

    prod_items = [i for i in items if "PROD" in str(i)]
    if prod_items:
        warnings.append("⚠️ Changes will affect PRODUCTION environment")

    if len(items) > 50:
        warnings.append(f"⚠️ Large sync operation: {len(items)} items")

    return warnings
