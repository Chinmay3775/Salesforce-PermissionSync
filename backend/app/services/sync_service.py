"""
Sync Engine — applies approved permission changes directly to the target Salesforce org.

Supports three permission categories via simple_salesforce REST/Tooling API:
  - ApexClass Access   → SetupEntityAccess (Tooling API)
  - Field Permissions  → FieldPermissions (REST API)
  - Object Permissions → ObjectPermissions (REST API)

Each action carries the profile name in the target org (target_profile field).
The engine resolves the PermissionSet ID for that profile, then upserts the record.
"""

import logging
import uuid
from datetime import datetime
import time
import base64
import zipfile
import io
import xml.etree.ElementTree as ET
import urllib.parse
from collections import defaultdict
from typing import Dict, List, Any, Optional

from app.services.salesforce_service import get_connection

logger = logging.getLogger(__name__)

_action_history: List[Dict[str, Any]] = []


def _query_all_tooling(sf, query: str) -> List[Dict[str, Any]]:
    import urllib.parse
    records = []
    q = urllib.parse.quote(query)
    res = sf.toolingexecute(f"query/?q={q}")
    records.extend(res.get("records", []))
    while not res.get("done", True) and "queryLocator" in res:
        # Tooling API next records use query/queryLocator
        q_loc = res["queryLocator"]
        res = sf.toolingexecute(f"query/{q_loc}")
        records.extend(res.get("records", []))
    return records

