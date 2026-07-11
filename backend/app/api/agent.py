"""API routes for Deployment-Based Permission Agent."""

import logging
from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any

from app.services.agent_service import run_agent, process_approval

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/agent/run")
async def execute_agent(request: dict):
    """
    Run the agent to parse components, compare, and generate an action plan.

    Payload:
        source_env:      string  — e.g. "DEV"
        target_env:      string  — e.g. "UAT"
        deployment_sheet: list  — [{"type": "ApexClass", "name": "MyClass"}, ...]
        profile_mapping:  list  — OPTIONAL
            [{"source_profile": "Sales User", "target_profile": "Sales_User_UAT"}, ...]
            When provided, only these pairs are compared.
            When omitted, all profiles are compared by name (legacy mode).
    """
    source_env = request.get("source_env", "DEV")
    target_env = request.get("target_env", "UAT")
    deployment_sheet = request.get("deployment_sheet", [])
    profile_mapping = request.get("profile_mapping")  # None if not provided

    if not deployment_sheet:
        raise HTTPException(status_code=400, detail="deployment_sheet cannot be empty")

    if profile_mapping is not None:
        # Validate mapping shape
        for i, m in enumerate(profile_mapping):
            if "source_profile" not in m or "target_profile" not in m:
                raise HTTPException(
                    status_code=400,
                    detail=f"profile_mapping[{i}] must have 'source_profile' and 'target_profile' keys",
                )

    logger.info(
        f"Agent triggered: {source_env} → {target_env} | "
        f"{len(deployment_sheet)} components | "
        f"{len(profile_mapping) if profile_mapping else 0} profile pairs"
    )

    try:
        result = run_agent(source_env, target_env, deployment_sheet, profile_mapping)
        if result.get("status") == "error":
            raise HTTPException(status_code=400, detail=result.get("message"))
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Agent execution failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agent/approve")
async def approve_actions(request: dict):
    """
    Approve an action plan. The agent applies changes to the target org.

    Payload:
        target_env:       string  — e.g. "UAT"
        approved_actions: list   — subset of the action plan to apply
    """
    target_env = request.get("target_env", "UAT")
    approved_actions = request.get("approved_actions", [])

    if not approved_actions:
        raise HTTPException(status_code=400, detail="approved_actions cannot be empty")

    logger.info(f"Agent approval received: {len(approved_actions)} actions → {target_env}")

    try:
        result = process_approval(target_env, approved_actions)
        return result
    except Exception as e:
        logger.error(f"Approval processing failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
