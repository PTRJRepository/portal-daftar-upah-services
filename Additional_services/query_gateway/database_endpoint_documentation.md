# Database Connection and Endpoint Access Documentation

## Table of Contents
1. [Database Connection Overview](#database-connection-overview)
2. [Current Connection Patterns](#current-connection-patterns)
3. [Database Configuration](#database-configuration)
4. [Endpoint Access Requirements](#endpoint-access-requirements)
5. [Security Considerations](#security-considerations)
6. [Implementation Guidelines](#implementation-guidelines)

## Database Connection Overview

The payroll system uses Microsoft SQL Server as the primary database with multiple connection patterns for different use cases. The system implements both direct database connections and a sophisticated connection pool system for high-performance operations.

### Key Components
- **Direct Database Connections**: Used in aggregation scripts and GUI applications
- **Connection Pool**: Used in backend services for high-performance operations
- **REST API Gateway**: Used for external access to database operations
- **Environment-based Configuration**: Flexible configuration through environment variables

## Current Connection Patterns

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

## Current Endpoint Architecture

The query gateway provides a REST API for database access:

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

## Endpoint Access Requirements

### Technical Requirements

#### 1. Database Connectivity
- **Database Type**: Microsoft SQL Server
- **Connection Method**: ODBC Driver 17 for SQL Server
- **Connection Pooling**: Implement connection pooling for performance
- **Health Checks**: Include connection health verification
- **Timeout Management**: Configurable connection and query timeouts
- **Retry Logic**: Implement retry mechanism with exponential backoff

#### 2. Security Requirements
- **Authentication**: API token-based authentication using `x-api-key` header
- **Authorization**: Role-based access control for different database operations
- **SQL Injection Prevention**: Mandatory parameterized queries only
- **Connection Encryption**: Support for encrypted connections
- **Credential Management**: Store sensitive credentials in environment variables
- **Input Validation**: Validate all input parameters before query execution

#### 3. API Design Requirements
- **RESTful Design**: Follow REST principles for endpoint design
- **Standard Response Format**: Use consistent response structure with success/error indicators
- **HTTP Methods**: Use appropriate HTTP methods (GET, POST, PUT, DELETE)
- **Error Handling**: Comprehensive error handling with descriptive messages
- **Rate Limiting**: Implement rate limiting to prevent abuse

#### 4. Performance Requirements
- **Connection Pool Size**: Auto-scale based on worker count (min 20, workers × 5)
- **Query Timeout**: Configurable query timeout (default 30 seconds)
- **Connection Timeout**: Configurable connection timeout (default 60 seconds)
- **Concurrent Requests**: Support for concurrent database requests
- **Caching**: Implement caching for frequently accessed data

### Implementation Requirements

#### 1. Configuration Management
- **Environment Variables**: Support for environment-based configuration
- **Multiple Profiles**: Support for different database profiles (local, remote, etc.)
- **Flexible Connection Strings**: Dynamic connection string generation
- **Configuration Validation**: Validate configuration parameters before use

#### 2. Development Environment
- **Python Version**: Compatible with the existing Python environment
- **Dependencies**: Use existing dependencies where possible (pyodbc, etc.)
- **Virtual Environment**: Use virtual environment for dependency management
- **Code Standards**: Follow existing code formatting and naming conventions

#### 3. Database Access Patterns
- **Read/Write Separation**: Separate connections for read and write operations
- **Transaction Support**: Support for database transactions
- **Batch Operations**: Support for batch query execution
- **Cursor Management**: Proper cursor opening/closing and resource cleanup

## Security Considerations

### Authentication Implementation
- **API Token**: Implement static API token authentication
- **Token Storage**: Secure token storage and validation
- **Token Rotation**: Support for token rotation and management
- **Access Logging**: Log all access attempts for audit purposes

### Input Sanitization
- **Parameter Validation**: Validate all input parameters
- **SQL Injection Prevention**: Use parameterized queries exclusively
- **Type Checking**: Validate data types before database operations
- **Length Limits**: Implement reasonable limits on input sizes

### Network Security
- **Firewall Configuration**: Configure firewall rules for database access
- **VPN/SSH Tunnels**: Support for secure network connections
- **IP Whitelisting**: Implement IP-based access controls if needed
- **Network Encryption**: Use encrypted connections (TLS/SSL)

## Implementation Guidelines

### 1. Development Best Practices
- Follow the existing code structure and naming conventions
- Use the same error handling patterns as the existing codebase
- Implement proper resource cleanup (connections, cursors, etc.)
- Use logging consistently with the existing patterns

### 2. Testing Requirements
- **Unit Tests**: Comprehensive unit tests for database operations
- **Integration Tests**: Integration tests for endpoint functionality
- **Security Tests**: Security testing for authentication and authorization
- **Performance Tests**: Performance testing under load conditions

### 3. Deployment Considerations
- **Server Requirements**: Adequate server resources for connection pooling
- **Database Server**: Access to SQL Server instance
- **Network Configuration**: Proper network connectivity to database
- **Load Balancing**: Support for load balancing if needed

### 4. Monitoring and Maintenance
- **Connection Logs**: Log all database connection attempts
- **Query Logs**: Log executed queries for debugging
- **Error Logs**: Comprehensive error logging
- **Performance Metrics**: Monitor query execution times
- **Health Checks**: Regular health checks for database connectivity
- **Alerting**: Set up alerts for connection failures

## Example Implementation

### Basic Endpoint Structure
```python
from fastapi import FastAPI, HTTPException, Depends
from typing import Optional
import pyodbc
from database.services.database import Database

app = FastAPI()

def get_db():
    db = Database.instance()
    conn = db.acquire()
    try:
        yield conn
    finally:
        db.release(conn)

@app.post("/query")
async def execute_query(sql: str, params: Optional[dict] = None, db=Depends(get_db)):
    # Validate input
    if not sql or not isinstance(sql, str):
        raise HTTPException(status_code=400, detail="Invalid SQL query")
    
    # Execute query using parameterized approach
    cursor = db.cursor()
    try:
        if params:
            cursor.execute(sql, params)
        else:
            cursor.execute(sql)
        results = cursor.fetchall()
        return {"success": True, "data": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
```

### Configuration Example
```json
{
  "database": {
    "driver": "ODBC Driver 17 for SQL Server",
    "server": "localhost",
    "port": 1433,
    "username": "sa",
    "password": "windows0819",
    "database_name": "db_ptrj",
    "trusted_connection": false,
    "encrypt": false
  },
  "database_profiles": {
    "local": {
      "driver": "ODBC Driver 17 for SQL Server",
      "server": "localhost",
      "port": 1433,
      "username": "sa",
      "password": "windows0819",
      "database_name": "db_ptrj",
      "trusted_connection": false,
      "encrypt": false
    },
    "remote": {
      "driver": "ODBC Driver 17 for SQL Server",
      "server": "10.0.0.110",
      "port": 1433,
      "username": "sa",
      "password": "ptrj@123",
      "database_name": "db_ptrj",
      "trusted_connection": false,
      "encrypt": false
    }
  }
}
```

## Conclusion

This documentation provides a comprehensive overview of the current database connection patterns and requirements for implementing endpoint access to the database. When implementing new endpoints, ensure to follow the established patterns, security practices, and performance considerations outlined in this document.