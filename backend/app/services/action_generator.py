"""
Action Generator Service.
Generates Salesforce XML snippets from approved actions.
"""
from typing import List, Dict, Any

def generate_deployment_xml(approved_actions: List[Dict[str, Any]]) -> Dict[str, str]:
    """
    Takes a list of approved actions and generates XML strings grouped by Profile.
    Returns: {"ProfileName": "<xml_string>"}
    """
    profiles_xml = {}

    for action in approved_actions:
        profile = action.get("profile")
        if not profile:
            continue
            
        if profile not in profiles_xml:
            profiles_xml[profile] = []
            
        c_type = action.get("component_type")
        c_name = action.get("component_name")
        target = action.get("target") or {} # The target permissions dict we want to deploy
        
        if c_type == "ApexClass":
            xml = f"""    <classAccesses>
        <apexClass>{c_name}</apexClass>
        <enabled>{str(target.get("enabled", True)).lower()}</enabled>
    </classAccesses>"""
            profiles_xml[profile].append(xml)
            
        elif c_type == "CustomField":
            xml = f"""    <fieldPermissions>
        <field>{c_name}</field>
        <editable>{str(target.get("editable", False)).lower()}</editable>
        <readable>{str(target.get("readable", False)).lower()}</readable>
    </fieldPermissions>"""
            profiles_xml[profile].append(xml)
            
        elif c_type == "CustomObject":
            xml = f"""    <objectPermissions>
        <object>{c_name}</object>
        <allowCreate>{str(target.get("allowCreate", False)).lower()}</allowCreate>
        <allowDelete>{str(target.get("allowDelete", False)).lower()}</allowDelete>
        <allowEdit>{str(target.get("allowEdit", False)).lower()}</allowEdit>
        <allowRead>{str(target.get("allowRead", False)).lower()}</allowRead>
        <modifyAllRecords>{str(target.get("modifyAllRecords", False)).lower()}</modifyAllRecords>
        <viewAllRecords>{str(target.get("viewAllRecords", False)).lower()}</viewAllRecords>
    </objectPermissions>"""
            profiles_xml[profile].append(xml)

    # Wrap in Profile node
    final_xml = {}
    for profile, snippets in profiles_xml.items():
        joined_snippets = "\n".join(snippets)
        final_xml[profile] = f"""<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
{joined_snippets}
</Profile>"""

    return final_xml