def _validate_components_exist(sf, actions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Validates that the target components (CustomField, CustomObject, ApexClass) actually exist in the target org.
    Any actions for components that do not exist are marked as Failed and excluded from the deployment list.
    """
    valid_actions = []
    
    # Collect components to check
    custom_fields = set()
    custom_objects = set()
    apex_classes = set()
    
    for act in actions:
        ctype = act.get("component_type")
        cname = act.get("component_name")
        if ctype == "CustomField":
            custom_fields.add(cname)
        elif ctype == "CustomObject":
            custom_objects.add(cname)
        elif ctype == "ApexClass":
            apex_classes.add(cname)
            
    # Fetch existing components from Target
    existing_fields = set()
    existing_objects = set()
    existing_classes = set()
    
    try:
        import urllib.parse
        
        object_id_to_name = {}
        if custom_fields or custom_objects:
            records = _query_all_tooling(sf, "SELECT Id, DeveloperName, NamespacePrefix FROM CustomObject")
            for r in records:
                dev_name = r.get("DeveloperName")
                ns = r.get("NamespacePrefix")
                api_name = f"{ns}__{dev_name}__c" if ns else f"{dev_name}__c"
                existing_objects.add(api_name)
                obj_id = r.get("Id")
                if obj_id:
                    object_id_to_name[obj_id] = api_name
                    object_id_to_name[obj_id[:15]] = api_name

        if custom_fields:
            records = _query_all_tooling(sf, "SELECT DeveloperName, TableEnumOrId, NamespacePrefix FROM CustomField")
            for r in records:
                table = r.get("TableEnumOrId")
                # For custom objects, TableEnumOrId is the ID. Resolve it to the API name.
                obj_name = object_id_to_name.get(table, table)
                dev_name = r.get("DeveloperName")
                ns = r.get("NamespacePrefix")
                api_name = f"{ns}__{dev_name}__c" if ns else f"{dev_name}__c"
                existing_fields.add(f"{obj_name}.{api_name}")
                
        if apex_classes:
            records = _query_all_tooling(sf, "SELECT Name, NamespacePrefix FROM ApexClass")
            for r in records:
                name = r.get("Name")
                ns = r.get("NamespacePrefix")
                api_name = f"{ns}__{name}" if ns else name
                existing_classes.add(api_name)
                
    except Exception as e:
        logger.error(f"Error querying target org for component validation: {e}")
        # If validation fails, just proceed and let Salesforce catch the missing components
        return actions

    # Filter actions
    for act in actions:
        ctype = act.get("component_type")
        cname = act.get("component_name")
        is_valid = True
        
        if ctype == "CustomField" and cname not in existing_fields:
            is_valid = False
        elif ctype == "CustomObject" and cname not in existing_objects:
            is_valid = False
        elif ctype == "ApexClass" and cname not in existing_classes:
            is_valid = False
            
        if is_valid:
            valid_actions.append(act)
        else:
            act["sync_status"] = "Failed"
            act["error"] = f"Component {cname} does not exist in target org."
            
    if len(valid_actions) < len(actions):
        logger.warning(f"Filtered out {len(actions) - len(valid_actions)} actions because components are missing in target.")
        
    return valid_actions


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def apply_approved_actions(
    target_env: str,
    approved_actions: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Apply a list of approved permission actions to the target org.

    Each action dict must contain:
        target_profile:  str  — the profile name in the TARGET org to modify
        component_type:  str  — "ApexClass", "CustomField", "CustomObject"
        component_name:  str  — API name of the component
        target:          dict — desired permission state (from source org)
        action:          str  — "Add" | "Update"
    """
    sf = get_connection(target_env)
    if not sf:
        return {
            "sync_id": str(uuid.uuid4())[:8],
            "target_env": target_env,
            "items_synced": 0,
            "items_failed": len(approved_actions),
            "status": "Failed",
            "error": f"No active connection to {target_env} org. Please connect first.",
            "details": [],
            "synced_at": datetime.utcnow().isoformat(),
        }

    logger.info(f"Applying {len(approved_actions)} approved actions to {target_env}")
    
    valid_actions = _validate_components_exist(sf, approved_actions)
    
    # Identify invalid actions (those marked as Failed by validation)
    invalid_actions = [act for act in approved_actions if act.get("sync_status") == "Failed"]

    if not valid_actions:
        return _build_mdapi_result(target_env, invalid_actions, "Completed with Errors", "All components missing in target org.")

    if USE_METADATA_API:
        # Pass valid actions to deploy, then merge invalid actions into the final result
        result = _deploy_via_metadata_api(sf, target_env, valid_actions)
        result["details"].extend(invalid_actions)
        result["items_failed"] = len([d for d in result["details"] if d.get("sync_status") == "Failed"])
        result["items_synced"] = len([d for d in result["details"] if d.get("sync_status") == "Success"])
        return result
    else:
        return _deploy_via_rest_api(sf, target_env, approved_actions)

def _deploy_via_rest_api(sf, target_env, approved_actions):
    # Build a profile → PermissionSet ID cache to avoid repeated SOQL
    ps_cache: Dict[str, str] = {}

    synced_items: List[Dict] = []
    failed_items: List[Dict] = []

    for action in approved_actions:
        target_profile = action.get("target_profile") or action.get("profile", "")
        component_type = action.get("component_type", "")
        component_name = action.get("component_name", "")
        desired_state = action.get("target") or {}

        try:
            ps_id = _resolve_permission_set_id(sf, target_profile, ps_cache)
            if not ps_id:
                raise ValueError(
                    f"Could not find PermissionSet for profile '{target_profile}' in {target_env}"
                )

            if component_type == "ApexClass":
                _sync_apex_class_access(sf, ps_id, component_name, desired_state)

            elif component_type == "CustomField":
                _sync_field_permission(sf, ps_id, component_name, desired_state)

            elif component_type == "CustomObject":
                _sync_object_permission(sf, ps_id, component_name, desired_state)

            else:
                logger.warning(f"Unsupported component type for sync: {component_type}")
                raise ValueError(f"Component type '{component_type}' is not yet supported for sync.")

            action["sync_status"] = "Success"
            action["synced_at"] = datetime.utcnow().isoformat()
            synced_items.append(action)
            logger.info(f"✅ Synced {component_type}:{component_name} for profile '{target_profile}'")

        except Exception as e:
            error_msg = str(e)
            logger.error(
                f"❌ Failed to sync {component_type}:{component_name} "
                f"for profile '{target_profile}': {error_msg}"
            )
            action["sync_status"] = "Failed"
            action["error"] = error_msg
            failed_items.append(action)

    status = (
        "Completed"
        if not failed_items
        else ("Completed with Errors" if synced_items else "Failed")
    )

    result = {
        "sync_id": str(uuid.uuid4())[:8],
        "target_env": target_env,
        "items_synced": len(synced_items),
        "items_failed": len(failed_items),
        "status": status,
        "details": synced_items + failed_items,
        "synced_at": datetime.utcnow().isoformat(),
    }

    _action_history.append(result)
    logger.info(
        f"Sync complete: {len(synced_items)} succeeded, {len(failed_items)} failed"
    )
    return result



# Constants
USE_METADATA_API = True
MAX_POLL_WAIT_SECONDS = 180
SF_NAMESPACE = "http://soap.sforce.com/2006/04/metadata"
ET.register_namespace('', SF_NAMESPACE)

def _get_profile_api_name_mapping(sf, profile_names: List[str]) -> Dict[str, Dict[str, Any]]:
    """
    Resolve Profile display names to their Metadata API names and track if they are custom.
    Uses the Tooling API to fetch the exact FullName one by one, natively handling every profile perfectly.
    """
    mapping = {}
    if not profile_names:
        return mapping
        
    import urllib.parse
    import re
    
    # 1. Extract base names (strip any " [ProfileId]" and " (LicenseKey)" suffixes)
    base_names = set()
    for p in profile_names:
        base = re.sub(r'\s*\[.*?\]$', '', p)  # Strip ProfileId first if present
        base = re.sub(r'\s*\(.*?\)$', '', base) # Then strip LicenseKey if present
        base_names.add(base)
    
    # 2. Fetch ProfileId, IsCustom, and LicenseDefinitionKey from PermissionSet
    matched_profiles = [] # list of (original_name, profile_id, is_custom)
    try:
        names_list = ", ".join(f"'{_escape_soql(p)}'" for p in base_names)
        query = f"SELECT ProfileId, Profile.Name, Profile.UserLicense.LicenseDefinitionKey, IsCustom FROM PermissionSet WHERE Profile.Name IN ({names_list})"
        result = sf.query(query)
        
        for record in result.get("records", []):
            ui_name = record.get("Profile", {}).get("Name")
            is_custom = record.get("IsCustom", False)
            prof_id = record.get("ProfileId")
            license_key = record.get("Profile", {}).get("UserLicense", {}).get("LicenseDefinitionKey")
            
            if not ui_name or not prof_id:
                continue
                
            # Check which original requested name this record matches
            exact_match = ui_name
            suffix_match1 = f"{ui_name} ({license_key})"
            suffix_match2 = f"{ui_name} ({license_key}) [{prof_id}]"
            
            if suffix_match2 in profile_names:
                matched_profiles.append((suffix_match2, prof_id, is_custom))
                mapping[suffix_match2] = {"is_custom": is_custom, "api_name": suffix_match2}
            elif suffix_match1 in profile_names:
                matched_profiles.append((suffix_match1, prof_id, is_custom))
                mapping[suffix_match1] = {"is_custom": is_custom, "api_name": suffix_match1}
            elif exact_match in profile_names:
                matched_profiles.append((exact_match, prof_id, is_custom))
                mapping[exact_match] = {"is_custom": is_custom, "api_name": exact_match}
                
    except Exception as e:
        logger.error(f"Error fetching Profile details from PermissionSet: {e}")
        
    # 3. Fetch FullName from Tooling API using the exact ProfileId (guarantees accuracy for duplicates)
    for original_name, prof_id, is_custom in matched_profiles:
        try:
            q = urllib.parse.quote(f"SELECT FullName FROM Profile WHERE Id = '{prof_id}'")
            res = sf.toolingexecute(f"query/?q={q}")
            records = res.get("records", [])
            if records:
                full_name = records[0].get("FullName")
                if full_name:
                    mapping[original_name]["api_name"] = full_name
        except Exception as e:
            logger.error(f"Error fetching FullName for {original_name} (Id: {prof_id}): {e}")
            
    return mapping

def _deploy_via_metadata_api(sf, target_env: str, approved_actions: List[Dict[str, Any]]) -> Dict[str, Any]:
    logger.info("Starting Metadata API Deployment Flow...")
    
    # 1. Group actions by Target Profile
    actions_by_profile = defaultdict(list)
    for action in approved_actions:
        tgt = action.get("target_profile") or action.get("profile")
        if tgt:
            actions_by_profile[tgt].append(action)

    if not actions_by_profile:
        return _build_mdapi_result(target_env, approved_actions, "Completed", "No profiles to deploy.")

    # 2. Get API Name mapping for exactly the profiles we are deploying
    profile_names = list(actions_by_profile.keys())
    profile_mapping = _get_profile_api_name_mapping(sf, profile_names)
    logger.info(f"Profile mapping resolved: {profile_mapping}")

    # 3. Build minimal Profile XMLs
    profile_xmls = {}  # {filename: xml_string}
    
    for display_name, actions in actions_by_profile.items():
        mapping_info = profile_mapping.get(display_name, {"api_name": display_name, "is_custom": True})
        api_name = mapping_info["api_name"]
        is_custom = mapping_info["is_custom"]
        
        logger.info(f"Building profile XML: '{display_name}' → API name '{api_name}' ({len(actions)} actions)")
        
        profile_xml = _build_profile_xml(actions, is_custom=is_custom)
        filename = f"{api_name}.profile"
        profile_xmls[filename] = profile_xml
        
    # 4. Build Deployment ZIP
    deploy_zip_base64 = _build_deployment_zip_from_scratch(profile_xmls)

    # 5. Deploy
    test_level = 'NoTestRun' if 'prod' not in target_env.lower() else 'RunLocalTests'
    logger.info(f"Deploying ZIP with testLevel={test_level} and rollbackOnError=False")
    
    import tempfile
    import os
    
    try:
        with tempfile.NamedTemporaryFile(suffix='.zip', delete=False) as temp_zip:
            temp_zip.write(base64.b64decode(deploy_zip_base64))
            temp_zip_path = temp_zip.name
            
        try:
            job_id = None
            is_sandbox = 'prod' not in target_env.lower()
            async_result = sf.mdapi.deploy(
                temp_zip_path, 
                is_sandbox, 
                testLevel=test_level, 
                singlePackage=True, 
                rollbackOnError=False
            )
        finally:
            # Clean up the temp file
            if os.path.exists(temp_zip_path):
                os.remove(temp_zip_path)
                
        if isinstance(async_result, dict):
            job_id = async_result.get("id")
        elif hasattr(async_result, "id"):
            job_id = async_result.id
        elif isinstance(async_result, tuple) and len(async_result) > 0:
            job_id = async_result[0]
            
        if not job_id:
            raise ValueError(f"No Job ID returned from deploy(). Result: {async_result}")
            
        # 6. Poll Deploy Status
        logger.info(f"Polling deployment status for Job ID: {job_id}")
        start_time = time.time()
        
        status_result = None
        while True:
            elapsed = time.time() - start_time
            if elapsed > MAX_POLL_WAIT_SECONDS:
                raise TimeoutError(f"Deployment timed out after {MAX_POLL_WAIT_SECONDS} seconds.")
                
            state, state_detail, deployment_detail, unit_test_detail = sf.mdapi.check_deploy_status(job_id)
            status = state
            logger.info(f"Deploy poll status: {status}")

            if status in ["Succeeded", "SucceededPartial", "Failed", "Canceled"]:
                status_result = {
                    "status": status,
                    "state_detail": state_detail,
                    "details": {
                        "componentFailures": [
                            {
                                "componentType": err.get("type"),
                                "fullName": err.get("file"),
                                "problem": err.get("message"),
                            }
                            for err in (deployment_detail or {}).get("errors", [])
                        ]
                    },
                }
                break
            time.sleep(3)
        
        logger.info(f"Deployment finished with status: {status}")
        try:
            import json
            res_str = json.dumps(status_result, default=str, indent=2)
            logger.debug(f"Deployment result: {res_str[:500]}...")
        except Exception:
            pass
            
        result = _parse_deployment_result(target_env, approved_actions, status_result, profile_mapping)
        _action_history.append(result)
        return result

    except Exception as e:
        logger.error(f"Deployment failed: {e}", exc_info=True)
        result = _build_mdapi_result(target_env, approved_actions, "Failed", str(e))
        _action_history.append(result)
        return result


def _build_profile_xml(actions: List[Dict], is_custom: bool = False) -> str:
    """
    Build a minimal Profile XML containing only the permissions we want to set.
    Salesforce merges this with the existing profile on deploy.
    """
    root = ET.Element(f"{{{SF_NAMESPACE}}}Profile")
    
    if is_custom:
        ET.SubElement(root, f"{{{SF_NAMESPACE}}}custom").text = "true"
    
    for action in actions:
        ctype = action.get("component_type")
        cname = action.get("component_name")
        target = action.get("target") or {}
        
        if ctype == "CustomField":
            node = ET.SubElement(root, f"{{{SF_NAMESPACE}}}fieldPermissions")
            ET.SubElement(node, f"{{{SF_NAMESPACE}}}editable").text = str(target.get('editable', False)).lower()
            ET.SubElement(node, f"{{{SF_NAMESPACE}}}field").text = cname
            ET.SubElement(node, f"{{{SF_NAMESPACE}}}readable").text = str(target.get('readable', False)).lower()
            
        elif ctype == "CustomObject":
            node = ET.SubElement(root, f"{{{SF_NAMESPACE}}}objectPermissions")
            ET.SubElement(node, f"{{{SF_NAMESPACE}}}allowCreate").text = str(target.get('allowCreate', False)).lower()
            ET.SubElement(node, f"{{{SF_NAMESPACE}}}allowDelete").text = str(target.get('allowDelete', False)).lower()
            ET.SubElement(node, f"{{{SF_NAMESPACE}}}allowEdit").text = str(target.get('allowEdit', False)).lower()
            ET.SubElement(node, f"{{{SF_NAMESPACE}}}allowRead").text = str(target.get('allowRead', False)).lower()
            ET.SubElement(node, f"{{{SF_NAMESPACE}}}modifyAllRecords").text = str(target.get('modifyAllRecords', False)).lower()
            ET.SubElement(node, f"{{{SF_NAMESPACE}}}object").text = cname
            ET.SubElement(node, f"{{{SF_NAMESPACE}}}viewAllRecords").text = str(target.get('viewAllRecords', False)).lower()
            
        elif ctype == "ApexClass":
            node = ET.SubElement(root, f"{{{SF_NAMESPACE}}}classAccesses")
            ET.SubElement(node, f"{{{SF_NAMESPACE}}}apexClass").text = cname
            ET.SubElement(node, f"{{{SF_NAMESPACE}}}enabled").text = str(target.get('enabled', False)).lower()
    
    ET.register_namespace('', SF_NAMESPACE)
    return ET.tostring(root, encoding="unicode", xml_declaration=True)


def _build_deployment_zip_from_scratch(profile_xmls: Dict[str, str]) -> str:
    """
    Build a deployment ZIP with package.xml and profile files.
    """
    # Build package.xml
    profile_names = []
    for filename in profile_xmls.keys():
        pname = filename.replace(".profile", "")
        profile_names.append(pname)
    
    package_xml = f'<?xml version="1.0" encoding="UTF-8"?>\n<Package xmlns="{SF_NAMESPACE}">\n'
    package_xml += "    <types>\n"
    for pname in sorted(set(profile_names)):
        package_xml += f"        <members>{pname}</members>\n"
    package_xml += "        <name>Profile</name>\n"
    package_xml += "    </types>\n"
    package_xml += "    <version>58.0</version>\n</Package>"
    
    # Build ZIP
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("package.xml", package_xml)
        for filename, xml_content in profile_xmls.items():
            # Salesforce expects the exact name from package.xml in the ZIP file for deployment
            # meaning no URL encoding for colons or spaces.
            pname = filename.replace(".profile", "")
            zf.writestr(f"profiles/{pname}.profile", xml_content)
    
    logger.info(f"Built deployment ZIP with {len(profile_xmls)} profiles")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def _parse_deployment_result(target_env, approved_actions, status_result, profile_mapping=None) -> Dict[str, Any]:
    profile_mapping = profile_mapping or {}
    
    # Extract overall deployment status
    deploy_status = status_result.get("status") if isinstance(status_result, dict) else getattr(status_result, "status", None)
    
    # Extract component-level failures
    failure_dict = {}
    details = status_result.get("details", {}) if isinstance(status_result, dict) else getattr(status_result, "details", {})
    if isinstance(details, dict):
        messages = details.get("componentFailures", [])
        if not isinstance(messages, list):
            messages = [messages]
        import urllib.parse
        for msg in messages:
            ctype = msg.get("componentType")
            fname = urllib.parse.unquote(str(msg.get("fullName"))) if msg.get("fullName") else ""
            problem = msg.get("problem")
            logger.error(f"Deployment component failure: {ctype}::{fname} — {problem}")
            failure_dict[f"{ctype}::{fname}"] = problem
            
    # Map back to actions
    synced = []
    failed = []
    
    if deploy_status in ["Succeeded", "SucceededPartial", "Failed"]:
        # Check individual components
        for act in approved_actions:
            ui_name = act.get('target_profile', '')
            mapping_info = profile_mapping.get(ui_name, {"api_name": ui_name})
            api_name = mapping_info.get("api_name", ui_name)
            profile_key = f"Profile::{api_name}"
            
            if profile_key in failure_dict:
                act["sync_status"] = "Failed"
                act["error"] = failure_dict[profile_key]
                failed.append(act)
            else:
                if deploy_status == "Failed":
                    act["sync_status"] = "Failed"
                    act["error"] = "Deployment failed. Check Salesforce deployment status."
                    failed.append(act)
                else:
                    act["sync_status"] = "Success"
                    synced.append(act)
    else:
        # Deployment completely failed or was canceled
        for act in approved_actions:
            act["sync_status"] = "Failed"
            act["error"] = f"Deployment {deploy_status or 'unknown status'}."
            failed.append(act)
            
    status = "Completed" if not failed else ("Completed with Errors" if synced else "Failed")
    return _build_mdapi_result(target_env, synced + failed, status, "Deployment finished.")

def _build_mdapi_result(target_env, details, status, msg) -> Dict:
    # Ensure every detail has a sync_status fallback just in case
    for d in details:
        if "sync_status" not in d:
            d["sync_status"] = "Failed" if status == "Failed" else "Success"
            
    return {
        "sync_id": str(uuid.uuid4())[:8],
        "target_env": target_env,
        "items_synced": len([d for d in details if d.get("sync_status") == "Success"]),
        "items_failed": len([d for d in details if d.get("sync_status") == "Failed"]),
        "status": status,
        "error": msg if status == "Failed" else "",
        "details": details,
        "synced_at": datetime.utcnow().isoformat(),
    }


def get_action_history() -> List[Dict[str, Any]]:
    """Return all past sync results, newest first."""
    if not _action_history:
        return []
    return sorted(_action_history, key=lambda s: s["synced_at"], reverse=True)


# ─────────────────────────────────────────────────────────────────────────────
# Internal Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _resolve_permission_set_id(
    sf,
    profile_name: str,
    cache: Dict[str, str],
) -> Optional[str]:
    """
    Resolve the PermissionSet.Id that is linked to the given Profile name.
    Profiles always have a corresponding PermissionSet row (ProfileId is set).
    Results are cached for the lifetime of this sync call.
    """
    if profile_name in cache:
        return cache[profile_name]

    query = (
        f"SELECT Id FROM PermissionSet "
        f"WHERE Profile.Name = '{_escape_soql(profile_name)}' "
        f"AND ProfileId != null LIMIT 1"
    )
    try:
        result = sf.query(query)
        records = result.get("records", [])
        if not records:
            logger.warning(f"No PermissionSet found for profile: {profile_name}")
            return None
        ps_id = records[0]["Id"]
        cache[profile_name] = ps_id
        return ps_id
    except Exception as e:
        logger.error(f"SOQL error resolving PermissionSet for '{profile_name}': {e}")
        return None


