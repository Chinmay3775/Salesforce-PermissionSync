"""API routes for action application and sync history."""

import logging
from fastapi import APIRouter

from app.services.sync_service import apply_approved_actions, get_action_history

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/apply-actions")
async def apply_actions(request: dict):
    """Apply approved actions directly to the target environment."""
    target_env = request.get("target_env", "UAT")
    approved_actions = request.get("approved_actions", [])

    logger.info(f"Applying {len(approved_actions)} actions to {target_env}")

    result = apply_approved_actions(target_env, approved_actions)
    return result


@router.get("/action-history")
async def action_history():
    """Get history of applied actions."""
    history = get_action_history()
    return {"history": history}
