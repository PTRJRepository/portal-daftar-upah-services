import uvicorn
import os
import sys
import logging
import argparse
import signal
from contextlib import asynccontextmanager

# Configure logging FIRST
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# =============================================================================
# CRITICAL: Parse CLI args and set DB_PROFILE BEFORE any database imports
# This ensures the database connection pool is created with the correct profile
# =============================================================================
def _early_set_db_profile():
    """Parse mode argument early and set DB_PROFILE before any imports."""
    # Quick parse just for --mode argument
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--mode", choices=["dev", "prod"], default="dev")
    parser.add_argument("--db-profile", default=None)
    parser.add_argument("--proxy", action="store_true")
    args, _ = parser.parse_known_args()
    
    # Set DB_PROFILE based on mode BEFORE any database imports
    if args.db_profile:
        os.environ["DB_PROFILE"] = args.db_profile
        logger.info(f"🗄️ Database Profile set from CLI: {args.db_profile}")
    elif args.mode == "prod":
        os.environ["DB_PROFILE"] = "remote_2"
        logger.info("🗄️ Database Profile set to 'remote_2' for PROD mode (EARLY)")
    else:
        os.environ["DB_PROFILE"] = "remote"
        logger.info("🗄️ Database Profile set to 'remote' for DEV mode (EARLY)")
    
    # Set AUTH_MODE based on --proxy flag
    if args.proxy:
        os.environ["AUTH_MODE"] = "external"
        logger.info("🔐 Auth Mode: EXTERNAL (RS256 with backend/keys)")
    else:
        os.environ["AUTH_MODE"] = "internal"
        logger.info("🔐 Auth Mode: INTERNAL (HS256 with user database)")
    
    os.environ["RUN_MODE"] = args.mode
    return args.mode

# Set DB profile BEFORE importing modules that use database
_early_mode = _early_set_db_profile()

# Now safe to import FastAPI and other modules
from fastapi import FastAPI, Request, Response
# from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from app.core.config import (
    is_test_mode,
    TEST_MODE,
    DEFAULT_GANG,
    DEFAULT_MONTH,
    DEFAULT_YEAR,
    get_testing_token,
)
from app.core.config_loader import load_and_configure, AppConfig

# Global variables for mode and IP - These will be populated by the config loader
RUN_MODE: str = None
MODE_IP: str | list[str] = None
DEV_MODE: bool = False

# Shutdown flag for graceful exit
_shutdown_event = None

def get_mode_ip():
    """Returns a string representation of the mode IP."""
    if isinstance(MODE_IP, list):
        return ", ".join(MODE_IP)
    return MODE_IP


