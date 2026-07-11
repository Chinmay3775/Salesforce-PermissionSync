"""
Agent Orchestrator Service.
Manages the end-to-end workflow of the Deployment-Based Permission Agent.
"""

import logging
from typing import List, Dict, Any, Optional

from app.services.deployment_parser import parse_deployment_sheet
from app.services.comparison_service import compare_components
from app.services.action_generator import generate_deployment_xml
from app.services.sync_service import apply_approved_actions

logger = logging.getLogger(__name__)


def run_agent(
    source_env: str,
    target_env: str,
    deployment_sheet_data: List[Dict[str, str]],
    profile_mapping: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    """
    Main orchestration function for the agent.

    Steps:
      1. Parse deployment sheet into standardized component list
      2. Compare components between orgs (using profile_mapping when provided)
      3. Generate action plan from drift details

    Args:
        source_env: Source org environment key (e.g. "DEV")
        target_env: Target org environment key (e.g. "UAT")
        deployment_sheet_data: Raw list from frontend (parsed or manual)
        profile_mapping: Optional list of {"source_profile": ..., "target_profile": ...}
            When provided, only those profile pairs are compared.
    """
    logger.info(
        f"Starting Agent Run: {source_env} → {target_env} | "
        f"Profile pairs: {len(profile_mapping) if profile_mapping else 'none (name-union mode)'}"
    )

    # 1. Parse
    components = parse_deployment_sheet(deployment_sheet_data)
    if not components:
        return {"status": "error", "message": "No valid components found in deployment sheet."}

    # 2. Compare — pass profile_mapping through so comparison is pair-aware
    comparison_results = compare_components(
        source_env, target_env, components,
        profile_mapping=profile_mapping,
    )

    # 3. Generate Action Plan — every non-match becomes an actionable item
    action_plan = []
    for detail in comparison_results.get("details", []):
        status = detail["status"]
        if status == "Match":
            continue

        action = "Update" if status == "Mismatch" else "Add"

        action_plan.append({
            "action_id": detail["id"],
            # Profile display label for the UI (e.g. "Sales User → Sales_UAT")
            "profile": detail["profile"],
            # Actual profile names for the sync engine
            "source_profile": detail.get("source_profile", detail["profile"]),
            "target_profile": detail.get("target_profile", detail["profile"]),
            "component_name": detail["component_name"],
            "component_type": detail["component_type"],
            "category": detail["category"],
            "action": action,
            "status_detail": status,
            "source_value": detail["source"],
            # Desired target state = what source currently has
            "target": detail["source"],
            "current_target_value": detail["target"],
            "status": "Pending Approval",
        })

    return {
        "status": "success",
        "message": "Action plan generated successfully. Awaiting approval.",
        "source_env": source_env,
        "target_env": target_env,
        "profile_mapping": profile_mapping or [],
        "components_analyzed": len(components),
        "comparison_summary": comparison_results.get("summary", {}),
        "action_plan": action_plan,
    }


def process_approval(
    target_env: str,
    approved_actions: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Processes approved actions: applies them to the target org
    and generates Metadata XML deployment artifacts for reference.
    """
    logger.info(f"Processing approval for {len(approved_actions)} actions → {target_env}")

    # 1. Generate XML artifacts (for manual deployment reference / audit)
    deployment_artifacts = generate_deployment_xml(approved_actions)

    # 2. Apply changes via Salesforce REST/Tooling API
    sync_result = apply_approved_actions(target_env, approved_actions)

    sync_result["deployment_artifacts"] = deployment_artifacts
    return sync_result
