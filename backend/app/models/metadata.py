"""Pydantic models for metadata structures."""

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum


class MetadataType(str, Enum):
    PROFILE = "Profile"
    PERMISSION_SET = "PermissionSet"
    PERMISSION_SET_GROUP = "PermissionSetGroup"
    CUSTOM_OBJECT = "CustomObject"


class FieldPermission(BaseModel):
    field: str
    readable: bool = False
    editable: bool = False


class ObjectPermission(BaseModel):
    object_name: str
    allowCreate: bool = False
    allowRead: bool = False
    allowEdit: bool = False
    allowDelete: bool = False
    viewAllRecords: bool = False
    modifyAllRecords: bool = False


class ClassAccess(BaseModel):
    apexClass: str
    enabled: bool = False


class TabVisibility(BaseModel):
    tab: str
    visibility: str = "DefaultOff"  # DefaultOn, DefaultOff, Hidden


class UserPermission(BaseModel):
    name: str
    enabled: bool = False


class RecordTypeVisibility(BaseModel):
    recordType: str
    default_: bool = False
    visible: bool = False


class PageAccess(BaseModel):
    apexPage: str
    enabled: bool = False


class CustomPermission(BaseModel):
    name: str
    enabled: bool = False


class MetadataSnapshot(BaseModel):
    """Full metadata snapshot for a profile/permission set."""
    environment: str
    metadata_type: MetadataType
    name: str
    label: Optional[str] = None
    fieldPermissions: List[FieldPermission] = []
    objectPermissions: List[ObjectPermission] = []
    classAccesses: List[ClassAccess] = []
    tabVisibilities: List[TabVisibility] = []
    userPermissions: List[UserPermission] = []
    recordTypeVisibilities: List[RecordTypeVisibility] = []
    pageAccesses: List[PageAccess] = []
    customPermissions: List[CustomPermission] = []
    retrieved_at: Optional[datetime] = None


class FetchMetadataRequest(BaseModel):
    """Request to fetch metadata from an org."""
    environment: str
    metadata_types: List[MetadataType] = [MetadataType.PROFILE, MetadataType.PERMISSION_SET]
    specific_names: Optional[List[str]] = None


class FetchMetadataResponse(BaseModel):
    """Response after fetching metadata."""
    environment: str
    profiles_count: int = 0
    permission_sets_count: int = 0
    total_field_permissions: int = 0
    total_object_permissions: int = 0
    fetched_at: datetime
    status: str = "success"
    message: str = ""
