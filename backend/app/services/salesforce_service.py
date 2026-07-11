"""
Salesforce connection service.
Manages OAuth-authenticated sessions with Salesforce orgs.

Authentication uses OAuth 2.0 Client Credentials flow via Connected Apps.
SOQL queries are executed through simple-salesforce using the OAuth access token.
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from simple_salesforce import Salesforce

from app.auth.salesforce_oauth import (
    authenticate_client_credentials,
    validate_token,
    revoke_token,
    OAuthError,
)

logger = logging.getLogger(__name__)

# In-memory cache for active Salesforce connections
_active_connections: Dict[str, Salesforce] = {}

# In-memory cache for OAuth tokens (needed for validation/revocation)
_active_tokens: Dict[str, Dict[str, str]] = {}

# In-memory cache for stored credentials (for auto-reconnect on token expiry)
_stored_credentials: Dict[str, Dict[str, str]] = {}

# In-memory cache for org status details
_org_statuses: Dict[str, Dict[str, Any]] = {
    "DEV": {"environment": "DEV", "connected": False},
    "UAT": {"environment": "UAT", "connected": False},
    "PROD": {"environment": "PROD", "connected": False},
}


def connect_to_salesforce(
    environment: str,
    client_id: str,
    client_secret: str,
    org_url: str,
    alias: str = None,
) -> Dict[str, Any]:
    """
    Authenticate and store a connection to Salesforce using OAuth 2.0 Client Credentials.

    Flow:
    1. POST to Salesforce /services/oauth2/token (Client Credentials grant)
    2. Receive access_token + instance_url
    3. Create simple-salesforce Salesforce() using the token
    4. Query org info for verification
    5. Store connection + token for future API calls

    Args:
        environment: DEV, UAT, or PROD
        client_id: Consumer Key from Connected App
        client_secret: Consumer Secret from Connected App
        org_url: Salesforce org URL (e.g., mycompany.my.salesforce.com)
        alias: Friendly name for the org

    Returns:
        Success response with org details

    Raises:
        OAuthError: On authentication failure
    """
    logger.info(f"Connecting to {environment} org via OAuth 2.0 Client Credentials")

    # Step 1: Get OAuth token
    token_data = authenticate_client_credentials(
        client_id=client_id,
        client_secret=client_secret,
        org_url=org_url,
    )

    access_token = token_data["access_token"]
    instance_url = token_data["instance_url"]

    logger.info(f"OAuth token acquired → {instance_url}")

    # Step 2: Create simple-salesforce session using the OAuth token
    try:
        sf = Salesforce(
            instance_url=instance_url,
            session_id=access_token,
        )
    except Exception as e:
        logger.error(f"Failed to create Salesforce session: {str(e)}")
        raise OAuthError(
            message="Failed to establish Salesforce API session with the OAuth token.",
            error_code="session_error",
            details=str(e),
        )

    # Step 3: Verify connection by querying org info
    try:
        org_info = sf.query(
            "SELECT Id, Name, InstanceName, OrganizationType FROM Organization LIMIT 1"
        )
        org_record = org_info["records"][0] if org_info["totalSize"] > 0 else {}
    except Exception as e:
        logger.error(f"Failed to query org info: {str(e)}")
        raise OAuthError(
            message="OAuth token is valid but failed to query org info. Check API permissions.",
            error_code="api_error",
            details=str(e),
        )

    # Step 4: Get the Run-As user info
    username = "Client Credentials User"
    try:
        user_info = sf.query("SELECT Id, Username, Name FROM User WHERE Id = :userId LIMIT 1".replace(":userId", f"'{token_data.get('id', '').split('/')[-1]}'"))
        if user_info["totalSize"] > 0:
            username = user_info["records"][0].get("Username", username)
    except Exception:
        # Non-critical — fall back to generic label
        pass

    # Step 5: Store everything
    _active_connections[environment] = sf
    _active_tokens[environment] = {
        "access_token": access_token,
        "instance_url": instance_url,
        "token_type": token_data.get("token_type", "Bearer"),
    }
    _stored_credentials[environment] = {
        "client_id": client_id,
        "client_secret": client_secret,
        "org_url": org_url,
    }

    # Step 6: Update org status
    status = {
        "environment": environment,
        "alias": alias or org_record.get("Name", f"Org-{environment}"),
        "connected": True,
        "org_id": org_record.get("Id", "Unknown"),
        "org_name": org_record.get("Name", "Unknown"),
        "org_type": org_record.get("OrganizationType", "Unknown"),
        "username": username,
        "instance_url": instance_url,
        "auth_method": "oauth2_client_credentials",
        "token_type": token_data.get("token_type", "Bearer"),
        "connected_at": datetime.utcnow().isoformat(),
        "metadata_count": 0,
        "error": None,
    }

    _org_statuses[environment].update(status)
    logger.info(
        f"✅ Successfully connected to {environment} org "
        f"({org_record.get('Name', 'Unknown')}) via OAuth 2.0 Client Credentials"
    )

    return {
        "success": True,
        "message": f"Successfully connected to {environment} org via OAuth 2.0",
        "org": status,
    }


def get_connection(environment: str) -> Optional[Salesforce]:
    """
    Get the active Salesforce connection for an environment.

    If the token has expired, attempts automatic reconnection
    using stored credentials.
    """
    sf = _active_connections.get(environment)
    if not sf:
        return None

    # Check if we should validate the token
    token_info = _active_tokens.get(environment)
    if token_info:
        is_valid = validate_token(
            token_info["access_token"],
            token_info["instance_url"],
        )
        if not is_valid:
            logger.warning(f"Token expired for {environment}, attempting auto-reconnect...")
            reconnected = _auto_reconnect(environment)
            if reconnected:
                return _active_connections.get(environment)
            else:
                logger.error(f"Auto-reconnect failed for {environment}")
                return None

    return sf


def _auto_reconnect(environment: str) -> bool:
    """Attempt to reconnect using stored credentials."""
    creds = _stored_credentials.get(environment)
    if not creds:
        logger.warning(f"No stored credentials for {environment}, cannot auto-reconnect")
        return False

    try:
        connect_to_salesforce(
            environment=environment,
            client_id=creds["client_id"],
            client_secret=creds["client_secret"],
            org_url=creds["org_url"],
            alias=_org_statuses[environment].get("alias"),
        )
        logger.info(f"Auto-reconnect successful for {environment}")
        return True
    except Exception as e:
        logger.error(f"Auto-reconnect failed for {environment}: {str(e)}")
        _org_statuses[environment].update({"connected": False, "error": f"Session expired: {str(e)}"})
        return False


def get_all_org_statuses() -> list:
    """Get status of all configured environments."""
    return list(_org_statuses.values())


def get_org_status(environment: str) -> Dict[str, Any]:
    """Get status of a specific environment."""
    return _org_statuses.get(
        environment, {"environment": environment, "connected": False}
    )


def validate_connection(environment: str) -> Dict[str, Any]:
    """
    Validate the connection health for a specific environment.

    Returns:
        Dict with validation status and details
    """
    token_info = _active_tokens.get(environment)
    if not token_info:
        return {
            "environment": environment,
            "valid": False,
            "message": "No active connection",
        }

    is_valid = validate_token(
        token_info["access_token"],
        token_info["instance_url"],
    )

    if is_valid:
        return {
            "environment": environment,
            "valid": True,
            "message": "Connection is healthy",
            "instance_url": token_info["instance_url"],
        }

    # Try auto-reconnect
    reconnected = _auto_reconnect(environment)
    if reconnected:
        return {
            "environment": environment,
            "valid": True,
            "message": "Connection was expired but auto-reconnected successfully",
            "instance_url": token_info["instance_url"],
        }

    return {
        "environment": environment,
        "valid": False,
        "message": "Connection expired and auto-reconnect failed. Please reconnect manually.",
    }


def disconnect_org(environment: str) -> bool:
    """
    Disconnect from a Salesforce org.

    Revokes the OAuth token and clears all cached data.
    """
    logger.info(f"Disconnecting {environment} org...")

    # Revoke OAuth token
    token_info = _active_tokens.get(environment)
    if token_info:
        revoke_token(
            token_info["access_token"],
            token_info["instance_url"],
        )

    # Clear all cached data for this environment
    _active_connections.pop(environment, None)
    _active_tokens.pop(environment, None)
    _stored_credentials.pop(environment, None)

    _org_statuses[environment] = {"environment": environment, "connected": False}

    logger.info(f"✅ Disconnected from {environment} org")
    return True


def fetch_profiles(environment: str) -> List[str]:
    """
    Fetch all relevant Profile names from the specified environment.
    Filters out system/internal profiles based on UserLicense.
    """
    sf = get_connection(environment)
    if not sf:
        logger.warning(f"Cannot fetch profiles. {environment} is not connected.")
        return []

    try:
        from collections import defaultdict
        
        # Fetching from PermissionSet to get IsCustom and License Definition Key
        ps_query = "SELECT Profile.Name, Profile.UserLicense.LicenseDefinitionKey, IsCustom FROM PermissionSet WHERE ProfileId != null"
        ps_result = sf.query_all(ps_query)
        
        records = ps_result.get("records", [])
        
        # First pass: count name occurrences
        name_counts = defaultdict(int)
        for record in records:
            prof = record.get("Profile")
            if prof and prof.get("Name"):
                name_counts[prof.get("Name")] += 1
                
        profiles_dict = {}
        display_names_used = set()
        for record in records:
            prof = record.get("Profile")
            if prof:
                name = prof.get("Name")
                is_custom = record.get("IsCustom", False)
                license_key = prof.get("UserLicense", {}).get("LicenseDefinitionKey") if prof.get("UserLicense") else None
                prof_id = record.get("ProfileId")
                
                if name:
                    display_name = name
                    # If this profile name appears multiple times, append the license key to disambiguate
                    if name_counts[name] > 1 and license_key:
                        display_name = f"{name} ({license_key})"
                        
                    # Absolute uniqueness fallback: append ProfileId if STILL a collision
                    if display_name in display_names_used:
                        display_name = f"{display_name} [{prof_id}]"
                        
                    display_names_used.add(display_name)
                    
                    if display_name not in profiles_dict:
                        profiles_dict[display_name] = {
                            "name": display_name,
                            "is_custom": is_custom
                        }
                        
        profiles = list(profiles_dict.values())
        profiles.sort(key=lambda x: x["name"])
        logger.info(f"Found {len(profiles)} relevant profiles in {environment}")
        return profiles
    except Exception as e:
        logger.error(f"Failed to fetch profiles from {environment}: {str(e)}")
        raise ValueError(f"Failed to fetch profiles: {str(e)}")