def _sync_apex_class_access(sf, ps_id: str, class_name: str, desired: dict):
    """
    Grant or revoke ApexClass access via SetupEntityAccess (Tooling API).
    Salesforce does not support Update on SetupEntityAccess — insert/delete only.
    """
    enabled = desired.get("enabled", False)

    # Get the ApexClass Id
    class_result = sf.query(
        f"SELECT Id FROM ApexClass WHERE Name = '{_escape_soql(class_name)}' LIMIT 1"
    )
    classes = class_result.get("records", [])
    if not classes:
        raise ValueError(f"ApexClass '{class_name}' not found in target org")
    class_id = classes[0]["Id"]

    # Check if access already exists via Tooling API
    existing = sf.toolingexecute(
        "query",
        method="GET",
        additional_headers=None,
        data=None,
        params={
            "q": (
                f"SELECT Id FROM SetupEntityAccess "
                f"WHERE SetupEntityId = '{class_id}' "
                f"AND ParentId = '{ps_id}'"
            )
        },
    )
    records = existing.get("records", [])

    if enabled and not records:
        # Grant access — insert a new SetupEntityAccess row
        sf.toolingexecute(
            "sobjects/SetupEntityAccess",
            method="POST",
            data={"SetupEntityId": class_id, "ParentId": ps_id},
        )
        logger.debug(f"Granted ApexClass access: {class_name} → PS {ps_id}")

    elif not enabled and records:
        # Revoke access — delete existing row
        row_id = records[0]["Id"]
        sf.toolingexecute(
            f"sobjects/SetupEntityAccess/{row_id}",
            method="DELETE",
        )
        logger.debug(f"Revoked ApexClass access: {class_name} → PS {ps_id}")

    else:
        logger.debug(f"No change needed for ApexClass {class_name} (enabled={enabled})")


