"""Pydantic models for Salesforce org connections."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class EnvironmentType(str, Enum):
    DEV = "DEV"
    UAT = "UAT"
    PROD = "PROD"


class AuthMethod(str, Enum):
    USERNAME_PASSWORD = "username_password"
    OAUTH = "oauth"
    JWT = "jwt"


class OrgConnectionRequest(BaseModel):
    """Request to connect a Salesforce org."""
    environment: EnvironmentType
    alias: str = Field(..., min_length=1, max_length=100)
    auth_method: AuthMethod = AuthMethod.USERNAME_PASSWORD
    username: Optional[str] = None
    password: Optional[str] = None
    security_token: Optional[str] = None
    domain: str = "login"  # login or test
    instance_url: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None


class OrgConnectionResponse(BaseModel):
    """Response after connecting an org."""
    environment: EnvironmentType
    alias: str
    org_id: str
    username: str
    instance_url: str
    connected: bool
    connected_at: datetime
    api_version: str = "59.0"


class OrgStatus(BaseModel):
    """Status of a connected org."""
    environment: EnvironmentType
    alias: str
    connected: bool
    org_id: Optional[str] = None
    username: Optional[str] = None
    instance_url: Optional[str] = None
    last_fetched: Optional[datetime] = None
    metadata_count: int = 0
    error: Optional[str] = None
