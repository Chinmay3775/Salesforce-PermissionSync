"""API routes for metadata retrieval and browsing."""

import logging
from fastapi import APIRouter, HTTPException
from datetime import datetime

from app.services.metadata_service import retrieve_live_metadata
from app.services.comparison_service import get_metadata_tree

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory cache for the latest retrieved snapshots
_metadata_cache = {}


@router.post("/fetch-metadata")
async def fetch_metadata(request: dict):
    """Fetch real metadata from a Salesforce org using SOQL."""
    environment = request.get("environment", "DEV")
    metadata_types = request.get("metadata_types", ["Profile", "PermissionSet", "FieldPermissions", "ObjectPermissions"])

    logger.info(f"Fetching live metadata from {environment}: {metadata_types}")

    try:
        # Retrieve live snapshot using SOQL queries
        snapshot = retrieve_live_metadata(environment)
        
        # Cache the real snapshot for comparison engine
        _metadata_cache[environment] = snapshot

        return {
            "status": "success",
            "environment": environment,
            "profiles_count": len(snapshot["profiles"]),
            "permission_sets_count": len(snapshot["permission_sets"]),
            "total_field_permissions": sum(
                len(p.get("fieldPermissions", []))
                for p in snapshot["profiles"].values()
            ),
            "total_object_permissions": sum(
                len(p.get("objectPermissions", []))
                for p in snapshot["profiles"].values()
            ),
            "fetched_at": datetime.utcnow().isoformat(),
            "message": f"Successfully retrieved live metadata from {environment}",
        }
    except Exception as e:
        logger.error(f"Failed to fetch metadata from {environment}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metadata-tree")
async def metadata_tree(environment: str = "DEV"):
    """Get metadata as a navigable tree."""
    tree = get_metadata_tree(environment)
    return tree


@router.get("/metadata-snapshot")
async def metadata_snapshot(environment: str = "DEV", profile: str = None):
    """Get full metadata snapshot for an environment."""
    snapshot = _metadata_cache.get(environment)
    if not snapshot:
        raise HTTPException(status_code=404, detail=f"No metadata found for {environment}. Please fetch it first.")

    if profile and profile in snapshot.get("profiles", {}):
        return {
            "environment": environment,
            "profile": profile,
            "data": snapshot["profiles"][profile],
        }

    return snapshot
