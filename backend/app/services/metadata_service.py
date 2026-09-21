"""
Targeted metadata retrieval service.
Executes SOQL queries against connected Salesforce orgs to fetch specific component permissions.
"""

import logging
import urllib.parse
import zipfile
import io
import base64
import time
import xml.etree.ElementTree as ET
from typing import Dict, Any, List, Optional
from datetime import datetime
from app.services.salesforce_service import get_connection, _org_statuses
from app.services.impact_engine import determine_required_permissions

logger = logging.getLogger(__name__)

# Single API version used for all Tooling, REST, and Metadata API calls.
SF_API_VERSION = "60.0"
SF_NAMESPACE = "http://soap.sforce.com/2006/04/metadata"

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
                "name":              dname,
                "fieldPermissions":  [],
                "objectPermissions": [],
                "classAccesses":     [],
                "tabVisibilities":   [],
                "layoutAssignments": [],
                "flowAccesses":      [],
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
            resolved_obj = _resolve_object_api_name(sf, component_name)
            obj_query = f"""
                SELECT ParentId, SobjectType, PermissionsCreate, PermissionsRead, 
                       PermissionsEdit, PermissionsDelete, PermissionsViewAllRecords, PermissionsModifyAllRecords 
                FROM ObjectPermissions
                WHERE SobjectType = '{resolved_obj}'
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

        if "flowAccesses" in required_perms:
            flow_def_id = _resolve_flow_definition_id(sf, component_name)
            if not flow_def_id:
                logger.warning(
                    f"FlowAccess: Could not resolve FlowDefinition Id for '{component_name}'. "
                    f"Verify the flow exists in the org."
                )
            else:
                access_records = sf.query_all(
                    f"SELECT ParentId FROM SetupEntityAccess "
                    f"WHERE SetupEntityId = '{flow_def_id}' "
                    f"AND SetupEntityType = 'FlowDefinition'"
                ).get('records', [])

                for record in access_records:
                    ps_id = record.get('ParentId')
                    profile_name = ps_to_display_name.get(ps_id)
                    if profile_name and profile_name in snapshot["profiles"]:
                        snapshot["profiles"][profile_name]["flowAccesses"].append({
                            "flow":    component_name,
                            "enabled": True
                        })
                # Profiles absent from access_records implicitly have enabled=False
                # (DeepDiff treats an empty list vs a populated list as a difference)


        if "tabVisibilities" in required_perms:
            # Resolve canonical tab name (e.g. 'Audits' or 'Audit' -> 'Audit__c')
            resolved_tab = _resolve_tab_api_name(sf, component_name)
            logger.info(f"CustomTab: Resolved '{component_name}' to '{resolved_tab}'")

            # Collect profile display_name -> API FullName mapping
            profiles_in_snapshot = list(snapshot["profiles"].keys())
            display_to_api = {}
            for display_name in profiles_in_snapshot:
                api_name = _resolve_profile_api_name(sf, display_name)
                if api_name:
                    display_to_api[display_name] = api_name

            if display_to_api:
                profile_api_names = list(set(display_to_api.values()))
                # Single bulk retrieve: profiles + CustomTab in ONE call
                profile_xmls = _retrieve_profiles_bulk(sf, profile_api_names, custom_tab=resolved_tab)
                
                for display_name, api_name in display_to_api.items():
                    root = profile_xmls.get(api_name)
                    found_tab = False
                    if root is not None:
                        for tab_node in root.findall(f"{{{SF_NAMESPACE}}}tabVisibilities"):
                            t_name = tab_node.findtext(f"{{{SF_NAMESPACE}}}tab", "")
                            visibility = tab_node.findtext(f"{{{SF_NAMESPACE}}}visibility", "Hidden")
                            if t_name.lower() == resolved_tab.lower() or t_name.lower() == component_name.lower():
                                snapshot["profiles"][display_name]["tabVisibilities"].append({
                                    "tab": resolved_tab,
                                    "visibility": visibility   # DefaultOn | DefaultOff | Hidden
                                })
                                found_tab = True
                                break
                    if not found_tab:
                        # In Salesforce, if a tabVisibility is not declared in the profile, it is effectively Hidden
                        snapshot["profiles"][display_name]["tabVisibilities"].append({
                            "tab": resolved_tab,
                            "visibility": "Hidden"
                        })


        if "layoutAssignments" in required_perms:
            # PRIMARY: Tooling API ProfileLayout
            # component_name should be in Salesforce format: "ObjectName-Layout Name"
            layout_name_escaped = urllib.parse.quote(
                f"SELECT Profile.Name, Layout.Name, RecordType.Name "
                f"FROM ProfileLayout WHERE Layout.Name = '{component_name}'"
            )
            try:
                tooling_res = sf.toolingexecute(f"query/?q={layout_name_escaped}")
                records = tooling_res.get("records", [])
                if not records:
                    raise ValueError("ProfileLayout returned no rows — falling back to Metadata API")

                for r in records:
                    raw_name = (r.get('Profile') or {}).get('Name', '')
                    # Match raw Salesforce profile name to our display name
                    profile_display = _match_display_name(raw_name, snapshot["profiles"])
                    if profile_display:
                        snapshot["profiles"][profile_display]["layoutAssignments"].append({
                            "layout":     (r.get('Layout') or {}).get('Name', ''),
                            "recordType": (r.get('RecordType') or {}).get('Name') or None
                        })

            except Exception as tooling_err:
                logger.warning(
                    f"PageLayout Tooling API path failed ({tooling_err}). "
                    f"Falling back to Metadata API profile retrieve."
                )
                # FALLBACK: Retrieve each profile's XML and parse <layoutAssignments>
                for display_name in list(snapshot["profiles"].keys()):
                    api_name = _resolve_profile_api_name(sf, display_name)
                    if not api_name:
                        continue
                    root = _retrieve_profile_xml(sf, api_name)
                    if root is None:
                        continue
                    for node in root.findall(f"{{{SF_NAMESPACE}}}layoutAssignments"):
                        layout_val = node.findtext(f"{{{SF_NAMESPACE}}}layout", "")
                        rt_val     = node.findtext(f"{{{SF_NAMESPACE}}}recordType")
                        if layout_val == component_name:
                            snapshot["profiles"][display_name]["layoutAssignments"].append({
                                "layout":     layout_val,
                                "recordType": rt_val
                            })

        return snapshot

    except Exception as e:
        logger.error(f"Error during component metadata retrieval: {str(e)}")
        raise ValueError(f"Failed to retrieve metadata: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# Shared helpers for Metadata API profile retrieval
# ─────────────────────────────────────────────────────────────────────────────

def _resolve_profile_api_name(sf, display_name: str) -> Optional[str]:
    """
    Resolve a profile's display name (with possible license-key or ID suffix)
    to its Metadata API FullName by querying the Tooling API.
    Returns None if resolution fails.
    """
    import re
    # Strip " [ProfileId]" and " (LicenseKey)" suffixes added during dedup
    base = re.sub(r'\s*\[.*?\]$', '', display_name)
    base = re.sub(r'\s*\(.*?\)$', '', base).strip()
    try:
        # Fetch ProfileId first
        result = sf.query(
            f"SELECT ProfileId FROM PermissionSet WHERE Profile.Name = '{base}' "
            f"AND ProfileId != null LIMIT 1"
        )
        records = result.get('records', [])
        if not records:
            return base   # best-effort fallback: use base name as API name
        prof_id = records[0]['ProfileId']
        # Fetch FullName from Tooling API for exact metadata API name
        q = urllib.parse.quote(f"SELECT FullName FROM Profile WHERE Id = '{prof_id}'")
        res = sf.toolingexecute(f"query/?q={q}")
        tool_records = res.get('records', [])
        if tool_records and tool_records[0].get('FullName'):
            return tool_records[0]['FullName']
        return base
    except Exception as e:
        logger.warning(f"_resolve_profile_api_name failed for '{display_name}': {e}")
        return base


def _resolve_flow_definition_id(sf, input_name: str) -> Optional[str]:
    """
    Resolves a Flow name (DeveloperName, ApiName, FullName, Label, or DurableId)
    to its 18-character Tooling API FlowDefinition Id (SetupEntityId for SetupEntityAccess).
    """
    clean = input_name.strip()
    if not clean:
        return None

    # If it's already an 18-char or 15-char 300 ID
    if clean.startswith("300") and len(clean) in (15, 18):
        return clean

    # 1. Query Tooling API FlowDefinition by DeveloperName
    try:
        if "__" in clean and not clean.endswith("__c"):
            parts = clean.split("__", 1)
            ns = parts[0]
            dev_name = parts[1]
            q = urllib.parse.quote(
                f"SELECT Id, DeveloperName FROM FlowDefinition "
                f"WHERE DeveloperName = '{dev_name}' AND NamespacePrefix = '{ns}' LIMIT 1"
            )
        else:
            q = urllib.parse.quote(
                f"SELECT Id, DeveloperName FROM FlowDefinition "
                f"WHERE DeveloperName = '{clean}' LIMIT 1"
            )
        res = sf.toolingexecute(f"query/?q={q}")
        records = res.get("records", [])
        if records and records[0].get("Id"):
            return records[0]["Id"]
    except Exception as e:
        logger.debug(f"FlowDefinition query failed: {e}")

    # 2. Check Tooling API Flow by MasterLabel
    try:
        q = urllib.parse.quote(
            f"SELECT DefinitionId FROM Flow WHERE MasterLabel = '{clean}' LIMIT 1"
        )
        res = sf.toolingexecute(f"query/?q={q}")
        records = res.get("records", [])
        if records and records[0].get("DefinitionId"):
            return records[0]["DefinitionId"]
    except Exception as e:
        logger.debug(f"Flow MasterLabel query failed: {e}")

    # 3. Check FlowDefinitionView (standard SOQL) to map Label or DurableId to ApiName
    try:
        res = sf.query(
            f"SELECT ApiName, NamespacePrefix FROM FlowDefinitionView "
            f"WHERE ApiName = '{clean}' OR DurableId = '{clean}' OR Label = '{clean}' LIMIT 1"
        )
        records = res.get("records", [])
        if records:
            api_name = records[0]["ApiName"]
            ns = records[0].get("NamespacePrefix")
            if ns:
                q = urllib.parse.quote(
                    f"SELECT Id FROM FlowDefinition "
                    f"WHERE DeveloperName = '{api_name}' AND NamespacePrefix = '{ns}' LIMIT 1"
                )
            else:
                q = urllib.parse.quote(
                    f"SELECT Id FROM FlowDefinition "
                    f"WHERE DeveloperName = '{api_name}' LIMIT 1"
                )
            res_t = sf.toolingexecute(f"query/?q={q}")
            tool_recs = res_t.get("records", [])
            if tool_recs and tool_recs[0].get("Id"):
                return tool_recs[0]["Id"]
    except Exception as e:
        logger.debug(f"FlowDefinitionView mapping failed: {e}")

    return None


def _resolve_tab_api_name(sf, input_name: str) -> str:
    """
    Resolves an input tab name/label (e.g. 'Audits', 'Audit', 'Audit__c')
    to its canonical TabDefinition Name used by Salesforce in Profile XML (e.g. 'Audit__c').
    """
    clean_input = input_name.strip()
    try:
        res = sf.query_all("SELECT DurableId, Name, Label FROM TabDefinition")
        records = res.get("records", [])

        # 1. Exact match on Name (case-insensitive)
        for r in records:
            if (r.get("Name") or "").lower() == clean_input.lower():
                return r["Name"]

        # 2. Exact match on Label (e.g. 'Audits' -> 'Audit__c')
        for r in records:
            if (r.get("Label") or "").lower() == clean_input.lower():
                return r["Name"]

        # 3. Match appending '__c'
        for r in records:
            if (r.get("Name") or "").lower() == f"{clean_input.lower()}__c":
                return r["Name"]

        # 4. Partial substring match in Label or Name
        for r in records:
            r_label = (r.get("Label") or "").lower()
            r_name = (r.get("Name") or "").lower()
            if clean_input.lower() in r_label or clean_input.lower() in r_name:
                return r["Name"]

    except Exception as e:
        logger.warning(f"Failed to query TabDefinition for tab resolution: {e}")

    return clean_input


def _resolve_object_api_name(sf, input_name: str) -> str:
    """
    Ensures custom object has '__c' if needed by querying CustomObject in Tooling API or standard objects.
    """
    clean = input_name.strip()
    if clean.endswith("__c"):
        return clean

    try:
        # Check standard objects first (Account, Contact, etc.)
        res = sf.query(f"SELECT SobjectType FROM ObjectPermissions WHERE SobjectType = '{clean}' LIMIT 1")
        if res.get("totalSize", 0) > 0:
            return clean

        # Check CustomObject in Tooling API
        q = urllib.parse.quote(f"SELECT DeveloperName FROM CustomObject WHERE DeveloperName = '{clean}' LIMIT 1")
        res_t = sf.toolingexecute(f"query/?q={q}")
        if res_t.get("records"):
            return f"{clean}__c"
    except Exception:
        pass

    return clean


def _retrieve_profiles_bulk(
    sf,
    profile_api_names: List[str],
    custom_tab: Optional[str] = None,
    timeout: int = 45,
) -> Dict[str, ET.Element]:
    """
    Retrieve multiple Profile metadata XMLs in ONE single Metadata API retrieve call.
    Returns {profile_api_name: ET.Element}.
    """
    results: Dict[str, ET.Element] = {}
    if not profile_api_names:
        return results

    try:
        unpackaged: Dict[str, List[str]] = {'Profile': profile_api_names}
        if custom_tab:
            unpackaged['CustomTab'] = [custom_tab]

        # Trigger retrieve via simple_salesforce
        # simple_salesforce expects: retrieve(async_process_id, single_package=True, unpackaged=...)
        async_id, state = sf.mdapi.retrieve(
            '',
            single_package=True,
            unpackaged=unpackaged,
        )

        if not async_id:
            logger.warning("Bulk profile retrieve did not return an async process id")
            return results

        logger.info(f"Bulk profile retrieve started (job: {async_id}) for {len(profile_api_names)} profiles")

        start = time.time()
        while time.time() - start < timeout:
            time.sleep(2)
            try:
                state, err, msgs = sf.mdapi.check_retrieve_status(async_id)
            except Exception as status_err:
                logger.debug(f"check_retrieve_status check: {status_err}")
                continue

            if state in ('Succeeded', 'Failed'):
                if state == 'Failed':
                    logger.warning(f"Bulk profile retrieve failed: {err} | {msgs}")
                    return results

                try:
                    _, _, _, zip_bytes = sf.mdapi.retrieve_zip(async_id)
                except Exception as zip_err:
                    logger.warning(f"retrieve_zip error: {zip_err}")
                    return results

                if zip_bytes:
                    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
                        for name in zf.namelist():
                            if name.endswith('.profile'):
                                pname = name.replace('profiles/', '').replace('.profile', '')
                                xml_bytes = zf.read(name)
                                try:
                                    results[pname] = ET.fromstring(xml_bytes)
                                except Exception as parse_err:
                                    logger.warning(f"Failed to parse XML for profile {name}: {parse_err}")
                break

        logger.info(f"Bulk profile retrieve finished: {len(results)} profile XMLs parsed in {time.time() - start:.1f}s")
        return results


    except Exception as e:
        logger.warning(f"_retrieve_profiles_bulk failed: {e}")
        return results


def _retrieve_profile_xml(sf, api_name: str) -> Optional[ET.Element]:
    """
    Retrieve a single Profile's metadata XML via Metadata API and return the
    parsed ElementTree root element. Returns None if retrieval fails.
    """
    res = _retrieve_profiles_bulk(sf, [api_name])
    return res.get(api_name)



def _match_display_name(raw_profile_name: str, profiles_dict: dict) -> Optional[str]:
    """
    Match a raw Salesforce profile name (from Tooling API) to one of the display
    names we built during the ps_to_display_name dedup step.
    Tries exact match first, then startswith fallback.
    """
    if raw_profile_name in profiles_dict:
        return raw_profile_name
    for display_name in profiles_dict:
        # Display names may have ' (LicenseKey)' or ' [ProfileId]' suffixes
        if display_name.startswith(raw_profile_name):
            return display_name
    return None
