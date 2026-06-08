"""API routes for permission synchronization."""

import logging
from fastapi import APIRouter

from app.services.sync_service import preview_sync, execute_sync, get_sync_history

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/sync-permissions")
async def sync_permissions(request: dict):
    """Sync permissions between environments."""
    source_env = request.get("source_env", "DEV")
    target_env = request.get("target_env", "UAT")
    items = request.get("items", [])
    sync_all = request.get("sync_all", False)
    dry_run = request.get("dry_run", True)

    logger.info(f"Sync request: {source_env} → {target_env} (dry_run={dry_run})")

    if dry_run:
        result = preview_sync(source_env, target_env, items, sync_all)
    else:
        result = execute_sync(source_env, target_env, items, sync_all)

    return result


@router.get("/sync-history")
async def sync_history():
    """Get sync operation history."""
    history = get_sync_history()
    return {"history": history}
