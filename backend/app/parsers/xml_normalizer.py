"""
XML Normalizer — converts Salesforce metadata XML into normalized JSON structures.
Handles profiles, permission sets, and custom objects.
"""

import xmltodict
import json
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


def parse_profile_xml(xml_content: str, environment: str = "DEV") -> Dict[str, Any]:
    """Parse a Salesforce Profile XML into normalized JSON."""
    try:
        parsed = xmltodict.parse(xml_content)
        profile = parsed.get("Profile", {})

        normalized = {
            "environment": environment,
            "metadata_type": "Profile",
            "name": profile.get("fullName", "Unknown"),
            "label": profile.get("label", ""),
            "fieldPermissions": _normalize_list(profile.get("fieldPermissions", []), _normalize_field_permission),
            "objectPermissions": _normalize_list(profile.get("objectPermissions", []), _normalize_object_permission),
            "classAccesses": _normalize_list(profile.get("classAccesses", []), _normalize_class_access),
            "tabVisibilities": _normalize_list(profile.get("tabVisibilities", []), _normalize_tab_visibility),
            "userPermissions": _normalize_list(profile.get("userPermissions", []), _normalize_user_permission),
            "recordTypeVisibilities": _normalize_list(profile.get("recordTypeVisibilities", []), _normalize_record_type),
            "pageAccesses": _normalize_list(profile.get("pageAccesses", []), _normalize_page_access),
            "customPermissions": _normalize_list(profile.get("customPermissions", []), _normalize_custom_permission),
        }

        return normalized
    except Exception as e:
        logger.error(f"Error parsing profile XML: {e}")
        return {"error": str(e)}


def parse_permission_set_xml(xml_content: str, environment: str = "DEV") -> Dict[str, Any]:
    """Parse a Salesforce PermissionSet XML into normalized JSON."""
    try:
        parsed = xmltodict.parse(xml_content)
        permset = parsed.get("PermissionSet", {})

        normalized = {
            "environment": environment,
            "metadata_type": "PermissionSet",
            "name": permset.get("fullName", "Unknown"),
            "label": permset.get("label", ""),
            "fieldPermissions": _normalize_list(permset.get("fieldPermissions", []), _normalize_field_permission),
            "objectPermissions": _normalize_list(permset.get("objectPermissions", []), _normalize_object_permission),
            "classAccesses": _normalize_list(permset.get("classAccesses", []), _normalize_class_access),
            "tabVisibilities": _normalize_list(permset.get("tabSettings", []), _normalize_tab_visibility),
            "userPermissions": _normalize_list(permset.get("userPermissions", []), _normalize_user_permission),
        }

        return normalized
    except Exception as e:
        logger.error(f"Error parsing permission set XML: {e}")
        return {"error": str(e)}


def _normalize_list(items, normalizer_func):
    """Normalize a list of items, handling single-item case."""
    if not items:
        return []
    if isinstance(items, dict):
        items = [items]
    return [normalizer_func(item) for item in items]


def _normalize_field_permission(item: Dict) -> Dict:
    return {
        "field": item.get("field", ""),
        "readable": _to_bool(item.get("readable", False)),
        "editable": _to_bool(item.get("editable", False)),
    }


def _normalize_object_permission(item: Dict) -> Dict:
    return {
        "object_name": item.get("object", ""),
        "allowCreate": _to_bool(item.get("allowCreate", False)),
        "allowRead": _to_bool(item.get("allowRead", False)),
        "allowEdit": _to_bool(item.get("allowEdit", False)),
        "allowDelete": _to_bool(item.get("allowDelete", False)),
        "viewAllRecords": _to_bool(item.get("viewAllRecords", False)),
        "modifyAllRecords": _to_bool(item.get("modifyAllRecords", False)),
    }


def _normalize_class_access(item: Dict) -> Dict:
    return {
        "apexClass": item.get("apexClass", ""),
        "enabled": _to_bool(item.get("enabled", False)),
    }


def _normalize_tab_visibility(item: Dict) -> Dict:
    return {
        "tab": item.get("tab", ""),
        "visibility": item.get("visibility", "DefaultOff"),
    }


def _normalize_user_permission(item: Dict) -> Dict:
    return {
        "name": item.get("name", ""),
        "enabled": _to_bool(item.get("enabled", False)),
    }


def _normalize_record_type(item: Dict) -> Dict:
    return {
        "recordType": item.get("recordType", ""),
        "default": _to_bool(item.get("default", False)),
        "visible": _to_bool(item.get("visible", False)),
    }


def _normalize_page_access(item: Dict) -> Dict:
    return {
        "apexPage": item.get("apexPage", ""),
        "enabled": _to_bool(item.get("enabled", False)),
    }


def _normalize_custom_permission(item: Dict) -> Dict:
    return {
        "name": item.get("name", ""),
        "enabled": _to_bool(item.get("enabled", False)),
    }


def _to_bool(value) -> bool:
    """Convert various truthy values to boolean."""
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() in ("true", "1", "yes")
    return bool(value)
