"""
Token Service for AI Usage
Manages user token balance, usage tracking, and recharge.
All data persisted in Firestore (survives restarts).
Admin users get FREE unlimited access.
"""

import os
from datetime import datetime
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

# Admin emails - free unlimited access
ADMIN_EMAILS = [
    "maaktanwar@gmail.com",
    os.getenv("SUPER_ADMIN_EMAIL", "maaktanwar@gmail.com")
]

# Token pricing
TOKEN_PACKAGES = {
    "starter": {"tokens": 100, "price": 99, "name": "Starter Pack"},
    "basic": {"tokens": 500, "price": 399, "name": "Basic Pack"},
    "pro": {"tokens": 1500, "price": 999, "name": "Pro Pack"},
    "unlimited": {"tokens": 5000, "price": 2499, "name": "Unlimited Pack"},
}

# Token costs per action
TOKEN_COSTS = {
    "trade_analysis": 5,
    "portfolio_review": 20,
    "strategy_suggestion": 10,
    "risk_assessment": 8,
    "market_insight": 3,
    "bot_start": 15,
    "bot_start_hedging": 40,
    "bot_start_ai_hedging": 60,
}


def _get_db():
    """Lazy-load Firestore to avoid circular imports."""
    from services.firestore_db import FirestoreCollection
    return {
        "tokens": FirestoreCollection("ai_tokens"),
        "transactions": FirestoreCollection("ai_token_transactions"),
    }


class TokenService:
    """
    Token management service for AI usage billing.
    All balances and transactions are persisted in Firestore.
    Admin users get FREE unlimited access.
    """

    def __init__(self):
        self.packages = TOKEN_PACKAGES
        self.costs = TOKEN_COSTS
        self.admin_emails = ADMIN_EMAILS

    def is_admin(self, user_id: str = None, user_email: str = None) -> bool:
        """Check if user is admin (free unlimited access)"""
        check_values = []
        if user_id:
            check_values.append(user_id.lower())
        if user_email:
            check_values.append(user_email.lower())
        admin_lower = [e.lower() for e in self.admin_emails]
        return any(val in admin_lower for val in check_values)

    async def get_balance(self, user_id: str) -> Dict[str, Any]:
        """Get user's current token balance from Firestore"""
        if self.is_admin(user_id=user_id):
            return {
                "user_id": user_id,
                "balance": 999999,
                "total_purchased": 0,
                "total_used": 0,
                "is_admin": True,
                "unlimited": True,
            }

        db = _get_db()
        doc = await db["tokens"].find_one({"_id": user_id})
        if not doc:
            # New users get 10 free tokens — persist immediately
            new_user = {
                "balance": 10,
                "total_purchased": 0,
                "total_used": 0,
                "created_at": datetime.now().isoformat(),
                "last_updated": datetime.now().isoformat(),
            }
            await db["tokens"].update_one(
                {"_id": user_id}, {"$set": new_user}, upsert=True
            )
            doc = {**new_user, "_id": user_id}

        return {
            "user_id": user_id,
            "balance": doc.get("balance", 0),
            "total_purchased": doc.get("total_purchased", 0),
            "total_used": doc.get("total_used", 0),
        }

    async def use_tokens(self, user_id: str, action: str, count: int = 1) -> Dict[str, Any]:
        """Consume tokens for an action. Admin users don't consume tokens."""
        if action not in self.costs:
            return {"success": False, "error": f"Unknown action: {action}"}

        cost = self.costs[action] * count

        if self.is_admin(user_id=user_id):
            logger.info(f"Admin {user_id} used {action} for FREE")
            return {
                "success": True,
                "tokens_used": 0,
                "remaining_balance": 999999,
                "action": action,
                "is_admin": True,
                "free_access": True,
            }

        balance_data = await self.get_balance(user_id)
        if balance_data["balance"] < cost:
            return {
                "success": False,
                "error": "Insufficient tokens",
                "required": cost,
                "available": balance_data["balance"],
                "action": action,
            }

        db = _get_db()
        new_balance = balance_data["balance"] - cost
        new_used = balance_data["total_used"] + cost
        await db["tokens"].update_one(
            {"_id": user_id},
            {"$set": {
                "balance": new_balance,
                "total_used": new_used,
                "last_updated": datetime.now().isoformat(),
            }},
        )

        # Log transaction
        await db["transactions"].insert_one({
            "user_id": user_id,
            "action": action,
            "tokens": -cost,
            "timestamp": datetime.now().isoformat(),
            "type": "usage",
        })

        logger.info(f"User {user_id} used {cost} tokens for {action}")
        return {
            "success": True,
            "tokens_used": cost,
            "remaining_balance": new_balance,
            "action": action,
        }

    async def add_tokens(self, user_id: str, package_id: str, transaction_id: str = None) -> Dict[str, Any]:
        """Add tokens to user account after successful payment"""
        if package_id not in self.packages:
            return {"success": False, "error": f"Unknown package: {package_id}"}

        package = self.packages[package_id]
        tokens_to_add = package["tokens"]

        balance_data = await self.get_balance(user_id)
        db = _get_db()
        new_balance = balance_data["balance"] + tokens_to_add
        new_purchased = balance_data["total_purchased"] + tokens_to_add

        await db["tokens"].update_one(
            {"_id": user_id},
            {"$set": {
                "balance": new_balance,
                "total_purchased": new_purchased,
                "last_updated": datetime.now().isoformat(),
            }},
        )

        await db["transactions"].insert_one({
            "user_id": user_id,
            "action": "recharge",
            "tokens": tokens_to_add,
            "package": package_id,
            "amount": package["price"],
            "transaction_id": transaction_id,
            "timestamp": datetime.now().isoformat(),
            "type": "purchase",
        })

        logger.info(f"User {user_id} purchased {tokens_to_add} tokens ({package_id})")
        return {
            "success": True,
            "tokens_added": tokens_to_add,
            "new_balance": new_balance,
            "package": package["name"],
        }

    def get_packages(self) -> list:
        """Get available token packages"""
        return [
            {
                "id": pkg_id,
                "name": pkg["name"],
                "tokens": pkg["tokens"],
                "price": pkg["price"],
                "price_per_token": round(pkg["price"] / pkg["tokens"], 2),
            }
            for pkg_id, pkg in self.packages.items()
        ]

    def get_action_costs(self) -> Dict[str, int]:
        """Get token costs for each action"""
        return self.costs

    async def get_usage_history(self, user_id: str, limit: int = 50) -> list:
        """Get user's token usage history from Firestore"""
        db = _get_db()
        cursor = db["transactions"].find({"user_id": user_id})
        all_txns = await cursor.to_list(500)
        sorted_txns = sorted(all_txns, key=lambda x: x.get("timestamp", ""), reverse=True)
        return sorted_txns[:limit]

    async def check_can_use(self, user_id: str, action: str) -> Dict[str, Any]:
        """Check if user has enough tokens for an action"""
        if action not in self.costs:
            return {"can_use": False, "error": f"Unknown action: {action}"}

        if self.is_admin(user_id=user_id):
            return {
                "can_use": True,
                "cost": 0,
                "balance": 999999,
                "action": action,
                "is_admin": True,
                "free_access": True,
            }

        cost = self.costs[action]
        balance_data = await self.get_balance(user_id)
        return {
            "can_use": balance_data["balance"] >= cost,
            "cost": cost,
            "balance": balance_data["balance"],
            "action": action,
        }


# Singleton instance
token_service = TokenService()
