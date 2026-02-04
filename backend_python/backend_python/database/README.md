# Database Module

- Folders: `config`, `models`, `queries`, `services`
- Features: pooling, error handling, logging, transactions
- Queries JSON: group-based, placeholders `?`
- Env vars: `DB_DRIVER`, `DB_SERVER`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`
- Usage:
  - Initialize: `Database.instance(pool_size=5)`
  - Query: `db.query_all(sql, params)`
  - Transaction: `with db.transaction() as cur: ...`
