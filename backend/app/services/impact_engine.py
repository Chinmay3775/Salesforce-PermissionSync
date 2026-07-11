"""
Impact Engine Service.
Determines required permission types for a given component type.
"""
from typing import List, Dict

# Mapping of Salesforce Component Type to the required permission types to check
COMPONENT_PERMISSION_MAPPING = {
    "ApexClass": ["classAccesses"],
    "CustomField": ["fieldPermissions"],
    "CustomObject": ["objectPermissions", "tabVisibilities"],
    "CustomTab": ["tabVisibilities"],
}

def determine_required_permissions(component_type: str) -> Dict[str, List[str]]:
    """
    Returns the required permission categories for a given component type.
    Example: 'ApexClass' -> {'requires': ['classAccesses']}
    """
    requires = COMPONENT_PERMISSION_MAPPING.get(component_type, [])
    return {"requires": requires}
