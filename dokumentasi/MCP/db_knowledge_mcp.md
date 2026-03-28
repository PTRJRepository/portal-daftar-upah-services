# API Documentation

## Table of Contents

- [REST API](#rest-api)
  - [GET /api/knowledge-bases](#get-apiknowledge-bases)
  - [GET /api/knowledge-bases/:id](#get-apiknowledge-basesid)
  - [GET /api/knowledge-bases/:id/graph](#get-apiknowledge-basesidgraph)
  - [GET /api/knowledge-bases/:id/search](#get-apiknowledge-basesidsearch)
  - [POST /api/scan/:databaseId](#post-apiscandatabaseid)
  - [POST /api/scan-all](#post-apiscan-all)
  - [GET /api/databases](#get-apidatabases)
  - [POST /api/test-connection/:databaseId](#post-apitest-connectiondatabaseid)
  - [GET /api/health](#get-apihealth)
- [MCP Tools](#mcp-tools)
  - [list_databases](#1-list_databases)
  - [scan_database](#2-scan_database)
  - [search_knowledge](#3-search_knowledge)
  - [get_table_info](#4-get_table_info)
  - [get_column_info](#5-get_column_info)
  - [get_table_relationships](#6-get_table_relationships)
  - [get_database_overview](#7-get_database_overview)
  - [delete_knowledge_base](#8-delete_knowledge_base)
  - [test_connection](#9-test_connection)
- [TypeScript Interfaces](#typescript-interfaces)

---

## REST API

Base URL: `http://localhost:5005/api`

### GET /api/knowledge-bases

List semua knowledge bases yang tersimpan.

**Response:**
```json
{
  "success": true,
  "knowledgeBases": [
    {
      "id": "db_payroll",
      "name": "Payroll Database",
      "databaseId": "db_payroll",
      "createdAt": "2026-03-24T10:00:00.000Z",
      "updatedAt": "2026-03-24T10:00:00.000Z",
      "statistics": {
        "totalTables": 25,
        "totalColumns": 156,
        "totalRelationships": 42,
        "totalChunks": 225
      }
    }
  ]
}
```

### GET /api/knowledge-bases/:id

Get detail knowledge base.

**Parameters:**
- `id` (path) - Knowledge base ID

**Response:**
```json
{
  "success": true,
  "knowledgeBase": {
    "id": "db_payroll",
    "name": "Payroll Database",
    "databaseId": "db_payroll",
    "createdAt": "2026-03-24T10:00:00.000Z",
    "updatedAt": "2026-03-24T10:00:00.000Z",
    "statistics": {
      "totalTables": 25,
      "totalColumns": 156,
      "totalRelationships": 42,
      "totalChunks": 225
    }
  }
}
```

### GET /api/knowledge-bases/:id/graph

Get graph data untuk UI visualization.

**Parameters:**
- `id` (path) - Knowledge base ID

**Response:**
```json
{
  "success": true,
  "graph": {
    "nodes": [
      {
        "id": "db_payroll",
        "label": "Payroll DB",
        "type": "database",
        "color": "#00bcd4",
        "title": "Payroll Database\nType: SQL Server\nTables: 25"
      },
      {
        "id": "employees",
        "label": "employees",
        "type": "table",
        "color": "#4caf50",
        "title": "employees\nColumns: 12\nRows: 1,250"
      },
      {
        "id": "employees.employee_id",
        "label": "employee_id",
        "type": "column",
        "color": "#ffeb3b",
        "title": "employee_id\nType: int\nPK: Yes"
      }
    ],
    "edges": [
      {
        "from": "db_payroll",
        "to": "employees",
        "label": "contains"
      },
      {
        "from": "employees",
        "to": "employees.employee_id",
        "label": "pk"
      }
    ]
  }
}
```

### GET /api/knowledge-bases/:id/search

Search dalam knowledge base.

**Parameters:**
- `id` (path) - Knowledge base ID
- `q` (query) - Search query
- `limit` (query, optional) - Max results (default: 10)
- `minScore` (query, optional) - Minimum similarity score (default: 0.1)

**Example:**
```bash
curl "http://localhost:5005/api/knowledge-bases/db_payroll/search?q=salary&limit=5"
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "chunk": {
        "id": "db_payroll:column:salary",
        "chunkType": "column",
        "content": "Column: salary\nType: decimal(15,2)\nNullable: No\n...",
        "metadata": {
          "databaseId": "db_payroll",
          "databaseName": "Payroll Database",
          "tableName": "employees",
          "columnName": "salary",
          "dataType": "decimal"
        }
      },
      "score": 0.89
    }
  ],
  "query": "salary",
  "totalResults": 1
}
```

### POST /api/scan/:databaseId

Scan database dan simpan ke knowledge base.

**Parameters:**
- `databaseId` (path) - Database ID dari config

**Response:**
```json
{
  "success": true,
  "result": {
    "databaseId": "db_payroll",
    "databaseName": "Payroll Database",
    "databaseType": "sqlserver",
    "scanResult": {
      "tablesScanned": 25,
      "columnsProcessed": 156,
      "relationshipsFound": 42,
      "chunksCreated": 225
    },
    "statistics": {
      "totalTables": 25,
      "totalColumns": 156,
      "totalRelationships": 42,
      "totalChunks": 225
    },
    "scannedAt": "2026-03-24T10:00:00.000Z"
  }
}
```

### POST /api/scan-all

Scan semua database yang enabled.

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "databaseId": "db_payroll",
      "databaseName": "Payroll Database",
      "success": true,
      "statistics": { ... }
    },
    {
      "databaseId": "db_hris",
      "success": false,
      "error": "Connection failed: ECONNREFUSED"
    }
  ]
}
```

### GET /api/databases

List semua konfigurasi database.

**Response:**
```json
{
  "success": true,
  "databases": [
    {
      "id": "db_payroll",
      "name": "Payroll Database",
      "type": "sqlserver",
      "host": "localhost",
      "port": 1433,
      "database": "payroll_db",
      "enabled": true,
      "description": "Production payroll system"
    }
  ]
}
```

### POST /api/test-connection/:databaseId

Test koneksi ke database.

**Parameters:**
- `databaseId` (path) - Database ID

**Response (success):**
```json
{
  "success": true,
  "result": {
    "databaseId": "db_payroll",
    "connected": true,
    "message": "Successfully connected to Payroll Database (SQL Server)"
  }
}
```

**Response (failure):**
```json
{
  "success": false,
  "error": "Connection failed: ECONNREFUSED"
}
```

### GET /api/health

Health check endpoint.

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2026-03-24T10:00:00.000Z",
  "version": "1.0.0"
}
```

---

## MCP Tools

MCP tools dijalankan via STDIO protocol. Berikut daftar lengkap:

### 1. list_databases

List semua database yang dikonfigurasi.

```json
{
  "name": "list_databases",
  "description": "List all configured databases in the knowledge base",
  "annotations": { "readOnlyHint": true }
}
```

**Arguments:** `{}`

**Output:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "[\n  {\n    \"id\": \"db_payroll\",\n    \"name\": \"Payroll Database\",\n    \"type\": \"sqlserver\",\n    \"hasKnowledgeBase\": true,\n    \"lastUpdated\": \"2026-03-24T10:00:00.000Z\"\n  }\n]"
    }
  ]
}
```

### 2. scan_database

Scan database dan simpan ke knowledge base.

```json
{
  "name": "scan_database",
  "description": "Scan a database and store its schema in the knowledge base",
  "annotations": {
    "readOnlyHint": false,
    "destructiveHint": false,
    "idempotentHint": true
  }
}
```

**Arguments:**
```json
{
  "databaseId": "db_payroll",
  "options": {
    "tables": ["employees", "departments"]  // optional, scan specific tables only
  }
}
```

### 3. search_knowledge

Search knowledge base dengan semantic search.

```json
{
  "name": "search_knowledge",
  "description": "Search the database knowledge base for schema information",
  "annotations": { "readOnlyHint": true }
}
```

**Arguments:**
```json
{
  "query": "employee salary",
  "databaseId": "db_payroll",  // optional, search specific database
  "options": {
    "limit": 10,
    "minScore": 0.1,
    "chunkTypes": ["table", "column"]  // optional filter
  }
}
```

### 4. get_table_info

Get detail informasi table.

```json
{
  "name": "get_table_info",
  "description": "Get detailed information about a specific table",
  "annotations": { "readOnlyHint": true }
}
```

**Arguments:**
```json
{
  "databaseId": "db_payroll",
  "tableName": "employees",
  "schema": "dbo"  // optional, defaults to default schema
}
```

### 5. get_column_info

Get detail informasi column.

```json
{
  "name": "get_column_info",
  "description": "Get detailed information about a specific column",
  "annotations": { "readOnlyHint": true }
}
```

**Arguments:**
```json
{
  "databaseId": "db_payroll",
  "tableName": "employees",
  "columnName": "salary"
}
```

### 6. get_table_relationships

Get semua foreign key relationships untuk table.

```json
{
  "name": "get_table_relationships",
  "description": "Get all relationships (foreign keys) for a table",
  "annotations": { "readOnlyHint": true }
}
```

**Arguments:**
```json
{
  "databaseId": "db_payroll",
  "tableName": "employees"
}
```

### 7. get_database_overview

Get overview database termasuk semua tables.

```json
{
  "name": "get_database_overview",
  "description": "Get overview of a database including all tables",
  "annotations": { "readOnlyHint": true }
}
```

**Arguments:**
```json
{
  "databaseId": "db_payroll"
}
```

### 8. delete_knowledge_base

Delete knowledge base untuk database.

```json
{
  "name": "delete_knowledge_base",
  "description": "Delete a database knowledge base",
  "annotations": {
    "readOnlyHint": false,
    "destructiveHint": true
  }
}
```

**Arguments:**
```json
{
  "databaseId": "db_payroll"
}
```

### 9. test_connection

Test koneksi ke database.

```json
{
  "name": "test_connection",
  "description": "Test connection to a database",
  "annotations": { "readOnlyHint": true }
}
```

**Arguments:**
```json
{
  "databaseId": "db_payroll"
}
```

---

## TypeScript Interfaces

### DatabaseConfig

```typescript
interface DatabaseConfig {
  id: string;           // Unique identifier
  name: string;        // Display name
  type: 'sqlserver' | 'mysql' | 'postgresql';
  host: string;
  port: number;
  database: string;
  username?: string;
  password?: string;
  description?: string;
  enabled: boolean;
}
```

### TableInfo

```typescript
interface TableInfo {
  name: string;
  schema: string;
  columns: ColumnInfo[];
  primaryKeys: string[];
  foreignKeys: ForeignKeyInfo[];
  indexes: IndexInfo[];
  rowCount?: number;
}
```

### ColumnInfo

```typescript
interface ColumnInfo {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  defaultValue?: string;
  maxLength?: number;
  precision?: number;
  scale?: number;
  isForeignKey: boolean;
  referencedTable?: string;
  referencedColumn?: string;
}
```

### EmbeddingChunk

```typescript
interface EmbeddingChunk {
  id: string;
  databaseId: string;
  databaseName: string;
  chunkType: 'database_overview' | 'table' | 'column' | 'relationship';
  content: string;
  metadata: {
    tableName?: string;
    columnName?: string;
    dataType?: string;
    schema?: string;
    [key: string]: any;
  };
  embedding?: number[];
  createdAt: string;
}
```

### KnowledgeBase

```typescript
interface KnowledgeBase {
  id: string;
  name: string;
  databaseId: string;
  chunks: EmbeddingChunk[];
  createdAt: string;
  updatedAt: string;
  statistics: {
    totalTables: number;
    totalColumns: number;
    totalRelationships: number;
    totalChunks: number;
  };
}
```

### SearchResult

```typescript
interface SearchResult {
  chunk: EmbeddingChunk;
  score: number;
}
```
