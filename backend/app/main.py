"""
Salesforce Metadata Permission Comparison & Synchronization Platform
Main FastAPI Application Entry Point
"""

import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import orgs, metadata, comparison, sync, reports
from app.utils.logger import setup_logging

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

# Storage directories to ensure exist
STORAGE_DIRS = [
    "storage/DEV/raw_xml",
    "storage/DEV/parsed_json",
    "storage/DEV/reports",
    "storage/UAT/raw_xml",
    "storage/UAT/parsed_json",
    "storage/UAT/reports",
    "storage/PROD/raw_xml",
    "storage/PROD/parsed_json",
    "storage/PROD/reports",
    "logs",
    "temp",
    "exports",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    logger.info("🚀 Starting Salesforce PermissionSync Platform...")
    
    # Create storage directories
    base_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    for dir_path in STORAGE_DIRS:
        full_path = os.path.join(base_path, dir_path)
        os.makedirs(full_path, exist_ok=True)
        logger.info(f"  ✓ Ensured directory: {dir_path}")
    
    logger.info("✅ Platform ready.")
    yield
    logger.info("🛑 Shutting down Salesforce PermissionSync Platform.")


app = FastAPI(
    title="Salesforce PermissionSync Platform",
    description="Enterprise-grade Salesforce metadata permission comparison and synchronization",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(orgs.router, prefix="/api", tags=["Org Connection"])
app.include_router(metadata.router, prefix="/api", tags=["Metadata"])
app.include_router(comparison.router, prefix="/api", tags=["Comparison"])
app.include_router(sync.router, prefix="/api", tags=["Synchronization"])
app.include_router(reports.router, prefix="/api", tags=["Reports"])


@app.get("/api/health")
async def health_check():
    """Platform health check endpoint."""
    return {
        "status": "healthy",
        "platform": "Salesforce PermissionSync",
        "version": "1.0.0"
    }
