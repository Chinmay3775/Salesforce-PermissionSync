"""API routes for metadata retrieval and browsing."""

import logging
from fastapi import APIRouter, HTTPException
from datetime import datetime

from app.services.metadata_service import retrieve_component_permissions

logger = logging.getLogger(__name__)
router = APIRouter()

# We can keep a cache for individual component snapshots if needed
_metadata_cache = {}

@router.post("/fetch-component-metadata")
async def fetch_component_metadata(request: dict):
    """Fetch real metadata for a specific component from a Salesforce org."""
    environment = request.get("environment", "DEV")
    component_name = request.get("component_name")
    component_type = request.get("component_type")

    if not component_name or not component_type:
        raise HTTPException(status_code=400, detail="Missing component_name or component_type")

    logger.info(f"Fetching metadata for {component_type}:{component_name} from {environment}")

    try:
        snapshot = retrieve_component_permissions(component_name, component_type, environment)
        # Cache using a key
        cache_key = f"{environment}_{component_type}_{component_name}"
        _metadata_cache[cache_key] = snapshot

        return {
            "status": "success",
            "environment": environment,
            "component": f"{component_type}:{component_name}",
            "profiles_count": len(snapshot["profiles"]),
            "fetched_at": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        logger.error(f"Failed to fetch metadata from {environment}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/metadata-snapshot")
async def metadata_snapshot(environment: str, component_name: str, component_type: str):
    """Get full metadata snapshot for a component."""
    cache_key = f"{environment}_{component_type}_{component_name}"
    snapshot = _metadata_cache.get(cache_key)
    if not snapshot:
        raise HTTPException(status_code=404, detail="No metadata found. Please fetch it first.")

    return snapshot
