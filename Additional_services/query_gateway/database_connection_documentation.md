# Database Connection Documentation

## Overview
This document describes the database connection architecture and requirements for accessing the database through endpoints in the payroll system. The system uses Microsoft SQL Server as the primary database with multiple connection patterns for different use cases.

## Current Database Connection Patterns

### 1. Direct Database Connections (db_connection.py)
The system uses direct database connections through the `db_connection.py` module with two primary connection types:

#### EXTEND_DB_PTRJ Connection (Write Operations)
- **Purpose**: For write operations to the `extend_db_ptrj` database
- **Connection Method**: Uses environment variables for configuration
- **Driver**: ODBC Driver 17 for SQL Server
- **Server**: 10.0.0.110 (default)
- **Port**: 1433 (default)
- **Username**: sa (default)
- **Password**: ptrj@123 (default)
- **Database**: extend_db_ptrj (default)

#### DB_PTRJ Connection (Read Operations)
- **Purpose**: For read-only operations from the `db_ptrj` database
- **Connection Method**: Hardcoded connection parameters
- **Driver**: ODBC Driver 17 for SQL Server
- **Server**: 10.0.0.110
- **Port**: 1433
- **Username**: sa
- **Password**: ptrj@123
- **Database**: db_ptrj

### 2. Connection Pool Implementation (Backend)
The backend implements a sophisticated connection pool system:

#### Database Service (database.py)
- **Connection Pooling**: Implements a queue-based connection pool
- **Auto-scaling**: Pool size calculated as `max(20, workers × 5)`
- **Health Checks**: Connection health verification before use
- **Retry Logic**: Automatic retry with exponential backoff
- **Timeouts**: Configurable connection and query timeouts
- **Thread Safety**: Singleton pattern with thread locks

#### Configuration Management (settings.py)
- **Profile-based Configuration**: Multiple database profiles (local, remote, etc.)
- **Environment Override**: Environment variables can override config settings
- **Flexible Connection Strings**: Dynamic connection string generation

## Database Configuration Profiles

The system supports multiple database profiles defined in `config.json`:

- **local**: Local SQL Server instance
- **remote**: Remote server at 10.0.0.110
- **remote_2**: Alternative remote server at 10.0.0.2
- **local-server-2**: Alternative local configuration

## Connection Security Considerations

1. **Authentication**: SQL Server authentication with username/password
2. **Encryption**: Configurable encryption settings
3. **Connection Pooling**: Reuses connections to reduce overhead
4. **Environment Variables**: Sensitive credentials stored in environment variables
5. **Timeout Management**: Configurable timeouts to prevent hanging connections

## Current Endpoint Architecture

The query gateway (AI_CONTEXT.md) provides a REST API for database access:

### API Endpoints
- **GET /health**: Service health check
- **GET /v1/databases**: List available database aliases
- **POST /v1/query**: Execute single SQL statement
- **POST /v1/query/batch**: Execute atomic transaction

### Authentication
- **Mechanism**: Static API Token via `x-api-key` header
- **Configuration**: Set via `API_TOKEN` environment variable

### Request/Response Format
- **Standard Response Wrapper**: Consistent response structure
- **Parameterized Queries**: Mandatory parameterization to prevent SQL injection
- **Date Handling**: ISO 8601 format for date parameters

## Connection Methods Summary

1. **Direct Python Connections**: Used in aggregation scripts and GUI applications
2. **Connection Pool**: Used in backend services for high-performance operations
3. **REST API Gateway**: Used for external access to database operations
4. **Environment-based Configuration**: Flexible configuration through environment variables