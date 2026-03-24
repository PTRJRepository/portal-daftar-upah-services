# API Documentation

## Table of Contents

- [MCP Server](#mcp-server)
- [Core Classes](#core-classes)
- [Connectors](#connectors)
- [Embedder](#embedder)
- [Vector Store](#vector-store)

---

## MCP Server

### `MCPService`

Main service class for managing MCP operations.

```typescript
import { MCPService } from './dist/mcp-server.js';

const service = new MCPService(configPath);
await service.initialize();
```

#### Methods

##### `initialize()`

Initialize the service, loading configuration and preparing storage.

```typescript
async initialize(): Promise<void>
```

##### `scanDatabase(databaseId: string)`

Scan a database and store its schema.

```typescript
async scanDatabase(databaseId: string): Promise<ScanResult>
```

##### `getKnowledgeBase(databaseId: string)`

Get knowledge base for a database.

```typescript
async getKnowledgeBase(databaseId: string): Promise<KnowledgeBase>
```

##### `searchSchema(databaseId: string, query: string, limit?: number)`

Search schema with natural language.

```typescript
async searchSchema(
  databaseId: string,
  query: string,
  limit?: number
): Promise<SearchResult[]>
```

##### `getTableInfo(databaseId: string, tableName: string)`

Get detailed table information.

```typescript
async getTableInfo(databaseId: string, tableName: string): Promise<TableInfo>
```

##### `compareDatabases(databaseIdA: string, databaseIdB: string)`

Compare two database schemas.

```typescript
async compareDatabases(
  databaseIdA: string,
  databaseIdB: string
): Promise<SchemaComparison>
```

##### `listDatabases()`

List all configured databases.

```typescript
async listDatabases(): Promise<DatabaseConfig[]>
```

##### `refreshDatabase(databaseId: string)`

Re-scan and update knowledge base.

```typescript
async refreshDatabase(databaseId: string): Promise<RefreshResult>
```

##### `getStatistics(databaseId: string)`

Get knowledge base statistics.

```typescript
async getStatistics(databaseId: string): Promise<Statistics>
```

---

## Core Classes

### `SchemaReader`

Factory for creating database connectors.

```typescript
import { SchemaReader } from './dist/connectors/index.js';

const connector = SchemaReader.createConnector(config);
await connector.connect();
const schema = await connector.readFullSchema();
await connector.disconnect();
```

#### Methods

##### `createConnector(config: DatabaseConfig)`

Create appropriate connector based on database type.

```typescript
static createConnector(config: DatabaseConfig): BaseDatabaseConnector
```

---

## Connectors

### `BaseDatabaseConnector`

Abstract base class for all database connectors.

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `config` | `DatabaseConfig` | Database configuration |
| `isConnected` | `boolean` | Connection status |

#### Methods

##### `connect(): Promise<void>`

Establish database connection.

##### `disconnect(): Promise<void>`

Close database connection.

##### `getTables(): Promise<TableMetadata[]>`

Get list of all tables.

##### `getTableInfo(tableName: string): Promise<TableInfo>`

Get detailed table information.

##### `testConnection(): Promise<boolean>`

Test if connection is alive.

##### `readFullSchema(): Promise<DatabaseSchema>`

Read complete database schema.

---

### `SQLServerConnector`

SQL Server implementation.

```typescript
import { SQLServerConnector } from './dist/connectors/sqlserver.js';

const connector = new SQLServerConnector({
  id: 'my_db',
  type: 'sqlserver',
  host: 'localhost',
  port: 1433,
  database: 'mydb',
  username: 'sa',
  password: 'password'
});

await connector.connect();
const tables = await connector.getTables();
```

#### Connection String Options

```typescript
{
  options: {
    encrypt: false,           // Use TLS
    trustServerCertificate: true,  // Trust self-signed certs
    enableArithAbort: true,   // Enable arithmetic abort
    connectionTimeout: 30000, // 30 second timeout
  }
}
```

---

### `MySQLConnector`

MySQL implementation.

```typescript
import { MySQLConnector } from './dist/connectors/mysql.js';

const connector = new MySQLConnector({
  id: 'my_db',
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  database: 'mydb',
  username: 'root',
  password: 'password'
});
```

---

### `PostgreSQLConnector`

PostgreSQL implementation.

```typescript
import { PostgreSQLConnector } from './dist/connectors/postgresql.js';

const connector = new PostgreSQLConnector({
  id: 'my_db',
  type: 'postgresql',
  host: 'localhost',
  port: 5432,
  database: 'mydb',
  username: 'postgres',
  password: 'password'
});
```

---

## Embedder

### `SchemaEmbedder`

Converts database schema to embedding chunks.

```typescript
import { SchemaEmbedder } from './dist/embedder/schema-embedder.js';

const embedder = new SchemaEmbedder({
  provider: 'local',  // or 'openai'
  dimensions: 384
});

const chunks = await embedder.embedSchema(schema, dbConfig);
```

#### Methods

##### `embedSchema(schema: DatabaseSchema, dbConfig: DatabaseConfig)`

Convert full database schema to chunks.

```typescript
async embedSchema(
  schema: DatabaseSchema,
  dbConfig: DatabaseConfig
): Promise<EmbeddingChunk[]>
```

##### `embedTable(table: TableInfo, dbConfig: DatabaseConfig)`

Convert single table to chunks.

```typescript
async embedTable(
  table: TableInfo,
  dbConfig: DatabaseConfig
): Promise<EmbeddingChunk[]>
```

##### `embedColumn(column: ColumnInfo, table: TableInfo, dbConfig: DatabaseConfig)`

Convert column to chunk.

```typescript
async embedColumn(
  column: ColumnInfo,
  table: TableInfo,
  dbConfig: DatabaseConfig
): Promise<EmbeddingChunk>
```

##### `generateTextDescription(item: TableInfo | ColumnInfo | ForeignKeyInfo)`

Generate human-readable description.

```typescript
generateTextDescription(
  item: TableInfo | ColumnInfo | ForeignKeyInfo
): string
```

---

## Vector Store

### `VectorStore`

Storage for knowledge base with search capability.

```typescript
import { VectorStore } from './dist/storage/vector-store.js';

const store = new VectorStore('./knowledgebases');
await store.initialize();
```

#### Methods

##### `initialize(): Promise<void>`

Initialize storage directory.

##### `addChunks(databaseId: string, chunks: EmbeddingChunk[])`

Add chunks to knowledge base.

```typescript
async addChunks(databaseId: string, chunks: EmbeddingChunk[]): Promise<void>
```

##### `getChunks(databaseId: string, chunkType?: ChunkType)`

Get all chunks for a database.

```typescript
async getChunks(
  databaseId: string,
  chunkType?: ChunkType
): Promise<StoredChunk[]>
```

##### `search(databaseId: string, query: string, limit?: number)`

Full-text search in knowledge base.

```typescript
async search(
  databaseId: string,
  query: string,
  limit?: number
): Promise<SearchResult[]>
```

##### `getKnowledgeBase(databaseId: string)`

Get complete knowledge base.

```typescript
async getKnowledgeBase(databaseId: string): Promise<KnowledgeBase>
```

##### `listKnowledgeBases()`

List all knowledge bases.

```typescript
async listKnowledgeBases(): Promise<KnowledgeBaseSummary[]>
```

##### `deleteKnowledgeBase(databaseId: string)`

Delete knowledge base.

```typescript
async deleteKnowledgeBase(databaseId: string): Promise<void>
```

##### `createBackup(databaseId: string)`

Create timestamped backup.

```typescript
async createBackup(databaseId: string): Promise<string>
```

---

## Type Definitions

### `DatabaseConfig`

```typescript
interface DatabaseConfig {
  id: string;
  name: string;
  type: 'sqlserver' | 'mysql' | 'postgresql';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  description?: string;
  enabled: boolean;
}
```

### `TableInfo`

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

### `ColumnInfo`

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

### `ForeignKeyInfo`

```typescript
interface ForeignKeyInfo {
  name: string;
  column: string;
  referencedTable: string;
  referencedColumn: string;
  onUpdate?: string;
  onDelete?: string;
}
```

### `EmbeddingChunk`

```typescript
interface EmbeddingChunk {
  id: string;
  databaseId: string;
  databaseName: string;
  chunkType: 'database_overview' | 'table' | 'column' | 'relationship';
  chunkId: string;
  content: string;
  metadata: {
    tableName?: string;
    schema?: string;
    columnName?: string;
    dataType?: string;
    isPrimaryKey?: boolean;
    isForeignKey?: boolean;
    referencedTable?: string;
    referencedColumn?: string;
  };
}
```

### `KnowledgeBase`

```typescript
interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  databaseId: string;
  chunks: StoredChunk[];
  createdAt: string;
  updatedAt: string;
  statistics: {
    totalChunks: number;
    databaseOverview: number;
    tables: number;
    columns: number;
    relationships: number;
  };
}
```

---

## Error Handling

### Connection Errors

```typescript
try {
  await connector.connect();
} catch (error) {
  if (error.code === 'ECONNREFUSED') {
    console.error('Database server not running');
  } else if (error.code === 'ETIMEDOUT') {
    console.error('Connection timeout');
  } else if (error.message.includes('Login failed')) {
    console.error('Invalid credentials');
  }
}
```

### Storage Errors

```typescript
try {
  await store.addChunks(databaseId, chunks);
} catch (error) {
  if (error.code === 'ENOENT') {
    console.error('Storage directory not found');
  } else if (error.code === 'EACCES') {
    console.error('Permission denied');
  }
}
```
