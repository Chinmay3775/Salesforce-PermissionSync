"""
Salesforce OAuth 2.0 Authentication Module.
Implements the Client Credentials flow using Client ID + Client Secret + Org URL.
No browser redirect required — the backend authenticates directly with Salesforce.
"""

import logging
import time
from typing import Dict, Any, Optional

import httpx

logger = logging.getLogger(__name__)

# Retry configuration
MAX_RETRIES = 3
RETRY_BACKOFF_BASE = 1.5  # seconds

# Error code to user-friendly message mapping
OAUTH_ERROR_MAP = {
    "invalid_grant": "Invalid credentials. Verify your Client ID and Client Secret.",
    "invalid_client_id": "Invalid Client ID (Consumer Key). Verify your Connected App configuration.",
    "invalid_client": "Invalid Client Secret (Consumer Secret). Verify your Connected App configuration.",
    "authentication_failure": "Authentication failed. Ensure the Connected App is properly configured.",
    "inactive_org": "This Salesforce org is inactive or inaccessible.",
    "ip_restricted": "Login from this IP address is not allowed. Check your org's IP restrictions.",
    "org_locked": "This Salesforce org is currently locked.",
    "unsupported_grant_type": "The Client Credentials grant type is not supported. Enable it in your Connected App.",
}


class OAuthError(Exception):
    """Structured OAuth authentication error."""

    def __init__(self, message: str, error_code: str = None, details: str = None):
        self.message = message
        self.error_code = error_code
        self.details = details
        super().__init__(self.message)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": False,
            "message": self.message,
            "error_code": self.error_code,
            "details": self.details,
        }


def _resolve_token_url(org_url: str) -> str:
    """
    Resolve the OAuth token endpoint from the org URL.

    Accepts:
        - Full URL: https://mycompany.my.salesforce.com
        - Domain only: mycompany.my.salesforce.com
        - Shortcuts: 'login' (production), 'test' (sandbox)
    """
    org_url = org_url.strip().rstrip("/")

    if org_url.lower() == "login":
        return "https://login.salesforce.com/services/oauth2/token"
    if org_url.lower() == "test":
        return "https://test.salesforce.com/services/oauth2/token"

    if not org_url.startswith("https://"):
        org_url = f"https://{org_url}"

    return f"{org_url}/services/oauth2/token"


def _resolve_base_url(org_url: str) -> str:
    """Resolve the base instance URL from the org URL input."""
    org_url = org_url.strip().rstrip("/")

    if org_url.lower() == "login":
        return "https://login.salesforce.com"
    if org_url.lower() == "test":
        return "https://test.salesforce.com"

    if not org_url.startswith("https://"):
        org_url = f"https://{org_url}"

    return org_url


