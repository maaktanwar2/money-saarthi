# backend/middleware/__init__.py
"""Middleware module for Money Saarthi"""

from .error_handler import (
    setup_error_handling,
    log_request_middleware,
    error_response,
    success_response,
    AppException,
    ValidationException,
    AuthenticationException,
    AuthorizationException,
    NotFoundException,
    RateLimitException,
    ExternalAPIException
)

__all__ = [
    'setup_error_handling',
    'log_request_middleware',
    'error_response',
    'success_response',
    'AppException',
    'ValidationException',
    'AuthenticationException',
    'AuthorizationException',
    'NotFoundException',
    'RateLimitException',
    'ExternalAPIException'
]
