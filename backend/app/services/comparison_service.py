"""
Comparison service — deep metadata comparison engine.
Uses deepdiff for structural comparison and generates Git-style diff output.
"""

import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
from deepdiff import DeepDiff
import uuid


logger = logging.getLogger(__name__)

# In-memory cache for comparison results
_comparison_cache: Dict[str, Any] = {}


def compare_environments(source_env: str, target_env: str, profile_name: Optional[str] = None) -> Dict[str, Any]:
    """
    Compare metadata between two environments.
    Returns detailed comparison with categorized diffs.
    """
    logger.info(f"Comparing {source_env} vs {target_env}")

    # Import inside function to avoid circular imports
    from app.api.metadata import _metadata_cache
    
    source_snapshot = _metadata_cache.get(source_env)
    target_snapshot = _metadata_cache.get(target_env)
    
    if not source_snapshot or not target_snapshot:
        raise ValueError(f"Missing metadata snapshot for comparison. Please fetch metadata for both {source_env} and {target_env} first.")

    comparison_results = {
        "comparison_id": str(uuid.uuid4())[:8],
        "source_env": source_env,
        "target_env": target_env,
        "compared_at": datetime.utcnow().isoformat(),
        "summary": {
            "total_compared": 0,
            "matches": 0,
            "mismatches": 0,
            "missing_in_source": 0,
            "missing_in_target": 0,
            "critical_drifts": 0,
            "high_drifts": 0,
            "medium_drifts": 0,
            "low_drifts": 0,
        },
        "details": [],
    }

    profiles_to_compare = [profile_name] if profile_name else list(source_snapshot["profiles"].keys())

    for pname in profiles_to_compare:
        source_profile = source_snapshot["profiles"].get(pname)
        target_profile = target_snapshot["profiles"].get(pname)

        if not source_profile and not target_profile:
            continue

        if not target_profile:
            comparison_results["details"].append({
                "category": "Profile",
                "item": pname,
                "status": "Missing in Target",
                "severity": "Critical",
                "source": source_profile,
                "target": None,
            })
            comparison_results["summary"]["missing_in_target"] += 1
            comparison_results["summary"]["critical_drifts"] += 1
            continue

        if not source_profile:
            comparison_results["details"].append({
                "category": "Profile",
                "item": pname,
                "status": "Missing in Source",
                "severity": "High",
                "source": None,
                "target": target_profile,
            })
            comparison_results["summary"]["missing_in_source"] += 1
            comparison_results["summary"]["high_drifts"] += 1
            continue

        # Compare field permissions
        _compare_permissions_list(
            source_profile.get("fieldPermissions", []),
            target_profile.get("fieldPermissions", []),
            "field", "Field Permission", pname,
            source_env, target_env,
            comparison_results,
        )

        # Compare object permissions
        _compare_permissions_list(
            source_profile.get("objectPermissions", []),
            target_profile.get("objectPermissions", []),
            "object_name", "Object Permission", pname,
            source_env, target_env,
            comparison_results,
        )

        # Compare class accesses
        _compare_permissions_list(
            source_profile.get("classAccesses", []),
            target_profile.get("classAccesses", []),
            "apexClass", "Apex Class Access", pname,
            source_env, target_env,
            comparison_results,
        )

        # Compare tab visibilities
        _compare_permissions_list(
            source_profile.get("tabVisibilities", []),
            target_profile.get("tabVisibilities", []),
            "tab", "Tab Visibility", pname,
            source_env, target_env,
            comparison_results,
        )

        # Compare user permissions
        _compare_permissions_list(
            source_profile.get("userPermissions", []),
            target_profile.get("userPermissions", []),
            "name", "User Permission", pname,
            source_env, target_env,
            comparison_results,
        )

    # Cache the results
    _comparison_cache[f"{source_env}_{target_env}"] = comparison_results

    return comparison_results


def _compare_permissions_list(
    source_list: List[Dict],
    target_list: List[Dict],
    key_field: str,
    category: str,
    profile_name: str,
    source_env: str,
    target_env: str,
    results: Dict,
):
    """Compare two permission lists and append results."""

    source_map = {item[key_field]: item for item in source_list}
    target_map = {item[key_field]: item for item in target_list}

    all_keys = set(list(source_map.keys()) + list(target_map.keys()))

    for key in sorted(all_keys):
        results["summary"]["total_compared"] += 1
        source_item = source_map.get(key)
        target_item = target_map.get(key)

        if not source_item:
            severity = _classify_severity(category, key, "missing")
            results["details"].append({
                "id": str(uuid.uuid4())[:8],
                "category": category,
                "item": key,
                "profile": profile_name,
                "status": "Missing in Source",
                "severity": severity,
                "source_env": source_env,
                "target_env": target_env,
                "source": None,
                "target": target_item,
            })
            results["summary"]["missing_in_source"] += 1
            _increment_severity(results["summary"], severity)
            continue

        if not target_item:
            severity = _classify_severity(category, key, "missing")
            results["details"].append({
                "id": str(uuid.uuid4())[:8],
                "category": category,
                "item": key,
                "profile": profile_name,
                "status": "Missing in Target",
                "severity": severity,
                "source_env": source_env,
                "target_env": target_env,
                "source": source_item,
                "target": None,
            })
            results["summary"]["missing_in_target"] += 1
            _increment_severity(results["summary"], severity)
            continue

        # Deep compare
        diff = DeepDiff(source_item, target_item, ignore_order=True)
        if diff:
            severity = _classify_severity(category, key, "changed")
            results["details"].append({
                "id": str(uuid.uuid4())[:8],
                "category": category,
                "item": key,
                "profile": profile_name,
                "status": "Mismatch",
                "severity": severity,
                "source_env": source_env,
                "target_env": target_env,
                "source": source_item,
                "target": target_item,
                "changes": _format_diff(diff),
            })
            results["summary"]["mismatches"] += 1
            _increment_severity(results["summary"], severity)
        else:
            results["summary"]["matches"] += 1