def authenticate_client_credentials(
    client_id: str,
    client_secret: str,
    org_url: str,
) -> Dict[str, Any]:
    """
    Authenticate with Salesforce using OAuth 2.0 Client Credentials flow.

    This flow does NOT require a username/password and does NOT redirect
    the user to Salesforce. The backend exchanges the Client ID + Secret
    directly for an access token.

    Prerequisites in Salesforce:
        1. Create a Connected App with 'Enable Client Credentials Flow' checked.
        2. Assign a Run-As user (Setup > Connected Apps > Manage > Edit Policies).
        3. Add required OAuth scopes (api, full, etc.).

    Args:
        client_id: Consumer Key from the Connected App
        client_secret: Consumer Secret from the Connected App
        org_url: Salesforce org URL (e.g., mycompany.my.salesforce.com)

    Returns:
        Dict with access_token, instance_url, token_type

    Raises:
        OAuthError: On authentication failure with structured error details
    """
    token_url = _resolve_token_url(org_url)

    payload = {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
    }

    logger.info(f"OAuth Client Credentials authentication via {token_url}")

    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            logger.debug(f"OAuth attempt {attempt}/{MAX_RETRIES}")

            with httpx.Client(timeout=30.0) as client:
                response = client.post(token_url, data=payload)

            if response.status_code == 200:
                token_data = response.json()

                logger.info(
                    f"OAuth Client Credentials authentication successful "
                    f"→ instance: {token_data.get('instance_url')}"
                )

                return {
                    "access_token": token_data["access_token"],
                    "instance_url": token_data.get("instance_url", _resolve_base_url(org_url)),
                    "token_type": token_data.get("token_type", "Bearer"),
                    "id": token_data.get("id", ""),
                    "issued_at": token_data.get("issued_at", ""),
                    "signature": token_data.get("signature", ""),
                }

            # Handle error response
            error_body = (
                response.json()
                if response.headers.get("content-type", "").startswith("application/json")
                else {}
            )
            error_code = error_body.get("error", "unknown_error")
            error_description = error_body.get("error_description", "No description provided")

            logger.error(
                f"OAuth error (attempt {attempt}): "
                f"status={response.status_code}, "
                f"error={error_code}, "
                f"description={error_description}"
            )

            # Map to user-friendly message
            user_message = OAUTH_ERROR_MAP.get(
                error_code, f"Authentication failed: {error_description}"
            )

            # Don't retry on credential errors — they won't succeed
            if error_code in (
                "invalid_grant",
                "invalid_client_id",
                "invalid_client",
                "authentication_failure",
                "inactive_org",
                "unsupported_grant_type",
            ):
                raise OAuthError(
                    message=user_message,
                    error_code=error_code,
                    details=error_description,
                )

            last_error = OAuthError(
                message=user_message,
                error_code=error_code,
                details=error_description,
            )

        except OAuthError:
            raise
        except httpx.TimeoutException as e:
            logger.warning(f"OAuth request timed out (attempt {attempt}): {str(e)}")
            last_error = OAuthError(
                message="Connection to Salesforce timed out. Please try again.",
                error_code="timeout",
                details=str(e),
            )
        except httpx.ConnectError as e:
            logger.warning(f"Cannot reach Salesforce (attempt {attempt}): {str(e)}")
            last_error = OAuthError(
                message="Cannot reach Salesforce. Check the Org URL and your internet connection.",
                error_code="connection_error",
                details=str(e),
            )
        except Exception as e:
            logger.error(f"Unexpected OAuth error (attempt {attempt}): {str(e)}")
            last_error = OAuthError(
                message=f"Unexpected authentication error: {str(e)}",
                error_code="unexpected_error",
                details=str(e),
            )

        # Exponential backoff before retry
        if attempt < MAX_RETRIES:
            wait_time = RETRY_BACKOFF_BASE ** attempt
            logger.info(f"Retrying in {wait_time:.1f}s...")
            time.sleep(wait_time)

    # All retries exhausted
    raise last_error or OAuthError(
        message="Authentication failed after all retry attempts.",
        error_code="max_retries",
        details=f"Failed after {MAX_RETRIES} attempts",
    )


def validate_token(access_token: str, instance_url: str) -> bool:
    """
    Validate that an OAuth access token is still valid.

    Performs a lightweight API call against the org to verify the session.

    Args:
        access_token: The OAuth access token to validate
        instance_url: The Salesforce instance URL

    Returns:
        True if token is valid, False otherwise
    """
    try:
        base_url = instance_url.rstrip("/")
        if not base_url.startswith("https://"):
            base_url = f"https://{base_url}"

        url = f"{base_url}/services/data/v60.0/limits"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

        with httpx.Client(timeout=15.0) as client:
            response = client.get(url, headers=headers)

        if response.status_code == 200:
            logger.debug("Token validation successful")
            return True

        logger.warning(f"Token validation failed: status={response.status_code}")
        return False

    except Exception as e:
        logger.error(f"Token validation error: {str(e)}")
        return False


def revoke_token(access_token: str, instance_url: str) -> bool:
    """
    Revoke an OAuth access token.

    Args:
        access_token: The token to revoke
        instance_url: The Salesforce instance URL

    Returns:
        True if revocation succeeded, False otherwise
    """
    try:
        base_url = instance_url.rstrip("/")
        if not base_url.startswith("https://"):
            base_url = f"https://{base_url}"

        revoke_url = f"{base_url}/services/oauth2/revoke"

        with httpx.Client(timeout=15.0) as client:
            response = client.post(revoke_url, data={"token": access_token})

        if response.status_code == 200:
            logger.info("OAuth token revoked successfully")
            return True

        logger.warning(f"Token revocation returned status {response.status_code}")
        return True  # Salesforce may return non-200 even on success

    except Exception as e:
        logger.warning(f"Token revocation error (non-critical): {str(e)}")
        return False
