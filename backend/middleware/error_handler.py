# backend/middleware/error_handler.py
"""
Error Handling Middleware
Centralized error handling, logging, and request tracking
"""

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging
import time
import traceback
from datetime import datetime
from typing import Callable, Any
import uuid
import os

# Configure logging
LOG_DIR = os.path.dirname(os.path.dirname(__file__))
LOG_FILE = os.path.join(LOG_DIR, 'api_requests.log')

# Setup file handler for request logging
file_handler = logging.FileHandler(LOG_FILE)
file_handler.setLevel(logging.INFO)
file_handler.setFormatter(logging.Formatter(
    '%(asctime)s | %(levelname)s | %(message)s'
))

# API logger
api_logger = logging.getLogger('api_requests')
api_logger.setLevel(logging.INFO)
api_logger.addHandler(file_handler)

# Error logger
error_logger = logging.getLogger('api_errors')
error_logger.setLevel(logging.ERROR)


# ============================================
# CUSTOM EXCEPTIONS
# ============================================

class AppException(Exception):
    """Base application exception"""
    def __init__(
        self,
        message: str,
        status_code: int = 500,
        error_code: str = "INTERNAL_ERROR",
        details: dict = None
    ):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.details = details or {}
        super().__init__(message)


class ValidationException(AppException):
    """Validation error"""
    def __init__(self, message: str, details: dict = None):
        super().__init__(
            message=message,
            status_code=422,
            error_code="VALIDATION_ERROR",
            details=details
        )


class AuthenticationException(AppException):
    """Authentication error"""
    def __init__(self, message: str = "Authentication required"):
        super().__init__(
            message=message,
            status_code=401,
            error_code="AUTHENTICATION_ERROR"
        )


class AuthorizationException(AppException):
    """Authorization error"""
    def __init__(self, message: str = "Access denied"):
        super().__init__(
            message=message,
            status_code=403,
            error_code="AUTHORIZATION_ERROR"
        )


class NotFoundException(AppException):
    """Resource not found"""
    def __init__(self, resource: str = "Resource"):
        super().__init__(
            message=f"{resource} not found",
            status_code=404,
            error_code="NOT_FOUND"
        )


class RateLimitException(AppException):
    """Rate limit exceeded"""
    def __init__(self, retry_after: int = 60):
        super().__init__(
            message="Rate limit exceeded",
            status_code=429,
            error_code="RATE_LIMIT_EXCEEDED",
            details={"retry_after": retry_after}
        )


class ExternalAPIException(AppException):
    """External API error (Dhan, etc.)"""
    def __init__(self, service: str, message: str):
        super().__init__(
            message=f"{service} API error: {message}",
            status_code=502,
            error_code="EXTERNAL_API_ERROR",
            details={"service": service}
        )


# ============================================
# REQUEST LOGGING MIDDLEWARE
# ============================================

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware for logging all API requests
    
    Logs:
    - Request method, path, status code
    - Response time
    - Client IP
    - Request ID for tracing
    """
    
    async def dispatch(self, request: Request, call_next: Callable):
        # Generate request ID
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id
        
        # Start timing
        start_time = time.time()
        
        # Get client IP
        client_ip = request.client.host if request.client else "unknown"
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()
        
        # Process request
        try:
            response = await call_next(request)
            
            # Calculate response time
            process_time = time.time() - start_time
            
            # Log successful request
            log_message = (
                f"[{request_id}] "
                f"✅ {request.method} {request.url.path} | "
                f"Status: {response.status_code} | "
                f"Time: {process_time:.3f}s | "
                f"IP: {client_ip}"
            )
            
            if response.status_code >= 400:
                api_logger.warning(log_message)
            else:
                api_logger.info(log_message)
            
            # Add headers
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Response-Time"] = f"{process_time:.3f}s"
            
            return response
            
        except Exception as e:
            # Calculate time even on error
            process_time = time.time() - start_time
            
            # Log error
            error_logger.error(
                f"[{request_id}] "
                f"❌ {request.method} {request.url.path} | "
                f"Error: {str(e)} | "
                f"Time: {process_time:.3f}s | "
                f"IP: {client_ip}",
                exc_info=True
            )
            
            raise


# ============================================
# ERROR HANDLERS
# ============================================

async def app_exception_handler(request: Request, exc: AppException):
    """Handle custom application exceptions"""
    error_logger.error(
        f"[{getattr(request.state, 'request_id', 'N/A')}] "
        f"AppException: {exc.error_code} - {exc.message}"
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": "error",
            "error_code": exc.error_code,
            "message": exc.message,
            "details": exc.details,
            "request_id": getattr(request.state, 'request_id', None),
            "timestamp": datetime.now().isoformat()
        }
    )


async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": "error",
            "error_code": "HTTP_ERROR",
            "message": exc.detail,
            "request_id": getattr(request.state, 'request_id', None),
            "timestamp": datetime.now().isoformat()
        }
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors"""
    errors = []
    for error in exc.errors():
        errors.append({
            "field": ".".join(str(x) for x in error["loc"]),
            "message": error["msg"],
            "type": error["type"]
        })
    
    return JSONResponse(
        status_code=422,
        content={
            "status": "error",
            "error_code": "VALIDATION_ERROR",
            "message": "Request validation failed",
            "errors": errors,
            "request_id": getattr(request.state, 'request_id', None),
            "timestamp": datetime.now().isoformat()
        }
    )


