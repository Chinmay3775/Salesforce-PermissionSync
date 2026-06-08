"""API routes for environment comparison and drift analysis."""

import logging
from fastapi import APIRouter
from typing import Optional

from app.services.comparison_service import compare_environments, get_drift_report

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/compare-environments")
async def compare(request: dict):
    """Compare metadata between two environments."""
    source_env = request.get("source_env", "DEV")
    target_env = request.get("target_env", "UAT")
    profile_name = request.get("profile_name")

    logger.info(f"Comparing {source_env} vs {target_env}")

    result = compare_environments(source_env, target_env, profile_name)
    return result


@router.get("/drift-report")
async def drift_report(source_env: str = "DEV", target_env: str = "PROD"):
    """Get drift analysis report."""
    report = get_drift_report(source_env, target_env)
    return report


@router.get("/comparison-summary")
async def comparison_summary():
    """Get quick comparison summaries for all environment pairs."""
    from app.api.metadata import _metadata_cache
    
    pairs = [("DEV", "UAT"), ("UAT", "PROD"), ("DEV", "PROD")]
    summaries = []

    for src, tgt in pairs:
        # Only compare if both environments have been fetched
        if src not in _metadata_cache or tgt not in _metadata_cache:
            continue
        try:
            result = compare_environments(src, tgt)
            summaries.append({
                "source_env": src,
                "target_env": tgt,
                "summary": result.get("summary", {}),
                "compared_at": result.get("compared_at"),
            })
        except Exception:
            pass

    return {"comparisons": summaries}
