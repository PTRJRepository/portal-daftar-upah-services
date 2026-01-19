import os
from datetime import timedelta, datetime
from pathlib import Path
import json

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
ACCESS_TOKEN_EXPIRE_DELTA = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

# USE ENVIRONMENT VARIABLES FOR PRODUCTION MODE
TEST_MODE = os.getenv("TEST_MODE", "false").lower() == "true"
DEFAULT_GANG = os.getenv("DEFAULT_GANG", "H1H")
DEFAULT_MONTH = int(os.getenv("DEFAULT_MONTH", "5"))
DEFAULT_YEAR = int(os.getenv("DEFAULT_YEAR", str(datetime.now().year)))

# UPAH DASAR for Impact Report HK calculations
UPAH_DASAR = float(os.getenv("UPAH_DASAR", "129220"))

# TESTING ONLY
_BASE_DIR = Path(__file__).resolve().parents[2]
_TEST_TOKEN_FILE = _BASE_DIR / 'token.json'

def get_testing_token() -> str:
    # TESTING ONLY
    try:
        if _TEST_TOKEN_FILE.exists():
            with _TEST_TOKEN_FILE.open('r', encoding='utf-8') as f:
                content = f.read()
                data = json.loads(content) if content.strip() else {}
            token = (data or {}).get('token')
            if token:
                return token
    except Exception:
        pass
    return os.getenv('TESTING_TOKEN', 'permanent-testing-token')

def _is_true_env(name: str) -> bool:
    v = os.getenv(name, "false")
    return str(v).lower() == "true"

def is_test_mode() -> bool:
    if TEST_MODE:
        return True
    if _is_true_env("DEV_MODE"):
        return True
    if _is_true_env("VITE_DEV_MODE"):
        return True
    return False
