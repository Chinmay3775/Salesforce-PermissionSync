"""
Deployment Parser Service.
Parses component lists (JSON/CSV) into a standardized format.
"""
from typing import List, Dict, Any

# Canonical type name normalization — accepts case-insensitive aliases from uploaded files.
# All values must exactly match keys in COMPONENT_PERMISSION_MAPPING (impact_engine.py).
KNOWN_TYPES: Dict[str, str] = {
    "apexclass":    "ApexClass",
    "apex":         "ApexClass",
    "customfield":  "CustomField",
    "field":        "CustomField",
    "customobject": "CustomObject",
    "object":       "CustomObject",
    "customtab":    "CustomTab",
    "tab":          "CustomTab",
    "pagelayout":   "PageLayout",
    "layout":       "PageLayout",
    "flowaccess":   "FlowAccess",
    "flow":         "FlowAccess",   # normalize plain 'Flow' → FlowAccess to avoid ambiguity
}


def _normalize_type(raw: str) -> str:
    """Return the canonical component type string, or the original value if unknown."""
    key = raw.strip().lower().replace(" ", "").replace("_", "")
    return KNOWN_TYPES.get(key, raw.strip())


def parse_deployment_sheet(data: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """
    Parses a deployment sheet (list of dicts).
    Expected input format:
    [{"Component Type": "ApexClass", "Component Name": "EmailController"}]
    or
    [{"type": "ApexClass", "name": "EmailController"}]

    Returns standard format:
    [{"type": "ApexClass", "name": "EmailController"}]

    Type strings are normalized via KNOWN_TYPES (case-insensitive, alias-aware).
    """
    components = []
    for item in data:
        c_type = item.get("type") or item.get("Component Type")
        c_name = item.get("name") or item.get("Component Name")
        if c_type and c_name:
            components.append({
                "type": _normalize_type(c_type),
                "name": c_name.strip(),
            })
    return components