def _sync_field_permission(sf, ps_id: str, field_api_name: str, desired: dict):
    """
    Upsert FieldPermissions for the given field + PermissionSet.
    """
    readable = desired.get("readable", False)
    editable = desired.get("editable", False)

    # Determine the SobjectType from the field name (format: "Object.Field")
    if "." in field_api_name:
        sobject_type = field_api_name.split(".")[0]
    else:
        sobject_type = None

    # Check for existing record
    query = (
        f"SELECT Id FROM FieldPermissions "
        f"WHERE ParentId = '{ps_id}' "
        f"AND Field = '{_escape_soql(field_api_name)}' LIMIT 1"
    )
    result = sf.query_all(query)
    records = result.get("records", [])

    payload = {
        "ParentId": ps_id,
        "Field": field_api_name,
        "PermissionsRead": readable,
        "PermissionsEdit": editable,
    }
    if sobject_type:
        payload["SobjectType"] = sobject_type

    if not readable and not editable:
        # Cannot insert/update a FieldPermissions record with both false. Must delete it.
        if records:
            sf.FieldPermissions.delete(records[0]["Id"])
            logger.debug(f"Deleted FieldPermission: {field_api_name}")
        else:
            logger.debug(f"No FieldPermission to delete: {field_api_name}")
        return

    if records:
        # Update existing
        row_id = records[0]["Id"]
        sf.FieldPermissions.update(row_id, {
            "PermissionsRead": readable,
            "PermissionsEdit": editable,
        })
        logger.debug(f"Updated FieldPermission: {field_api_name}")
    else:
        # Insert new
        sf.FieldPermissions.create(payload)
        logger.debug(f"Created FieldPermission: {field_api_name}")


