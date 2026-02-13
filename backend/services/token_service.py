"""
Token Service for AI Usage
Manages user token balance, usage tracking, and recharge
Admin users get FREE unlimited access
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
    "trade_analysis": 5,        # Analyze a single trade
    "portfolio_review": 20,     # Full portfolio analysis
    "strategy_suggestion": 10,  # Get strategy adjustment
    "risk_assessment": 8,       # Risk analysis
    "market_insight": 3,        # Quick market insight
    "bot_start": 15,            # Start an algo trading bot
}

# In-memory storage (replace with database in production)
user_tokens = {}
token_transactions = []


class TokenService:
    """
    Token management service for AI usage billing
    Admin users get FREE unlimited access
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
        for val in check_values:
            if val in admin_lower:
                return True
        return False
    
    def get_balance(self, user_id: str) -> Dict[str, Any]:
        """Get user's current token balance"""
        # Admin gets unlimited tokens
        if self.is_admin(user_id=user_id):
            return {
                "user_id": user_id,
                "balance": 999999,  # Unlimited for admin
                "total_purchased": 0,
                "total_used": 0,
                "is_admin": True,
                "unlimited": True
            }
        
        if user_id not in user_tokens:
            # New users get 10 free tokens
            user_tokens[user_id] = {
                "balance": 10,
                "total_purchased": 0,
                "total_used": 0,
                "created_at": datetime.now().isoformat(),
                "last_updated": datetime.now().isoformat()
            }
        
        return {
            "user_id": user_id,
            "balance": user_tokens[user_id]["balance"],
            "total_purchased": user_tokens[user_id]["total_purchased"],
            "total_used": user_tokens[user_id]["total_used"],
        }
    
    def use_tokens(self, user_id: str, action: str, count: int = 1) -> Dict[str, Any]:
        """
        Consume tokens for an action
        Returns success status and remaining balance
        Admin users don't consume tokens (FREE)
        """
        if action not in self.costs:
            return {"success": False, "error": f"Unknown action: {action}"}
        
        cost = self.costs[action] * count
        
        # Admin gets free access - no token consumption
        if self.is_admin(user_id=user_id):
            logger.info(f"Admin {user_id} used {action} for FREE")
            return {
                "success": True,
                "tokens_used": 0,
                "remaining_balance": 999999,
                "action": action,
                "is_admin": True,
                "free_access": True
            }
        
        balance = self.get_balance(user_id)
        
        if balance["balance"] < cost:
            return {
                "success": False,
                "error": "Insufficient tokens",
                "required": cost,
                "available": balance["balance"],
                "action": action
            }
        
        # Deduct tokens
        user_tokens[user_id]["balance"] -= cost
        user_tokens[user_id]["total_used"] += cost
        user_tokens[user_id]["last_updated"] = datetime.now().isoformat()
        
        # Log transaction
        token_transactions.append({
            "user_id": user_id,
            "action": action,
            "tokens": -cost,
            "timestamp": datetime.now().isoformat(),
            "type": "usage"
        })
        
        logger.info(f"User {user_id} used {cost} tokens for {action}")
        
        return {
            "success": True,
            "tokens_used": cost,
            "remaining_balance": user_tokens[user_id]["balance"],
            "action": action
        }
    
    def add_tokens(self, user_id: str, package_id: str, transaction_id: str = None) -> Dict[str, Any]:
        """
        Add tokens to user account after successful payment
        """
        if package_id not in self.packages:
            return {"success": False, "error": f"Unknown package: {package_id}"}
        
        package = self.packages[package_id]
        tokens_to_add = package["tokens"]
        
        # Ensure user exists
        self.get_balance(user_id)
        
        # Add tokens
        user_tokens[user_id]["balance"] += tokens_to_add
        user_tokens[user_id]["total_purchased"] += tokens_to_add
        user_tokens[user_id]["last_updated"] = datetime.now().isoformat()
        
        # Log transaction
        token_transactions.append({
            "user_id": user_id,
            "action": "recharge",
            "tokens": tokens_to_add,
            "package": package_id,
            "amount": package["price"],
            "transaction_id": transaction_id,
            "timestamp": datetime.now().isoformat(),
            "type": "purchase"
        })
        
        logger.info(f"User {user_id} purchased {tokens_to_add} tokens ({package_id})")
        
        return {
            "success": True,
            "tokens_added": tokens_to_add,
            "new_balance": user_tokens[user_id]["balance"],
            "package": package["name"]
        }
    
    def get_packages(self) -> list:
        """Get available token packages"""
        return [
            {
                "id": pkg_id,
                "name": pkg["name"],
                "tokens": pkg["tokens"],
                "price": pkg["price"],
                "price_per_token": round(pkg["price"] / pkg["tokens"], 2)
            }
            for pkg_id, pkg in self.packages.items()
        ]
    
    def get_action_costs(self) -> Dict[str, int]:
        """Get token costs for each action"""
        return self.costs
    
    def get_usage_history(self, user_id: str, limit: int = 50) -> list:
        """Get user's token usage history"""
        user_transactions = [
            tx for tx in token_transactions 
            if tx["user_id"] == user_id
        ]
        return sorted(
            user_transactions, 
            key=lambda x: x["timestamp"], 
            reverse=True
        )[:limit]
    
    def check_can_use(self, user_id: str, action: str) -> Dict[str, Any]:
        """Check if user has enough tokens for an action"""
        if action not in self.costs:
            return {"can_use": False, "error": f"Unknown action: {action}"}
        
        # Admin always can use for free
        if self.is_admin(user_id=user_id):
            return {
                "can_use": True,
                "cost": 0,
                "balance": 999999,
                "action": action,
                "is_admin": True,
                "free_access": True
            }
        
        cost = self.costs[action]
        balance = self.get_balance(user_id)
        
        return {
            "can_use": balance["balance"] >= cost,
            "cost": cost,
            "balance": balance["balance"],
            "action": action
        }


# Singleton instance
token_service = TokenService()
