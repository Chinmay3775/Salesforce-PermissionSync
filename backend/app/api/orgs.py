"""API routes for Salesforce org connections (OAuth 2.0 Client Credentials)."""

import logging
from fastapi import APIRouter, HTTPException
from typing import List
from datetime import datetime

from app.services.salesforce_service import (
    connect_to_salesforce,
    get_all_org_statuses,
    disconnect_org as service_disconnect,
    validate_connection as service_validate,
    fetch_profiles as service_fetch_profiles,
)
from app.auth.salesforce_oauth import OAuthError

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/connect-org")
async def connect_org(request: dict):
    """
    Connect to a Salesforce org using OAuth 2.0 Client Credentials flow.

    Required fields:
        - environment: DEV, UAT, or PROD
        - client_id: Consumer Key from Connected App
        - client_secret: Consumer Secret from Connected App
        - org_url: Salesforce org URL (e.g., mycompany.my.salesforce.com)
        - alias: Friendly name for the org (optional)
    """
    environment = request.get("environment", "DEV")
    alias = request.get("alias", f"Org-{environment}")
    client_id = request.get("client_id", "")
    client_secret = request.get("client_secret", "")
    org_url = request.get("org_url", "")

    # Validate required fields
    missing = []
    if not client_id:
        missing.append("Client ID")
    if not client_secret:
        missing.append("Client Secret")
    if not org_url:
        missing.append("Org URL")

    if missing:
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "message": f"Missing required fields: {', '.join(missing)}",
                "error_code": "missing_fields",
            },
        )

    logger.info(f"OAuth connection request: {environment} org '{alias}' → {org_url}")

    try:
        result = connect_to_salesforce(
            environment=environment,
            client_id=client_id,
            client_secret=client_secret,
            org_url=org_url,
            alias=alias,
        )
        return result

    except OAuthError as e:
        logger.error(f"OAuth error for {environment}: {e.error_code} — {e.message}")
        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "message": e.message,
                "error_code": e.error_code,
                "details": e.details,
            },
        )
    except Exception as e:
        logger.error(f"Unexpected connection error for {environment}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "message": f"Unexpected error: {str(e)}",
                "error_code": "internal_error",
            },
        )


@router.get("/environment-status")
async def environment_status():
    """Get connection status for all environments."""
    statuses = get_all_org_statuses()
    return {
        "environments": statuses,
        "total_connected": sum(1 for s in statuses if s.get("connected")),
    }


@router.post("/validate-connection")
async def validate_connection(request: dict):
    """Validate the connection health for a specific environment."""
    environment = request.get("environment", "DEV")
    result = service_validate(environment)
    return result


@router.post("/disconnect-org")
async def disconnect_org(request: dict):
    """Disconnect a Salesforce org and revoke its OAuth token."""
    environment = request.get("environment", "DEV")

    success = service_disconnect(environment)
    if success:
        return {
            "success": True,
            "message": f"Disconnected from {environment} org. OAuth token revoked.",
        }

    return {
        "success": False,
        "message": f"Could not disconnect {environment} org",
    }


@router.get("/profiles")
async def list_profiles(environment: str = "DEV"):
    """
    Fetch all Profile names from a connected Salesforce org.

    Query param:
        environment: DEV, UAT, or PROD (default: DEV)

    Returns:
        { "environment": "DEV", "profiles": ["Admin", "Sales User", ...] }
    """
    logger.info(f"Fetching profiles for {environment}")
    try:
        profiles = service_fetch_profiles(environment)
        return {
            "environment": environment,
            "profiles": profiles,
            "count": len(profiles),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to list profiles for {environment}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
@router.get("/test-profiles")
async def test_profiles():
    """Temporary endpoint to fetch and compare DEV vs UAT profile names."""
    try:
        from app.services.salesforce_service import get_connection
        
        dev_sf = get_connection("DEV")
        uat_sf = get_connection("UAT")
        
        dev_profiles = []
        if dev_sf:
            res = dev_sf.query_all("SELECT Name, UserLicenseId FROM Profile")
            dev_profiles = [r["Name"] for r in res.get("records", [])]
            
        uat_profiles = []
        if uat_sf:
            res = uat_sf.query_all("SELECT Name, UserLicenseId FROM Profile")
            uat_profiles = [r["Name"] for r in res.get("records", [])]
            
        return {
            "DEV_Count": len(dev_profiles),
            "UAT_Count": len(uat_profiles),
            "DEV_Profiles": sorted(dev_profiles),
            "UAT_Profiles": sorted(uat_profiles),
            "Differences": {
                "In_DEV_Only": sorted(list(set(dev_profiles) - set(uat_profiles))),
                "In_UAT_Only": sorted(list(set(uat_profiles) - set(dev_profiles)))
            }
        }
    except Exception as e:
        return {"error": str(e)}
