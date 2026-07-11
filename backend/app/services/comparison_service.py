"""
Comparison service — deep metadata comparison engine for components.

Supports two modes:
  1. Profile-mapped (recommended): caller provides a list of
     {source_profile, target_profile} dicts. Comparison is performed
     strictly between the declared pairs — different names are handled.

  2. Name-union (legacy fallback): when no profile_mapping is given,
     all profiles from both orgs are unioned by name and compared.
"""

import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
from deepdiff import DeepDiff
import uuid
from app.services.metadata_service import retrieve_component_permissions

logger = logging.getLogger(__name__)


def compare_components(
    source_org: str,
    target_org: str,
    deployment_components: List[Dict],
    profile_mapping: Optional[List[Dict]] = None,
) -> Dict[str, Any]:
    """
    Compare metadata for specific components between two environments.

    Args:
        source_org: Environment key for the source org (e.g. "DEV")
        target_org: Environment key for the target org (e.g. "UAT")
        deployment_components: List of {"type": ..., "name": ...} dicts
        profile_mapping: Optional list of {"source_profile": ..., "target_profile": ...} dicts.
            When supplied, only the declared pairs are compared.
            When omitted, all profiles are compared by name (legacy mode).
    """
    logger.info(f"Comparing components between {source_org} and {target_org}")

    # Derive the profile name lists so metadata_service can filter SOQL results
    source_profile_names: Optional[List[str]] = None
    target_profile_names: Optional[List[str]] = None
    if profile_mapping:
        source_profile_names = [m["source_profile"] for m in profile_mapping]
        target_profile_names = [m["target_profile"] for m in profile_mapping]

    comparison_results = {
        "comparison_id": str(uuid.uuid4())[:8],
        "source_env": source_org,
        "target_env": target_org,
        "compared_at": datetime.utcnow().isoformat(),
        "profile_mapping": profile_mapping or [],
        "summary": {
            "total_compared": 0,
            "matches": 0,
            "mismatches": 0,
            "missing_in_source": 0,
            "missing_in_target": 0,
        },
        "details": [],
    }

    for comp in deployment_components:
        comp_type = comp["type"]
        comp_name = comp["name"]

        # Fetch snapshots (filtered to relevant profiles for performance)
        try:
            source_snap = retrieve_component_permissions(
                comp_name, comp_type, source_org,
                profile_names=source_profile_names,
            )
            target_snap = retrieve_component_permissions(
                comp_name, comp_type, target_org,
                profile_names=target_profile_names,
            )
        except Exception as e:
            logger.error(f"Failed to retrieve {comp_name}: {e}")
            continue

        if profile_mapping:
            # ── MAPPED MODE ─────────────────────────────────────────────────
            # Compare each explicitly declared pair.
            for mapping in profile_mapping:
                src_name = mapping["source_profile"]
                tgt_name = mapping["target_profile"]
                display_label = f"{src_name} → {tgt_name}"

                source_profile = source_snap["profiles"].get(src_name, {})
                target_profile = target_snap["profiles"].get(tgt_name, {})

                _compare_lists(
                    source_profile.get("fieldPermissions", []),
                    target_profile.get("fieldPermissions", []),
                    "field", "Field Permission",
                    display_label, src_name, tgt_name,
                    comp_name, comp_type,
                    source_org, target_org,
                    comparison_results,
                )
                _compare_lists(
                    source_profile.get("objectPermissions", []),
                    target_profile.get("objectPermissions", []),
                    "object_name", "Object Permission",
                    display_label, src_name, tgt_name,
                    comp_name, comp_type,
                    source_org, target_org,
                    comparison_results,
                )
                _compare_lists(
                    source_profile.get("classAccesses", []),
                    target_profile.get("classAccesses", []),
                    "apexClass", "Apex Class Access",
                    display_label, src_name, tgt_name,
                    comp_name, comp_type,
                    source_org, target_org,
                    comparison_results,
                )
        else:
            # ── LEGACY NAME-UNION MODE ───────────────────────────────────────
            profiles = set(
                list(source_snap["profiles"].keys()) +
                list(target_snap["profiles"].keys())
            )
            for pname in profiles:
                source_profile = source_snap["profiles"].get(pname, {})
                target_profile = target_snap["profiles"].get(pname, {})

                _compare_lists(
                    source_profile.get("fieldPermissions", []),
                    target_profile.get("fieldPermissions", []),
                    "field", "Field Permission",
                    pname, pname, pname,
                    comp_name, comp_type,
                    source_org, target_org,
                    comparison_results,
                )
                _compare_lists(
                    source_profile.get("objectPermissions", []),
                    target_profile.get("objectPermissions", []),
                    "object_name", "Object Permission",
                    pname, pname, pname,
                    comp_name, comp_type,
                    source_org, target_org,
                    comparison_results,
                )
                _compare_lists(
                    source_profile.get("classAccesses", []),
                    target_profile.get("classAccesses", []),
                    "apexClass", "Apex Class Access",
                    pname, pname, pname,
                    comp_name, comp_type,
                    source_org, target_org,
                    comparison_results,
                )

    return comparison_results


def _compare_lists(
    source_list: List[Dict],
    target_list: List[Dict],
    key_field: str,
    category: str,
    profile_label: str,   # display label for the pair, e.g. "Sales User → Sales_UAT"
    source_profile: str,  # actual source profile name
    target_profile: str,  # actual target profile name
    component_name: str,
    component_type: str,
    source_env: str,
    target_env: str,
    results: Dict,
):
    source_map = {item[key_field]: item for item in source_list}
    target_map = {item[key_field]: item for item in target_list}

    all_keys = set(list(source_map.keys()) + list(target_map.keys()))

    for key in sorted(all_keys):
        source_item = source_map.get(key)
        target_item = target_map.get(key)

        base = {
            "id": str(uuid.uuid4())[:8],
            "component_name": component_name,
            "component_type": component_type,
            "category": category,
            "item": key,
            # Human-readable profile pair label
            "profile": profile_label,
            "source_profile": source_profile,
            "target_profile": target_profile,
            "source_env": source_env,
            "target_env": target_env,
        }

        results["summary"]["total_compared"] += 1

        if not source_item:
            results["details"].append({
                **base,
                "status": "Missing in Source",
                "source": None,
                "target": target_item,
            })
            results["summary"]["missing_in_source"] += 1

        elif not target_item:
            results["details"].append({
                **base,
                "status": "Missing in Target",
                "source": source_item,
                "target": None,
            })
            results["summary"]["missing_in_target"] += 1

        else:
            diff = DeepDiff(source_item, target_item, ignore_order=True)
            if diff:
                results["details"].append({
                    **base,
                    "status": "Mismatch",
                    "source": source_item,
                    "target": target_item,
                    "changes": _format_diff(diff),
                })
                results["summary"]["mismatches"] += 1
            else:
                results["summary"]["matches"] += 1


def _format_diff(diff: DeepDiff) -> List[Dict[str, Any]]:
    changes = []
    if "values_changed" in diff:
        for path, change in diff["values_changed"].items():
            changes.append({
                "path": str(path),
                "old_value": change.get("old_value"),
                "new_value": change.get("new_value"),
            })
    return changes
