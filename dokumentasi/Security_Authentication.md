# Security and Authentication Documentation

## Overview
The backend system implements a comprehensive security framework with JWT-based authentication, role-based access control (RBAC), and multiple layers of security to protect sensitive payroll data.

## Authentication System

### JWT-Based Authentication
- **Token Type**: JSON Web Tokens (JWT)
- **Algorithm**: HS256 (HMAC with SHA-256)
- **Token Structure**: Contains user information and role claims
- **Token Expiration**: Configurable expiration time
- **Header Format**: `Authorization: Bearer <token>`

### Authentication Endpoints
- **POST `/auth/login`**: User authentication and token generation
- **GET `/auth/me`**: Verify token and get user information
- **GET `/users/me`**: Get current user details

### Token Generation and Verification
- **Secret Key**: Secure signing key for token creation
- **Payload**: Contains user ID, role, and permissions
- **Validation**: Middleware to verify tokens on protected endpoints
- **Expiration**: Automatic token expiration to limit session duration

## Role-Based Access Control (RBAC)

### User Roles
- **Admin**: Full system access, including all divisions and gangs
- **Manager**: Access to specific divisions based on assigned permissions
- **User**: Limited access based on assigned roles and permissions

### Access Control Implementation
- **Division Level**: Users can access only assigned divisions
- **Gang Level**: Gang access controlled by user's division permissions
- **Endpoint Protection**: Middleware ensures role-based access to endpoints

## Security Middleware

### Authentication Middleware
- **Token Verification**: Validates JWT tokens on protected routes
- **User Extraction**: Extracts user information from valid tokens
- **Permission Checking**: Verifies user permissions for requested resources

### CORS Protection
- **Origin Validation**: Validates request origins in development and production
- **Allowed Origins**: 
  - Development: localhost, 127.0.0.1, 10.x.x.x, 192.168.x.x, 10.0.0.110
  - Production: Specific production origins
- **Credentials**: Secure credential handling with `Access-Control-Allow-Credentials: true`

### Custom CORS Middleware
- **Runtime Configuration**: Dynamic CORS rules based on environment
- **Network Access**: Supports local network access for development
- **Security Validation**: Validates origins before setting CORS headers

## API Security Features

### Request Security
- **Parameter Validation**: Pydantic models validate all input parameters
- **SQL Injection Prevention**: All database queries use parameterized statements
- **Input Sanitization**: Query parameter sanitization to prevent injection attacks
- **Sensitive Data Protection**: Sanitized logging to prevent sensitive data logging

### Response Security
- **Referrer Policy**: `strict-origin-when-cross-origin` header to prevent referrer leaks
- **Security Headers**: Appropriate security headers applied to responses
- **Data Exposure Control**: Only authorized data returned in responses

### Rate Limiting Considerations
- **Timeout Protection**: Configurable request timeouts to prevent DoS
- **Concurrent Request Limits**: FastAPI handles concurrent requests safely
- **Resource Limits**: Connection pooling and resource management

## Data Security

### Database Security
- **Parameterized Queries**: All SQL queries use parameterized statements
- **Connection Security**: Encrypted connections where supported
- **Access Control**: Database-level user permissions
- **Connection Strings**: Secure handling of connection strings

### Sensitive Information Protection
- **Environment Variables**: Sensitive configuration stored in environment variables
- **Configuration Security**: Database credentials and API keys protected
- **Password Security**: Passwords stored securely (if applicable)
- **Token Security**: JWT tokens with secure signing

## Security Headers and Protection

### Request Logging Security
- **Sensitive Data Sanitization**: Query parameters containing sensitive data are sanitized
- **Access Logging**: All requests logged with sensitive data removed
- **Performance Monitoring**: Response times logged without sensitive information

### HTTP Security Headers
- **Referrer Policy**: `strict-origin-when-cross-origin`
- **CORS Headers**: Properly configured CORS headers for web security
- **Authentication Headers**: Secure handling of authentication tokens

## Security Implementation Details

### Authentication Service (`app/services/auth_service.py`)
- **Token Generation**: Creates signed JWT tokens
- **User Verification**: Validates user credentials
- **Password Hashing**: Secure password hashing using bcrypt
- **Token Refresh**: Optional token refresh functionality

### Security Utilities (`app/core/security.py`)
- **Password Hashing**: bcrypt implementation for password security
- **Token Utilities**: JWT creation and verification functions
- **Security Constants**: Secure configuration values

### Protected Endpoints Pattern
Most endpoints use the following dependency injection pattern:
```python
user=Depends(get_current_user_from_token)
```

This ensures authentication is required before processing the request.

## Security Testing and Debugging

### Test Mode Security
- **Environment Isolation**: Test mode has separate security configurations
- **Mock Authentication**: Testing authentication without real credentials
- **Security Bypass**: Controlled security bypass for testing purposes

### Debug Endpoints Security
- **Authentication Required**: Debug endpoints also require authentication
- **Limited Access**: Debug information sanitized for security
- **Admin Only**: Some debug endpoints limited to admin users

## Environment Security

### Development vs Production Security
- **Development Mode**: More permissive CORS settings for development
- **Production Mode**: Stricter security settings and validation
- **Local Network Access**: Controlled access for local development

### Network Security
- **IP Address Validation**: Validates IP addresses in network mode
- **Network Access Control**: Controls access based on network configuration
- **Secure Communication**: Encrypted communication where available

## Security Best Practices

### Token Management
- **Short-lived Tokens**: Tokens with reasonable expiration times
- **Secure Storage**: Tokens stored securely on client-side
- **Token Revocation**: Mechanism for token invalidation if needed

### Input Validation
- **Parameter Validation**: All parameters validated through Pydantic models
- **Type Checking**: Strict type checking to prevent injection
- **Range Validation**: Numeric and date range validation

### Error Handling Security
- **Generic Error Messages**: Prevent information leakage in error messages
- **Detailed Logging**: Detailed error information logged server-side
- **User-Friendly Errors**: Safe error messages returned to clients

## Security Configuration

### Environment Variables for Security
- `SECRET_KEY`: JWT signing key
- `ALGORITHM`: Token encryption algorithm
- `ACCESS_TOKEN_EXPIRE_MINUTES`: Token expiration time
- Security-related environment variables for different environments

### Security Defaults
- **Secure Defaults**: Secure configuration settings by default
- **Configurable Security**: Security settings can be adjusted as needed
- **Environment-Based Security**: Different security settings for different environments

## Security Monitoring

### Access Monitoring
- **Authentication Attempts**: Successful and failed authentication attempts logged
- **User Activity**: User actions and access patterns monitored
- **Security Events**: Security-related events logged for analysis

### Security Auditing
- **Access Logs**: Detailed logs of authenticated user activities
- **Permission Changes**: Changes to user permissions logged
- **Security Incidents**: Potential security incidents identified and logged

This security framework ensures that sensitive payroll data is protected while maintaining the functionality required for the system to operate effectively.