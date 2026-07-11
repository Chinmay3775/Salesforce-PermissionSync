"""
Deployment Parser Service.
Parses component lists (JSON/CSV) into a standardized format.
"""
from typing import List, Dict, Any

def parse_deployment_sheet(data: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """
    Parses a deployment sheet (list of dicts).
    Expected input format:
    [{"Component Type": "ApexClass", "Component Name": "EmailController"}]
    or
    [{"type": "ApexClass", "name": "EmailController"}]
    
    Returns standard format:
    [{"type": "ApexClass", "name": "EmailController"}]
    """
    components = []
    for item in data:
        c_type = item.get("type") or item.get("Component Type")
        c_name = item.get("name") or item.get("Component Name")
        if c_type and c_name:
            components.append({
                "type": c_type,
                "name": c_name
            })
    return components
