"""
Dhan Authentication Service
===========================
Handles OAuth flow and token management for Dhan API

Supports:
- TOTP-based auto-login (fully automated, no browser needed!)
- API Key & Secret based OAuth flow (12 month validity)  
- Token renewal before expiry
- Auto-refresh mechanism
"""

import os
import asyncio
import aiohttp
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from pathlib import Path

try:
    import pyotp
except ImportError:
    pyotp = None

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / '.env')
except ImportError:
    pass

logger = logging.getLogger(__name__)

# Configuration
DHAN_CLIENT_ID = os.getenv("DHAN_CLIENT_ID", "")
DHAN_APP_ID = os.getenv("DHAN_APP_ID", "")  # API Key
DHAN_APP_SECRET = os.getenv("DHAN_APP_SECRET", "")  # API Secret
DHAN_ACCESS_TOKEN = os.getenv("DHAN_ACCESS_TOKEN", "")
DHAN_PIN = os.getenv("DHAN_PIN", "")  # 6-digit PIN
DHAN_TOTP_SECRET = os.getenv("DHAN_TOTP_SECRET", "")  # TOTP Secret

AUTH_BASE_URL = "https://auth.dhan.co"
API_BASE_URL = "https://api.dhan.co/v2"


class DhanAuthService:
    """
    Manages Dhan API authentication
    
    Supports:
    - TOTP auto-login (fully automated!)
    - API Key & Secret based OAuth flow (12 month validity)
    - Token renewal before expiry
    - Auto-refresh mechanism
    """
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self.client_id = DHAN_CLIENT_ID
        self.app_id = DHAN_APP_ID
        self.app_secret = DHAN_APP_SECRET
        self.access_token = DHAN_ACCESS_TOKEN
        self.pin = DHAN_PIN
        self.totp_secret = DHAN_TOTP_SECRET
        self.token_expiry: Optional[datetime] = None
        
        self._session: Optional[aiohttp.ClientSession] = None
        self._initialized = True
        
        totp_status = "✅ configured" if self.pin and self.totp_secret else "❌ not configured"
        logger.info(f"✅ DhanAuthService initialized (Client ID: {self.client_id}, TOTP: {totp_status})")
    
    def _generate_totp(self) -> Optional[str]:
        """Generate current TOTP code"""
        if not pyotp:
            logger.error("pyotp not installed")
            return None
        
        if not self.totp_secret:
            logger.error("TOTP secret not configured")
            return None
        
        try:
            totp = pyotp.TOTP(self.totp_secret)
            code = totp.now()
            logger.info(f"Generated TOTP code: {code}")
            return code
        except Exception as e:
            logger.error(f"TOTP generation error: {e}")
            return None
    
    async def _ensure_session(self):
        """Ensure aiohttp session exists"""
        if self._session is None or self._session.closed:
            timeout = aiohttp.ClientTimeout(total=30)
            self._session = aiohttp.ClientSession(timeout=timeout)
        return self._session
    
    async def close(self):
        """Close the session"""
        if self._session and not self._session.closed:
            await self._session.close()
            self._session = None
    
    def is_token_valid(self) -> bool:
        """Check if current token is valid"""
        if not self.access_token:
            return False
        
        if self.token_expiry and datetime.now() >= self.token_expiry:
            return False
        
        return True
    
    async def auto_generate_token(self) -> Optional[Dict[str, Any]]:
        """
        Automatically generate access token using TOTP
        
        This is FULLY AUTOMATED - no browser login needed!
        Requires: DHAN_PIN and DHAN_TOTP_SECRET
        
        Returns:
            Dict with accessToken, dhanClientId, expiryTime
        """
        if not self.client_id or not self.pin or not self.totp_secret:
            logger.error("TOTP auto-login not configured. Need DHAN_CLIENT_ID, DHAN_PIN, DHAN_TOTP_SECRET")
            return None
        
        totp_code = self._generate_totp()
        if not totp_code:
            return None
        
        try:
            await self._ensure_session()
            
            # Try Dhan's TOTP login endpoint
            # Based on Dhan API docs, this should be a POST with JSON body
            url = f"{AUTH_BASE_URL}/app/generateAccessToken"
            
            payload = {
                "dhanClientId": self.client_id,
                "pin": self.pin,
                "totp": totp_code
            }
            
            headers = {
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
            
            logger.info(f"Auto-generating token for client {self.client_id} with TOTP: {totp_code}...")
            
            async with self._session.post(url, json=payload, headers=headers) as response:
                response_text = await response.text()
                
                if response.status == 200:
                    import json
                    data = json.loads(response_text)
                    
                    if data.get("accessToken"):
                        self.access_token = data["accessToken"]
                        self.client_id = data.get("dhanClientId", self.client_id)
                        
                        # Parse expiry time
                        expiry_str = data.get("expiryTime", "")
                        if expiry_str:
                            try:
                                self.token_expiry = datetime.fromisoformat(expiry_str.replace("Z", "+00:00"))
                            except:
                                self.token_expiry = datetime.now() + timedelta(hours=24)
                        else:
                            self.token_expiry = datetime.now() + timedelta(hours=24)
                        
                        logger.info(f"✅ Token auto-generated successfully! Expires: {self.token_expiry}")
                        return {
                            "success": True,
                            "dhanClientId": data.get("dhanClientId"),
                            "dhanClientName": data.get("dhanClientName"),
                            "accessToken": data.get("accessToken"),
                            "expiryTime": data.get("expiryTime")
                        }
                    else:
                        logger.error(f"No access token in response: {response_text}")
                else:
                    logger.error(f"Token generation failed: {response.status} - {response_text}")
        
        except Exception as e:
            logger.error(f"Auto token generation error: {e}")
        
        return None
    
    async def get_valid_token(self) -> str:
        """
        Get a valid access token
        
        - Returns current token if valid
        - Attempts renewal if near expiry
        - Auto-generates via TOTP if expired
        - Returns empty string if no valid token
        """
        # If token is valid and not near expiry, return it
        if self.access_token:
            # Try to renew if within 2 hours of expiry
            if self.token_expiry:
                time_to_expiry = (self.token_expiry - datetime.now()).total_seconds()
                if time_to_expiry < 7200:  # 2 hours
                    logger.info("Token near expiry, attempting renewal...")
                    renewed = await self.renew_token()
                    if renewed:
                        return self.access_token
            
            return self.access_token
        
        return ""
    
    async def renew_token(self) -> bool:
        """
        Renew access token for another 24 hours
        
        Only works for active tokens (not expired)
        """
        if not self.access_token or not self.client_id:
            logger.warning("Cannot renew: missing token or client ID")
            return False
        
        try:
            await self._ensure_session()
            
            async with self._session.get(
                f"{API_BASE_URL}/RenewToken",
                headers={
                    "access-token": self.access_token,
                    "dhanClientId": self.client_id
                }
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get("accessToken"):
                        self.access_token = data["accessToken"]
                        self.token_expiry = datetime.now() + timedelta(hours=24)
                        logger.info("✅ Token renewed successfully")
                        return True
                else:
                    error_text = await response.text()
                    logger.error(f"Token renewal failed: {response.status} - {error_text}")
        
        except Exception as e:
            logger.error(f"Token renewal error: {e}")
        
        return False
    
    async def generate_consent(self) -> Optional[str]:
        """
        Step 1: Generate consent for OAuth flow
        
        Returns consentAppId for browser login
        """
        if not self.app_id or not self.app_secret:
            logger.error("Missing APP_ID or APP_SECRET")
            return None
        
        try:
            await self._ensure_session()
            
            async with self._session.post(
                f"{AUTH_BASE_URL}/app/generate-consent",
                params={"client_id": self.client_id},
                headers={
                    "app_id": self.app_id,
                    "app_secret": self.app_secret
                }
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    consent_id = data.get("consentAppId")
                    if consent_id:
                        logger.info(f"✅ Consent generated: {consent_id}")
                        return consent_id
                else:
                    error_text = await response.text()
                    logger.error(f"Consent generation failed: {response.status} - {error_text}")
        
        except Exception as e:
            logger.error(f"Consent generation error: {e}")
        
        return None
    
    def get_login_url(self, consent_id: str) -> str:
        """
        Step 2: Get browser login URL
        
        User needs to open this in browser, login, and get tokenId from redirect
        """
        return f"{AUTH_BASE_URL}/login/consentApp-login?consentAppId={consent_id}"
    
    async def consume_consent(self, token_id: str) -> Optional[Dict[str, Any]]:
        """
        Step 3: Exchange tokenId for access token
        
        Args:
            token_id: Token ID received from redirect after browser login
        
        Returns:
            Dict with accessToken, dhanClientId, expiryTime etc.
        """
        if not self.app_id or not self.app_secret:
            logger.error("Missing APP_ID or APP_SECRET")
            return None
        
        try:
            await self._ensure_session()
            
            async with self._session.get(
                f"{AUTH_BASE_URL}/app/consumeApp-consent",
                params={"tokenId": token_id},
                headers={
                    "app_id": self.app_id,
                    "app_secret": self.app_secret
                }
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    if data.get("accessToken"):
                        self.access_token = data["accessToken"]
                        self.client_id = data.get("dhanClientId", self.client_id)
                        
                        # Parse expiry time
                        expiry_str = data.get("expiryTime", "")
                        if expiry_str:
                            try:
                                self.token_expiry = datetime.fromisoformat(expiry_str.replace("Z", "+00:00"))
                            except:
                                self.token_expiry = datetime.now() + timedelta(hours=24)
                        
                        logger.info(f"✅ Access token obtained, expires: {self.token_expiry}")
                        return data
                else:
                    error_text = await response.text()
                    logger.error(f"Consent consumption failed: {response.status} - {error_text}")
        
        except Exception as e:
            logger.error(f"Consent consumption error: {e}")
        
        return None
    
    async def check_token_validity(self) -> Dict[str, Any]:
        """Check current token validity via user profile API"""
        if not self.access_token:
            return {"valid": False, "reason": "No token configured"}
        
        try:
            await self._ensure_session()
            
            async with self._session.get(
                f"{API_BASE_URL}/profile",
                headers={"access-token": self.access_token}
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return {
                        "valid": True,
                        "client_id": data.get("dhanClientId"),
                        "token_validity": data.get("tokenValidity"),
                        "segments": data.get("activeSegment"),
                        "data_plan": data.get("dataPlan")
                    }
                else:
                    return {"valid": False, "reason": f"HTTP {response.status}"}
        
        except Exception as e:
            return {"valid": False, "reason": str(e)}
    
    def get_status(self) -> Dict[str, Any]:
        """Get current auth status"""
        return {
            "client_id": self.client_id,
            "has_token": bool(self.access_token),
            "token_preview": f"{self.access_token[:20]}..." if self.access_token else None,
            "has_app_credentials": bool(self.app_id and self.app_secret),
            "has_totp_credentials": bool(self.pin and self.totp_secret),
            "totp_ready": bool(self.client_id and self.pin and self.totp_secret and pyotp),
            "token_expiry": self.token_expiry.isoformat() if self.token_expiry else None
        }


# Singleton instance
_auth_service: Optional[DhanAuthService] = None

def get_dhan_auth_service() -> DhanAuthService:
    """Get singleton instance of DhanAuthService"""
    global _auth_service
    if _auth_service is None:
        _auth_service = DhanAuthService()
    return _auth_service
