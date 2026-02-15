"""
Shared Authentication Dependencies
===================================

Used by route files to verify user identity and permissions.
Avoids circular imports by using lazy imports for database access.

Usage in route files:
    from middleware.auth import get_current_user, require_admin, AuthUser
    
    @router.get("/protected")
    async def my_endpoint(user: AuthUser = Depends(get_current_user)):
        ...
    
    # Or add auth to entire router:
    router = APIRouter(dependencies=[Depends(get_current_user)])
"""

from fastapi import Depends, Header, HTTPException, Request
from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import os
import logging

logger = logging.getLogger(__name__)

SUPER_ADMIN_EMAIL = os.environ.get('SUPER_ADMIN_EMAIL', 'maaktanwar@gmail.com')


class AuthUser(BaseModel):
    """Lightweight user model for auth checks in route files"""
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    is_admin: bool = False
    is_blocked: bool = False
    has_free_access: bool = False
    is_paid: bool = False


async def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(None),
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
) -> AuthUser:
    """
    Authenticate user from session token.
    
    Checks (in order):
    1. session_token cookie
    2. X-Session-ID header
    3. Authorization: Bearer <token>
    
    Returns AuthUser on success, raises HTTPException on failure.
    """
    from services.firestore_db import get_db
    db = get_db()
    
    session_token = request.cookies.get("session_token")
    
    # Fallback 1: X-Session-ID header (for mobile browsers where cookies fail)
    if not session_token and x_session_id:
        session_token = x_session_id
    
    # Fallback 2: Bearer token
    if not session_token and authorization:
        if authorization.startswith("Bearer "):
            session_token = authorization.replace("Bearer ", "")
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token}, {"_id": 0}
    )
    
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        await db.user_sessions.delete_one({"session_token": session_token})
        raise HTTPException(status_code=401, detail="Session expired")
    
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]}, {"_id": 0}
    )
    
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = AuthUser(**user_doc)
    
    if user.is_blocked:
        raise HTTPException(status_code=403, detail="Your account has been blocked. Contact admin.")
    
    return user


async def require_admin(current_user: AuthUser = Depends(get_current_user)) -> AuthUser:
    """Require admin access — use as Depends(require_admin)"""
    if not current_user.is_admin and current_user.email != SUPER_ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


async def require_paid(current_user: AuthUser = Depends(get_current_user)) -> AuthUser:
    """Require paid or free-access user — use as Depends(require_paid)"""
    if current_user.email == SUPER_ADMIN_EMAIL or current_user.is_admin:
        return current_user
    if current_user.is_paid or current_user.has_free_access:
        return current_user
    raise HTTPException(status_code=403, detail="Paid access required")
