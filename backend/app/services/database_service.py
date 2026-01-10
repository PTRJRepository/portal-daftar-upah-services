import sqlite3
import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any
from passlib.context import CryptContext
from app.models.user import User, UserRole, UserCreate, UserUpdate

# Database path
DB_PATH = Path(__file__).parent.parent.parent / "data" / "users.db"

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class DatabaseService:
    def __init__(self):
        self.db_path = DB_PATH
        self.init_database()

    def init_database(self):
        """Initialize SQLite database with required tables"""
        # Ensure data directory exists
        self.db_path.parent.mkdir(exist_ok=True)

        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()

            # Create users table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    full_name TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'user',
                    divisions TEXT NOT NULL DEFAULT '[]',
                    is_active BOOLEAN NOT NULL DEFAULT 1,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            # Create audit log table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    action TEXT NOT NULL,
                    details TEXT,
                    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            ''')

            # Check if admin user exists, create if not
            cursor.execute("SELECT COUNT(*) FROM users WHERE username = 'admin'")
            admin_exists = cursor.fetchone()[0]

            if not admin_exists:
                self._create_default_admin(cursor)
                conn.commit()

    def _create_default_admin(self, cursor):
        """Create default admin user with access to all divisions"""
        all_divisions = ["PG1A", "PG1B", "PG2A", "PG2B", "DME", "ARA", "ARB1", "ARB2", "INFRA", "AREC", "IJL", "STF-OFFICE", "SECURITY"]
        divisions_json = json.dumps(all_divisions)

        cursor.execute('''
            INSERT INTO users (username, email, password_hash, full_name, role, divisions, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            "admin",
            "admin@payroll.com",
            pwd_context.hash("admin"),
            "System Administrator",
            UserRole.ADMIN,
            divisions_json,
            True
        ))

        # Log admin creation
        cursor.execute('''
            INSERT INTO audit_logs (action, details)
            VALUES (?, ?)
        ''', ("CREATE_ADMIN", "Default admin user created"))

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify password against hash"""
        return pwd_context.verify(plain_password, hashed_password)

    def get_password_hash(self, password: str) -> str:
        """Generate password hash"""
        return pwd_context.hash(password)

    def create_user(self, user_data: UserCreate) -> User:
        """Create new user"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()

            # Check if username or email already exists
            cursor.execute("SELECT id FROM users WHERE username = ? OR email = ?",
                          (user_data.username, user_data.email))
            if cursor.fetchone():
                raise ValueError("Username or email already exists")

            # Create user
            divisions_json = json.dumps(user_data.divisions or [])
            cursor.execute('''
                INSERT INTO users (username, email, password_hash, full_name, role, divisions, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                user_data.username,
                user_data.email,
                self.get_password_hash(user_data.password),
                user_data.full_name,
                user_data.role,
                divisions_json,
                user_data.is_active
            ))

            user_id = cursor.lastrowid

            # Log user creation
            cursor.execute('''
                INSERT INTO audit_logs (user_id, action, details)
                VALUES (?, ?, ?)
            ''', (user_id, "CREATE_USER", f"User {user_data.username} created"))

            conn.commit()
            return self.get_user_by_id(user_id)

    def get_user_by_id(self, user_id: int) -> Optional[User]:
        """Get user by ID"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            cursor.execute('''
                SELECT * FROM users WHERE id = ? AND is_active = 1
            ''', (user_id,))

            row = cursor.fetchone()
            if row:
                divisions = json.loads(row['divisions'])
                return User(
                    id=row['id'],
                    username=row['username'],
                    email=row['email'],
                    full_name=row['full_name'],
                    password_hash=row['password_hash'],
                    role=UserRole(row['role']),
                    divisions=divisions,
                    is_active=bool(row['is_active']),
                    created_at=datetime.fromisoformat(row['created_at']),
                    updated_at=datetime.fromisoformat(row['updated_at'])
                )
        return None

    def get_user_by_username(self, username: str) -> Optional[User]:
        """Get user by username"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            cursor.execute('''
                SELECT * FROM users WHERE username = ? AND is_active = 1
            ''', (username,))

            row = cursor.fetchone()
            if row:
                divisions = json.loads(row['divisions'])
                return User(
                    id=row['id'],
                    username=row['username'],
                    email=row['email'],
                    full_name=row['full_name'],
                    password_hash=row['password_hash'],
                    role=UserRole(row['role']),
                    divisions=divisions,
                    is_active=bool(row['is_active']),
                    created_at=datetime.fromisoformat(row['created_at']),
                    updated_at=datetime.fromisoformat(row['updated_at'])
                )
        return None

    def update_user(self, user_id: int, user_data: UserUpdate) -> Optional[User]:
        """Update user"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()

            # Build update query dynamically
            update_fields = []
            params = []

            if user_data.email is not None:
                update_fields.append("email = ?")
                params.append(user_data.email)

            if user_data.full_name is not None:
                update_fields.append("full_name = ?")
                params.append(user_data.full_name)

            if user_data.role is not None:
                update_fields.append("role = ?")
                params.append(user_data.role)

            if user_data.divisions is not None:
                update_fields.append("divisions = ?")
                params.append(json.dumps(user_data.divisions))

            if user_data.is_active is not None:
                update_fields.append("is_active = ?")
                params.append(user_data.is_active)

            if update_fields:
                update_fields.append("updated_at = CURRENT_TIMESTAMP")
                params.append(user_id)

                query = f"UPDATE users SET {', '.join(update_fields)} WHERE id = ?"
                cursor.execute(query, params)

                # Log update
                cursor.execute('''
                    INSERT INTO audit_logs (user_id, action, details)
                    VALUES (?, ?, ?)
                ''', (user_id, "UPDATE_USER", f"User {user_id} updated"))

                conn.commit()
                return self.get_user_by_id(user_id)

        return None

    def delete_user(self, user_id: int) -> bool:
        """Soft delete user (set is_active = False)"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()

            cursor.execute('''
                UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (user_id,))

            success = cursor.rowcount > 0

            if success:
                cursor.execute('''
                    INSERT INTO audit_logs (user_id, action, details)
                    VALUES (?, ?, ?)
                ''', (user_id, "DELETE_USER", f"User {user_id} deleted"))
                conn.commit()

            return success

    def list_users(self, skip: int = 0, limit: int = 100, active_only: bool = True) -> List[User]:
        """List users with pagination"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            query = "SELECT * FROM users"
            params = []

            if active_only:
                query += " WHERE is_active = 1"

            query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
            params.extend([limit, skip])

            cursor.execute(query, params)

            users = []
            for row in cursor.fetchall():
                divisions = json.loads(row['divisions'])
                users.append(User(
                    id=row['id'],
                    username=row['username'],
                    email=row['email'],
                    full_name=row['full_name'],
                    password_hash=row['password_hash'],
                    role=UserRole(row['role']),
                    divisions=divisions,
                    is_active=bool(row['is_active']),
                    created_at=datetime.fromisoformat(row['created_at']),
                    updated_at=datetime.fromisoformat(row['updated_at'])
                ))

            return users

    def authenticate_user(self, username: str, password: str) -> Optional[User]:
        """Authenticate user"""
        user = self.get_user_by_username(username)
        if user and self.verify_password(password, user.password_hash):
            # Log successful login
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO audit_logs (user_id, action, details)
                    VALUES (?, ?, ?)
                ''', (user.id, "LOGIN_SUCCESS", f"User {username} logged in"))
                conn.commit()
            return user

        # Log failed login attempt
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO audit_logs (action, details)
                VALUES (?, ?)
            ''', ("LOGIN_FAILED", f"Failed login attempt for {username}"))
            conn.commit()

        return None

# Global database instance
db_service = DatabaseService()