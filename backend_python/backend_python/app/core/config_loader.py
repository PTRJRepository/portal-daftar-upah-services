import os
import argparse
import logging
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

def load_env_file():
    """Manually load environment variables from a .env file if python-dotenv is not available."""
    try:
        # Try to find .env in root or backend folder
        # config_loader.py is in backend/app/core/
        base_dir = Path(__file__).resolve().parent.parent.parent
        root_dir = base_dir.parent
        
        env_paths = [
            root_dir / ".env",      # refactor_production/.env
            base_dir / ".env"       # backend/.env
        ]
        
        env_path = None
        for p in env_paths:
            if p.exists():
                env_path = p
                break
        
        if env_path:
            logger.info(f"Loading environment variables from {env_path}")
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        key, value = line.split("=", 1)
                        key = key.strip()
                        value = value.strip().strip('"').strip("'")
                        # Only set if not already in environment (CLI/Shell takes precedence)
                        if key and key not in os.environ:
                            os.environ[key] = value
    except Exception as e:
        logger.warning(f"Failed to load .env file: {e}")

@dataclass
class AppConfig:
    """Holds the application's runtime configuration."""
    run_mode: str
    mode_ip: str | list[str]
    host: str
    port: int
    workers: int
    dev_mode: bool
    proxy_mode: bool = False  # True = external RS256 auth, False = internal HS256 auth

def _get_config_from_env_or_cli(args, key: str, env_var: str, default, type_cast=str):
    """Helper to get config value from CLI > Env Var > Default."""
    value = default
    # 1. CLI argument
    if args and hasattr(args, key) and getattr(args, key) is not None:
        value = getattr(args, key)
    # 2. Environment variable
    else:
        try:
            env_value = os.getenv(env_var)
            if env_value is not None:
                value = type_cast(env_value)
        except (ValueError, TypeError):
            logger.warning(
                f"Invalid value for environment variable {env_var}. "
                f"Using default value: {default}."
            )
    return value