def _classify_severity(category: str, item_name: str, change_type: str) -> str:
    """Classify drift severity based on category and item."""
    if change_type == "missing":
        if category in ["Apex Class Access", "Object Permission"]:
            return "Critical"
        if category == "Field Permission" and any(s in item_name for s in ["SSN", "Salary", "Payment"]):
            return "Critical"
        return "High"

    if category == "Field Permission":
        if any(s in item_name for s in ["SSN", "Salary", "Payment", "Amount"]):
            return "Critical"
        return "Medium"
    elif category == "Object Permission":
        return "High"
    elif category == "Apex Class Access":
        return "High"
    elif category == "Tab Visibility":
        return "Low"
    elif category == "User Permission":
        if any(s in item_name for s in ["ModifyAllData", "ViewAllData", "ManageUsers"]):
            return "Critical"
        return "Medium"

    return "Medium"


def _increment_severity(summary: Dict, severity: str):
    """Increment the severity counter."""
    key = f"{severity.lower()}_drifts"
    if key in summary:
        summary[key] += 1


def _format_diff(diff: DeepDiff) -> List[Dict[str, Any]]:
    """Format DeepDiff output into readable changes."""
    changes = []
    if "values_changed" in diff:
        for path, change in diff["values_changed"].items():
            changes.append({
                "path": str(path),
                "old_value": change.get("old_value"),
                "new_value": change.get("new_value"),
            })
    if "dictionary_item_added" in diff:
        for path in diff["dictionary_item_added"]:
            changes.append({"path": str(path), "type": "added"})
    if "dictionary_item_removed" in diff:
        for path in diff["dictionary_item_removed"]:
            changes.append({"path": str(path), "type": "removed"})
    return changes


def get_drift_report(source_env: str, target_env: str) -> Dict[str, Any]:
    """Generate a drift report from comparison results."""
    cache_key = f"{source_env}_{target_env}"
    if cache_key not in _comparison_cache:
        compare_environments(source_env, target_env)

    comparison = _comparison_cache.get(cache_key, {})
    drift_items = [d for d in comparison.get("details", []) if d.get("status") != "Match"]

    return {
        "report_id": str(uuid.uuid4())[:8],
        "source_env": source_env,
        "target_env": target_env,
        "total_drifts": len(drift_items),
        "critical": comparison.get("summary", {}).get("critical_drifts", 0),
        "high": comparison.get("summary", {}).get("high_drifts", 0),
        "medium": comparison.get("summary", {}).get("medium_drifts", 0),
        "low": comparison.get("summary", {}).get("low_drifts", 0),
        "items": drift_items,
        "generated_at": datetime.utcnow().isoformat(),
    }


def get_metadata_tree(environment: str) -> Dict[str, Any]:
    """Get metadata as a navigable tree structure."""
    from app.api.metadata import _metadata_cache
    
    snapshot = _metadata_cache.get(environment)
    if not snapshot:
        return {"environment": environment, "children": []}

    tree = {
        "environment": environment,
        "children": [
            {
                "name": "Profiles",
                "type": "folder",
                "count": len(snapshot.get("profiles", {})),
                "children": [
                    {
                        "name": pname,
                        "type": "profile",
                        "children": [
                            {"name": "Field Permissions", "type": "folder", "count": len(pdata.get("fieldPermissions", []))},
                            {"name": "Object Permissions", "type": "folder", "count": len(pdata.get("objectPermissions", []))},
                            {"name": "Apex Class Access", "type": "folder", "count": len(pdata.get("classAccesses", []))},
                            {"name": "Tab Visibilities", "type": "folder", "count": len(pdata.get("tabVisibilities", []))},
                            {"name": "User Permissions", "type": "folder", "count": len(pdata.get("userPermissions", []))},
                        ],
                    }
                    for pname, pdata in snapshot["profiles"].items()
                ],
            },
            {
                "name": "Permission Sets",
                "type": "folder",
                "count": len(snapshot["permission_sets"]),
                "children": [
                    {"name": ps_name, "type": "permissionset"}
                    for ps_name in snapshot["permission_sets"]
                ],
            },
        ],
    }

    return tree
