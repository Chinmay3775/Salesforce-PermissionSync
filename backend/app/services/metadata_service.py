"""
Targeted metadata retrieval service.
Executes SOQL queries against connected Salesforce orgs to fetch specific component permissions.
"""

import logging
from typing import Dict, Any, List
from datetime import datetime
from app.services.salesforce_service import get_connection, _org_statuses
from app.services.impact_engine import determine_required_permissions

logger = logging.getLogger(__name__)

def retrieve_component_permissions(
    component_name: str,
    component_type: str,
    environment: str,
    profile_names: list = None,  # Optional: restrict to only these profile names
) -> Dict[str, Any]:
    """
    Query real Salesforce permissions for a specific component.
    """
    sf = get_connection(environment)
    if not sf:
        raise ValueError(f"No active connection to {environment} org. Please connect first.")

    logger.info(f"Retrieving permissions for {component_type}: {component_name} in {environment}")
    
    snapshot = {
        "environment": environment,
        "component_name": component_name,
        "component_type": component_type,
        "retrieved_at": datetime.utcnow().isoformat(),
        "profiles": {},
    }

    try:
        from collections import defaultdict
        
        # Also need PermissionSet -> Profile mapping because SetupEntityAccess uses PermissionSetId
        ps_query = "SELECT Id, Profile.Name, Profile.UserLicense.LicenseDefinitionKey FROM PermissionSet WHERE ProfileId != null"
        ps_records = sf.query_all(ps_query).get('records', [])
        
        # Count name occurrences
        name_counts = defaultdict(int)
        for record in ps_records:
            prof = record.get("Profile")
            if prof and prof.get("Name"):
                name_counts[prof.get("Name")] += 1
                
        ps_to_display_name = {}
        display_names_used = set()
        for record in ps_records:
            prof = record.get("Profile")
            if prof:
                name = prof.get("Name")
                license_key = prof.get("UserLicense", {}).get("LicenseDefinitionKey") if prof.get("UserLicense") else None
                prof_id = record.get("ProfileId")
                if name:
                    display_name = name
                    if name_counts[name] > 1 and license_key:
                        display_name = f"{name} ({license_key})"
                        
                    if display_name in display_names_used:
                        display_name = f"{display_name} [{prof_id}]"
                        
                    display_names_used.add(display_name)
                    ps_to_display_name[record["Id"]] = display_name
                    
        # Initialize profiles in snapshot — filter to requested profiles if provided
        for dname in set(ps_to_display_name.values()):
            if profile_names is not None and dname not in profile_names:
                continue
            snapshot["profiles"][dname] = {
                "name": dname,
                "fieldPermissions": [],
                "objectPermissions": [],
                "classAccesses": [],
            }

        required_perms = determine_required_permissions(component_type).get("requires", [])

        if "classAccesses" in required_perms:
            # Query SetupEntityAccess
            # SetupEntityAccess has SetupEntityId which we need to get from ApexClass
            class_query = f"SELECT Id FROM ApexClass WHERE Name = '{component_name}' LIMIT 1"
            classes = sf.query_all(class_query).get('records', [])
            if classes:
                class_id = classes[0]['Id']
                access_query = f"SELECT ParentId FROM SetupEntityAccess WHERE SetupEntityId = '{class_id}'"
                access_records = sf.query_all(access_query).get('records', [])
                for record in access_records:
                    ps_id = record.get('ParentId')
                    profile_name = ps_to_display_name.get(ps_id)
                    if profile_name and profile_name in snapshot["profiles"]:
                        snapshot["profiles"][profile_name]["classAccesses"].append({
                            "apexClass": component_name,
                            "enabled": True
                        })

        if "fieldPermissions" in required_perms:
            # Salesforce stores field names as "ObjectName.FieldName" in FieldPermissions.
            # The 'Field' column is a Picklist in SOQL and does NOT support the LIKE operator.
            if "." not in component_name:
                raise ValueError(
                    f"For field permissions, you must provide the component name in 'ObjectName.FieldName' format "
                    f"(e.g., 'Account.{component_name}' instead of just '{component_name}')."
                )
            
            fls_filter = f"Field = '{component_name}'"
            fls_query = f"""
                SELECT ParentId, SobjectType, Field, PermissionsRead, PermissionsEdit 
                FROM FieldPermissions
                WHERE {fls_filter}
            """
            fls_records = sf.query_all(fls_query).get('records', [])
            for record in fls_records:
                ps_id = record.get('ParentId')
                profile_name = ps_to_display_name.get(ps_id)
                if profile_name and profile_name in snapshot["profiles"]:
                    snapshot["profiles"][profile_name]["fieldPermissions"].append({
                        "field": record.get('Field'),
                        "readable": record.get('PermissionsRead', False),
                        "editable": record.get('PermissionsEdit', False)
                    })

        if "objectPermissions" in required_perms:
            obj_query = f"""
                SELECT ParentId, SobjectType, PermissionsCreate, PermissionsRead, 
                       PermissionsEdit, PermissionsDelete, PermissionsViewAllRecords, PermissionsModifyAllRecords 
                FROM ObjectPermissions
                WHERE SobjectType = '{component_name}'
            """
            obj_records = sf.query_all(obj_query).get('records', [])
            for record in obj_records:
                ps_id = record.get('ParentId')
                profile_name = ps_to_display_name.get(ps_id)
                if profile_name and profile_name in snapshot["profiles"]:
                    snapshot["profiles"][profile_name]["objectPermissions"].append({
                        "object_name": record.get('SobjectType'),
                        "allowCreate": record.get('PermissionsCreate', False),
                        "allowRead": record.get('PermissionsRead', False),
                        "allowEdit": record.get('PermissionsEdit', False),
                        "allowDelete": record.get('PermissionsDelete', False),
                        "viewAllRecords": record.get('PermissionsViewAllRecords', False),
                        "modifyAllRecords": record.get('PermissionsModifyAllRecords', False)
                    })

        return snapshot

    except Exception as e:
        logger.error(f"Error during component metadata retrieval: {str(e)}")
        raise ValueError(f"Failed to retrieve metadata: {str(e)}")