def _sync_object_permission(sf, ps_id: str, sobject_type: str, desired: dict):
    """
    Upsert ObjectPermissions for the given SObject type + PermissionSet.
    """
    query = (
        f"SELECT Id FROM ObjectPermissions "
        f"WHERE ParentId = '{ps_id}' "
        f"AND SobjectType = '{_escape_soql(sobject_type)}' LIMIT 1"
    )
    result = sf.query_all(query)
    records = result.get("records", [])

    payload = {
        "ParentId": ps_id,
        "SobjectType": sobject_type,
        "PermissionsCreate": desired.get("allowCreate", False),
        "PermissionsRead": desired.get("allowRead", False),
        "PermissionsEdit": desired.get("allowEdit", False),
        "PermissionsDelete": desired.get("allowDelete", False),
        "PermissionsViewAllRecords": desired.get("viewAllRecords", False),
        "PermissionsModifyAllRecords": desired.get("modifyAllRecords", False),
    }

    # If all permissions are false, we must delete the record, not insert/update it
    has_any_perm = any([
        payload["PermissionsCreate"], payload["PermissionsRead"],
        payload["PermissionsEdit"], payload["PermissionsDelete"],
        payload["PermissionsViewAllRecords"], payload["PermissionsModifyAllRecords"]
    ])

    if not has_any_perm:
        if records:
            sf.ObjectPermissions.delete(records[0]["Id"])
            logger.debug(f"Deleted ObjectPermission: {sobject_type}")
        else:
            logger.debug(f"No ObjectPermission to delete: {sobject_type}")
        return

    if records:
        row_id = records[0]["Id"]
        # Remove non-updateable fields
        update_payload = {k: v for k, v in payload.items() if k not in ("ParentId", "SobjectType")}
        sf.ObjectPermissions.update(row_id, update_payload)
        logger.debug(f"Updated ObjectPermission: {sobject_type}")
    else:
        sf.ObjectPermissions.create(payload)
        logger.debug(f"Created ObjectPermission: {sobject_type}")


def _escape_soql(value: str) -> str:
    """Escape single quotes in SOQL string literals."""
    return value.replace("'", "\\'")