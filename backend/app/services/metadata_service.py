"""
Live metadata retrieval service.
Executes SOQL queries against connected Salesforce orgs to build permission snapshots.
"""

import logging
from typing import Dict, Any, List
from datetime import datetime
from app.services.salesforce_service import get_connection, _org_statuses

logger = logging.getLogger(__name__)


def retrieve_live_metadata(environment: str) -> Dict[str, Any]:
    """
    Query real Salesforce permissions using SOQL.
    Builds a normalized JSON snapshot of all permissions via SOQL queries.
    """
    sf = get_connection(environment)
    if not sf:
        raise ValueError(f"No active connection to {environment} org. Please connect first.")

    logger.info(f"Starting live metadata retrieval for {environment}...")
    
    snapshot = {
        "environment": environment,
        "retrieved_at": datetime.utcnow().isoformat(),
        "profiles": {},
        "permission_sets": {}
    }

    try:
        # 1. Get Permission Sets and Profiles
        logger.info("Querying Permission Sets and Profiles...")
        ps_query = """
            SELECT Id, Name, Label, ProfileId, Profile.Name, IsCustom 
            FROM PermissionSet 
            WHERE IsOwnedByProfile = false OR ProfileId != null
        """
        ps_records = sf.query_all(ps_query).get('records', [])
        
        profile_map = {} # ProfileId -> ProfileName
        ps_map = {}      # PermissionSetId -> Name
        
        for record in ps_records:
            if record.get('ProfileId'):
                profile_name = record['Profile']['Name']
                profile_map[record['ProfileId']] = profile_name
                ps_map[record['Id']] = profile_name # For FLS linking
                snapshot["profiles"][profile_name] = {
                    "name": profile_name,
                    "label": profile_name,
                    "custom": record.get('IsCustom', False),
                    "fieldPermissions": [],
                    "objectPermissions": [],
                    "classAccesses": [],
                    "userPermissions": []
                }
            else:
                ps_name = record.get('Name')
                ps_map[record['Id']] = ps_name
                snapshot["permission_sets"][ps_name] = {
                    "name": ps_name,
                    "label": record.get('Label', ps_name),
                    "fieldPermissions": [],
                    "objectPermissions": [],
                    "classAccesses": []
                }

        # 2. Get Field Permissions
        logger.info("Querying Field Permissions...")
        fls_query = """
            SELECT ParentId, SobjectType, Field, PermissionsRead, PermissionsEdit 
            FROM FieldPermissions
        """
        fls_records = sf.query_all(fls_query).get('records', [])
        
        for record in fls_records:
            ps_id = record.get('ParentId')
            target_name = ps_map.get(ps_id)
            
            if not target_name: continue
            
            perm = {
                "field": record.get('Field'),
                "readable": record.get('PermissionsRead', False),
                "editable": record.get('PermissionsEdit', False)
            }
            
            if target_name in snapshot["profiles"]:
                snapshot["profiles"][target_name]["fieldPermissions"].append(perm)
            elif target_name in snapshot["permission_sets"]:
                snapshot["permission_sets"][target_name]["fieldPermissions"].append(perm)

        # 3. Get Object Permissions
        logger.info("Querying Object Permissions...")
        obj_query = """
            SELECT ParentId, SobjectType, PermissionsCreate, PermissionsRead, 
                   PermissionsEdit, PermissionsDelete, PermissionsViewAllRecords, PermissionsModifyAllRecords 
            FROM ObjectPermissions
        """
        obj_records = sf.query_all(obj_query).get('records', [])
        
        for record in obj_records:
            ps_id = record.get('ParentId')
            target_name = ps_map.get(ps_id)
            
            if not target_name: continue
            
            perm = {
                "object_name": record.get('SobjectType'),
                "allowCreate": record.get('PermissionsCreate', False),
                "allowRead": record.get('PermissionsRead', False),
                "allowEdit": record.get('PermissionsEdit', False),
                "allowDelete": record.get('PermissionsDelete', False),
                "viewAllRecords": record.get('PermissionsViewAllRecords', False),
                "modifyAllRecords": record.get('PermissionsModifyAllRecords', False)
            }
            
            if target_name in snapshot["profiles"]:
                snapshot["profiles"][target_name]["objectPermissions"].append(perm)
            elif target_name in snapshot["permission_sets"]:
                snapshot["permission_sets"][target_name]["objectPermissions"].append(perm)

        # Update metadata count in org status
        total_items = (
            len(snapshot["profiles"]) + 
            len(snapshot["permission_sets"]) +
            len(fls_records) + 
            len(obj_records)
        )
        
        if environment in _org_statuses:
            _org_statuses[environment]["metadata_count"] = total_items
            _org_statuses[environment]["last_fetched"] = datetime.utcnow().isoformat()

        logger.info(f"Live metadata retrieval complete. Total items tracked: {total_items}")
        return snapshot

    except Exception as e:
        logger.error(f"Error during live metadata retrieval: {str(e)}")
        raise ValueError(f"Failed to retrieve metadata: {str(e)}")