# =============================================================================
# LIFESPAN CONTEXT MANAGER FOR GRACEFUL STARTUP/SHUTDOWN
# =============================================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events.
    Handles graceful shutdown when Ctrl+C is pressed.
    """
    # Startup
    logger.info("🚀 Application starting up...")
    
    yield
    
    # Shutdown
    logger.info("🛑 Application shutting down gracefully...")
    
    # Close database connections if any
    try:
        from database.services.database import Database
        if Database._instance is not None:
            # Close the httpx client
            if hasattr(Database._instance, '_client') and Database._instance._client:
                Database._instance._client.close()
                logger.info("✅ Database client closed")
    except Exception as e:
        logger.warning(f"⚠️ Error closing database client: {e}")
    
    logger.info("✅ Shutdown complete")


app = FastAPI(lifespan=lifespan)

# Combined Middleware for CORS, Logging, and Security Headers
@app.middleware("http")
async def combined_middleware(request: Request, call_next):
    import time
    start_time = time.perf_counter()

    # Get the requesting origin or use localhost as fallback
    origin = request.headers.get("Origin", "http://localhost:5175")

    # Handle Preflight OPTIONS request
    if request.method == "OPTIONS":
        response = Response(status_code=200)
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Set-Cookie, Authorization, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version"
        return response

    # Handle actual request
    response = await call_next(request)
    
    # Calculate duration
    duration_ms = int((time.perf_counter() - start_time) * 1000)

    # Sanitize query string to avoid logging sensitive data
    sanitized_query = str(request.url.query)
    sensitive_params = ["password", "token", "secret"]
    for param in sensitive_params:
        if param in sanitized_query:
            sanitized_query = sanitized_query.replace(
                f"{param}={request.query_params.get(param)}",
                f"{param}=***"
            )
            
    # Log the request
    request_logger = logging.getLogger("app.request")
    request_logger.info(
        f"{request.method} {request.url.path}?{sanitized_query} "
        f"{response.status_code} {duration_ms}ms test_mode={is_test_mode()}"
    )

    # Apply CORS and security headers to the final response
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Set-Cookie, Authorization, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version"
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count, X-Execution-Time-Ms"
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")

    return response

# =============================================================================
# PROXY PREFIX STRIPPING
# When running behind a reverse proxy that doesn't strip the path prefix
# (e.g., /backend/upah -> localhost:8002/backend/upah instead of /),
# this middleware strips the prefix from incoming requests.
# IMPORTANT: This middleware is registered AFTER combined_middleware so it
# executes FIRST (FastAPI executes middlewares in reverse registration order).
# =============================================================================
PROXY_STRIP_PREFIX = os.getenv("PROXY_STRIP_PREFIX", "/backend/upah")

@app.middleware("http")
async def strip_proxy_prefix(request: Request, call_next):
    """Strip proxy prefix from path if the request path starts with it."""
    if PROXY_STRIP_PREFIX and request.url.path.startswith(PROXY_STRIP_PREFIX):
        # Create new scope with stripped path
        scope = request.scope.copy()
        original_path = request.url.path
        new_path = original_path[len(PROXY_STRIP_PREFIX):]
        # Ensure path starts with /
        if not new_path.startswith('/'):
            new_path = '/' + new_path
        scope["path"] = new_path
        scope["raw_path"] = new_path.encode()
        logger.info(f"🔀 Stripped proxy prefix: {original_path} -> {new_path}")
        # Create new request with modified scope
        from starlette.requests import Request as StarletteRequest
        request = StarletteRequest(scope, request.receive)
    return await call_next(request)

# Development mode info endpoint
@app.get("/dev-mode")
async def get_dev_mode():
    return {
        "dev_mode": DEV_MODE,
        "run_mode": RUN_MODE,
        "auth_mode": os.getenv("AUTH_MODE", "internal"),
        "mode_ip": get_mode_ip(),
        "test_mode": is_test_mode(),
        "test_mode_hardcoded": TEST_MODE,
        "default_gang": DEFAULT_GANG,
        "default_month": DEFAULT_MONTH,
        "default_year": DEFAULT_YEAR,
        "has_testing_token": bool(get_testing_token()),
        "environment_vars": {
            "TEST_MODE": os.getenv("TEST_MODE"),
            "DEV_MODE": os.getenv("DEV_MODE"),
            "VITE_DEV_MODE": os.getenv("VITE_DEV_MODE"),
            "DB_PROFILE": os.getenv("DB_PROFILE"),
        },
    }

from app.api import router as api_router
app.include_router(api_router)

# =============================================================================
# STATIC FILES & SPA SERVING
# =============================================================================
# Frontend serving is handled by Vite (Dev) or Nginx/Apache (Prod)
# Backend only serves API endpoints

if __name__ == "__main__":
    # Load full configuration from CLI args and environment variables
    config = load_and_configure()
    
    # Set global variables based on the loaded configuration
    DEV_MODE = config.dev_mode
    RUN_MODE = config.run_mode
    MODE_IP = config.mode_ip

    # For Windows, single worker mode works better with Ctrl+C
    # Multi-worker mode on Windows has issues with signal handling
    workers = config.workers
    if sys.platform == "win32" and workers > 1:
        logger.warning(f"⚠️ Windows detected: Reducing workers from {workers} to 1 for proper Ctrl+C handling")
        workers = 1

    # Run the Uvicorn server with proper signal handling
    uvicorn_config = uvicorn.Config(
        "main:app",
        host=config.host,
        port=config.port,
        workers=workers,
        log_level="info",
        timeout_graceful_shutdown=5,  # 5 seconds to gracefully shutdown
    )
    
    server = uvicorn.Server(uvicorn_config)
    
    # Handle shutdown signals properly
    def signal_handler(signum, frame):
        logger.info(f"🛑 Received signal {signum}, initiating shutdown...")
        server.should_exit = True
    
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        server.run()
    except KeyboardInterrupt:
        logger.info("🛑 KeyboardInterrupt received, shutting down...")
    except Exception as e:
        logger.error(f"❌ Server error: {e}")
    finally:
        logger.info("👋 Server stopped")
