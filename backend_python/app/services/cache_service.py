"""
Simple cache service for performance optimization
Reduces database queries by caching frequently accessed data
"""

import time
from typing import Any, Dict, Optional
import threading
import logging
import os

logger = logging.getLogger(__name__)

class CacheService:
    _instance = None
    _lock = threading.Lock()

    def __init__(self):
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.RLock()
        self._default_ttl = 300  # 5 minutes default TTL

    @classmethod
    def instance(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = CacheService()
            return cls._instance

    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        try:
            # Check explicit disable flag first
            if str(os.getenv('DISABLE_CACHE', 'false')).lower() == 'true':
                return None
            
            # Check for production cache override (allows cache in production even if DEV_MODE is set)
            production_cache = str(os.getenv('ENABLE_PRODUCTION_CACHE', 'false')).lower() == 'true'
            if not production_cache:
                # If no production override, check dev/test mode flags
                if str(os.getenv('TEST_MODE', 'false')).lower() == 'true' or \
                   str(os.getenv('DEV_MODE', 'false')).lower() == 'true' or \
                   str(os.getenv('VITE_DEV_MODE', 'false')).lower() == 'true':
                    return None
        except Exception:
            pass
        with self._lock:
            if key in self._cache:
                entry = self._cache[key]
                if time.time() < entry['expires_at']:
                    logger.debug(f"Cache hit for key: {key}")
                    return entry['value']
                else:
                    # Cache expired
                    del self._cache[key]
                    logger.debug(f"Cache expired for key: {key}")
        return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value in cache with TTL"""
        try:
            # Check explicit disable flag first
            if str(os.getenv('DISABLE_CACHE', 'false')).lower() == 'true':
                return
            
            # Check for production cache override
            production_cache = str(os.getenv('ENABLE_PRODUCTION_CACHE', 'false')).lower() == 'true'
            if not production_cache:
                if str(os.getenv('TEST_MODE', 'false')).lower() == 'true' or \
                   str(os.getenv('DEV_MODE', 'false')).lower() == 'true' or \
                   str(os.getenv('VITE_DEV_MODE', 'false')).lower() == 'true':
                    return
        except Exception:
            pass
        ttl = ttl or self._default_ttl
        expires_at = time.time() + ttl

        with self._lock:
            self._cache[key] = {
                'value': value,
                'expires_at': expires_at,
                'created_at': time.time()
            }
            logger.debug(f"Cached data for key: {key} (TTL: {ttl}s)")

    def delete(self, key: str) -> bool:
        """Delete key from cache"""
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
        return False

    def clear_expired(self) -> int:
        """Clear expired entries and return count of cleared items"""
        current_time = time.time()
        expired_keys = []

        with self._lock:
            for key, entry in self._cache.items():
                if current_time >= entry['expires_at']:
                    expired_keys.append(key)

            for key in expired_keys:
                del self._cache[key]

        if expired_keys:
            logger.info(f"Cleared {len(expired_keys)} expired cache entries")

        return len(expired_keys)

    def clear_all(self) -> None:
        """Clear all cache entries"""
        with self._lock:
            count = len(self._cache)
            self._cache.clear()
            logger.info(f"Cleared all cache entries ({count} items)")

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        current_time = time.time()
        valid_count = 0
        expired_count = 0

        with self._lock:
            total_count = len(self._cache)
            for entry in self._cache.values():
                if current_time < entry['expires_at']:
                    valid_count += 1
                else:
                    expired_count += 1

        return {
            'total_entries': total_count,
            'valid_entries': valid_count,
            'expired_entries': expired_count,
            'memory_usage_estimate_bytes': total_count * 1000  # Rough estimate
        }

    def memoize(self, ttl: Optional[int] = None):
        """Decorator for memoizing function results"""
        def decorator(func):
            def wrapper(*args, **kwargs):
                # Create cache key from function name and arguments
                cache_key = f"{func.__name__}:{hash(str(args) + str(sorted(kwargs.items())))}"

                # Try to get from cache
                result = self.get(cache_key)
                if result is not None:
                    return result

                # Execute function and cache result
                result = func(*args, **kwargs)
                self.set(cache_key, result, ttl)
                return result

            return wrapper
        return decorator