def load_and_configure():
    """
    Parses CLI arguments, sets environment variables, and returns the
    application configuration. CLI arguments take precedence over environment vars.
    """
    # 0. Load .env file
    load_env_file()

    parser = argparse.ArgumentParser(
        description="Payroll Backend Server",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Mode Examples:
  python main.py --mode dev     # Development mode (localhost + 10.0.0.128)
  python main.py --mode prod    # Production mode (10.0.0.110)
  python main.py --mode dev --custom-ip 192.168.1.100  # Custom IP for dev mode
        """
    )
    # Mode arguments
    parser.add_argument("--mode", choices=["dev", "prod"], help="Run mode")
    parser.add_argument("--custom-ip", help="Custom IP address to override mode-based IP")
    # Server arguments
    parser.add_argument("--host", help="Bind host (default: 0.0.0.0)")
    parser.add_argument("--uvicorn-workers", type=int, help="Number of Uvicorn workers")
    parser.add_argument("--port", type=int, help="Backend HTTP port")
    parser.add_argument("--proxy", action="store_true", help="Enable proxy mode (use external RS256 auth)")
    # Database arguments (used to set environment variables)
    parser.add_argument("--db-driver", help="Database driver")
    parser.add_argument("--db-server", help="Database server")
    parser.add_argument("--db-port", type=int, help="Database port")
    parser.add_argument("--db-name", help="Database name")
    parser.add_argument("--db-user", help="Database user")
    parser.add_argument("--db-pass", help="Database password")
    parser.add_argument("--db-profile", help="Database profile")

    args = parser.parse_args()

    # --- Set Environment Variables from CLI (CLI takes precedence) ---
    db_args = {
        "DB_DRIVER": args.db_driver, "DB_SERVER": args.db_server,
        "DB_PORT": args.db_port, "DB_NAME": args.db_name,
        "DB_USER": args.db_user, "DB_PASS": args.db_pass,
        "DB_PROFILE": args.db_profile
    }
    for env_key, value in db_args.items():
        if value is not None:
            os.environ[env_key] = str(value)

    # --- Determine Core Configuration ---
    run_mode = _get_config_from_env_or_cli(args, 'mode', 'RUN_MODE', 'dev')
    os.environ["RUN_MODE"] = run_mode

    # --- Database Configuration based on Mode (if not provided via CLI) ---
    cli_db_provided = any(
        getattr(args, k) is not None 
        for k in ["db_driver", "db_server", "db_port", "db_name", "db_user", "db_pass", "db_profile"]
    )

    if not cli_db_provided:
        # Set DB_PROFILE based on run_mode
        if run_mode == "prod":
            logger.info("Setting Database Profile to 'remote_2' for PROD mode")
            os.environ["DB_PROFILE"] = "remote_2"
        elif run_mode == "dev":
            logger.info("Setting Database Profile to 'remote' for DEV mode")
            os.environ["DB_PROFILE"] = "remote"

    # Determine Mode IP based on run_mode and custom_ip
    mode_ip = _get_config_from_env_or_cli(args, 'custom_ip', 'MODE_IP', None)
    if not mode_ip:
        if run_mode == "dev":
            mode_ip = ["localhost", "10.0.0.128"]
        elif run_mode == "prod":
            mode_ip = "10.0.0.110"
    
    # Store MODE_IP consistently as a string in the environment
    ip_for_env = ", ".join(mode_ip) if isinstance(mode_ip, list) else mode_ip
    if ip_for_env:
        os.environ["MODE_IP"] = ip_for_env

    # --- Finalize AppConfig ---
    host = _get_config_from_env_or_cli(args, 'host', 'HOST', '0.0.0.0')
    port = _get_config_from_env_or_cli(args, 'port', 'BACKEND_PORT', 8002, int)
    
    # Auto-calculate default workers based on CPU cores for better concurrency
    # Prevents single-worker bottleneck where one request blocks all users
    import multiprocessing
    default_workers = min(4, max(2, multiprocessing.cpu_count()))
    workers = _get_config_from_env_or_cli(args, 'uvicorn_workers', 'UVICORN_WORKERS', default_workers, int)
    
    dev_mode = os.getenv("DEV_MODE", "false").lower() == "true"
    proxy_mode = getattr(args, 'proxy', False)

    config = AppConfig(
        run_mode=run_mode,
        mode_ip=mode_ip,
        host=host,
        port=port,
        workers=workers,
        dev_mode=dev_mode,
        proxy_mode=proxy_mode
    )

    log_configuration(config)

    return config

def log_configuration(config: AppConfig):
    """Logs the final server configuration."""
    def get_mode_ip_str(mode_ip):
        if isinstance(mode_ip, list):
            return ", ".join(mode_ip)
        return mode_ip or "Not Set"

    logger.info("="*60)
    logger.info("PAYROLL BACKEND SERVER CONFIGURATION")
    logger.info("="*60)
    logger.info(f"🚀 Run Mode: {config.run_mode or 'default'}")
    logger.info(f"🌐 Mode IP: {get_mode_ip_str(config.mode_ip)}")
    logger.info(f"🔗 Host: {config.host}")
    logger.info(f"📡 Port: {config.port}")
    logger.info(f"⚙️  Workers: {config.workers}")
    logger.info(f"🔧 Dev Mode: {config.dev_mode}")
    auth_mode = "EXTERNAL (RS256)" if config.proxy_mode else "INTERNAL (HS256)"
    logger.info(f"🔐 Auth Mode: {auth_mode}")
    logger.info(f"🌐 Proxy Mode: {config.proxy_mode}")

    logger.info(f"📋 Access URLs:")
    if config.mode_ip:
        ips = config.mode_ip if isinstance(config.mode_ip, list) else [config.mode_ip]
        for ip in ips:
            logger.info(f"   • http://{ip}:{config.port}")
    else:
        logger.info(f"   • http://localhost:{config.port}")
    logger.info("="*60)
