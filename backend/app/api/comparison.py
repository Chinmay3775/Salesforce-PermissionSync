"""API routes for component permission comparison."""

import logging
from fastapi import APIRouter, HTTPException
from typing import List, Dict

from app.services.comparison_service import compare_components

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/compare-components")
async def compare(request: dict):
    """Compare metadata for specific components between two environments."""
    source_env = request.get("source_env", "DEV")
    target_env = request.get("target_env", "UAT")
    deployment_components = request.get("deployment_components", [])

    if not deployment_components:
        raise HTTPException(status_code=400, detail="deployment_components cannot be empty")

    logger.info(f"Comparing {len(deployment_components)} components: {source_env} vs {target_env}")

    try:
        result = compare_components(source_env, target_env, deployment_components)
        return result
    except Exception as e:
        logger.error(f"Comparison failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
