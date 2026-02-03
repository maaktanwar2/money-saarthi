# backend/routes/__init__.py
"""API Routes Module"""

from .scanner_routes import router as scanner_router
from .dhan_routes import router as dhan_router

__all__ = ['scanner_router', 'dhan_router']