async def generic_exception_handler(request: Request, exc: Exception):
    """Handle all uncaught exceptions"""
    error_id = str(uuid.uuid4())[:8]
    
    error_logger.error(
        f"[{getattr(request.state, 'request_id', 'N/A')}] "
        f"Unhandled exception (Error ID: {error_id}): {str(exc)}",
        exc_info=True
    )
    
    # Don't expose internal errors to client
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "error_code": "INTERNAL_ERROR",
            "message": "An internal error occurred",
            "error_id": error_id,
            "request_id": getattr(request.state, 'request_id', None),
            "timestamp": datetime.now().isoformat()
        }
    )


# ============================================
# SETUP FUNCTION
# ============================================

def setup_error_handling(app: FastAPI):
    """
    Setup all error handlers and middleware for the app
    
    Usage:
        from middleware.error_handler import setup_error_handling
        setup_error_handling(app)
    """
    # Add request logging middleware
    app.add_middleware(RequestLoggingMiddleware)
    
    # Add exception handlers
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, generic_exception_handler)
    
    logging.info("Error handling middleware configured")


def log_request_middleware(app: FastAPI):
    """Alternative: Just add logging middleware without exception handlers"""
    app.add_middleware(RequestLoggingMiddleware)


# ============================================
# UTILITY FUNCTIONS
# ============================================

def log_api_call(
    service: str,
    endpoint: str,
    status: str,
    response_time: float,
    details: dict = None
):
    """
    Log external API calls (Dhan, etc.)
    
    Usage:
        log_api_call("Dhan", "/marketfeed/quote", "success", 0.234)
    """
    log_message = (
        f"[External API] {service} | "
        f"{endpoint} | "
        f"Status: {status} | "
        f"Time: {response_time:.3f}s"
    )
    
    if details:
        log_message += f" | Details: {details}"
    
    if status == "success":
        api_logger.info(log_message)
    else:
        api_logger.warning(log_message)


def log_scanner_execution(
    scanner_name: str,
    stocks_processed: int,
    results_count: int,
    execution_time: float,
    cached: bool = False
):
    """
    Log scanner execution metrics
    
    Usage:
        log_scanner_execution("day_gainers", 150, 12, 1.234, cached=False)
    """
    api_logger.info(
        f"[Scanner] {scanner_name} | "
        f"Processed: {stocks_processed} | "
        f"Results: {results_count} | "
        f"Time: {execution_time:.3f}s | "
        f"Cached: {cached}"
    )


# ============================================
# STANDARDIZED ERROR RESPONSE HELPER
# ============================================

def error_response(
    status_code: int,
    message: str,
    error_code: str = None,
    details: dict = None,
    request_id: str = None
) -> JSONResponse:
    """
    Create a standardized error response
    
    Usage:
        return error_response(400, "Invalid input", "INVALID_INPUT", {"field": "email"})
        return error_response(401, "Not authenticated", "AUTH_REQUIRED")
        return error_response(500, "Database error", "DB_ERROR")
    
    Response format:
        {
            "status": "error",
            "error_code": "AUTH_REQUIRED",
            "message": "Not authenticated",
            "details": {...},
            "request_id": "abc123",
            "timestamp": "2024-01-15T10:30:00.123456"
        }
    """
    # Auto-generate error_code from status if not provided
    if not error_code:
        error_codes = {
            400: "BAD_REQUEST",
            401: "UNAUTHORIZED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            409: "CONFLICT",
            422: "VALIDATION_ERROR",
            429: "RATE_LIMITED",
            500: "INTERNAL_ERROR",
            502: "BAD_GATEWAY",
            503: "SERVICE_UNAVAILABLE"
        }
        error_code = error_codes.get(status_code, "ERROR")
    
    content = {
        "status": "error",
        "error_code": error_code,
        "message": message,
        "timestamp": datetime.now().isoformat()
    }
    
    if details:
        content["details"] = details
    
    if request_id:
        content["request_id"] = request_id
    
    return JSONResponse(status_code=status_code, content=content)


def success_response(
    data: Any,
    message: str = None,
    status_code: int = 200
) -> JSONResponse:
    """
    Create a standardized success response
    
    Usage:
        return success_response({"user_id": "123"}, "User created")
        return success_response(stocks_list)
    
    Response format:
        {
            "status": "success",
            "message": "User created",
            "data": {...},
            "timestamp": "2024-01-15T10:30:00.123456"
        }
    """
    content = {
        "status": "success",
        "data": data,
        "timestamp": datetime.now().isoformat()
    }
    
    if message:
        content["message"] = message
    
    return JSONResponse(status_code=status_code, content=content)
