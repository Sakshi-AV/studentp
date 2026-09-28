const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

let dbType = process.env.DB_TYPE || 'sqlite';
let pgPool = null;
let sqliteDb = null;

// Ensure data folder exists for SQLite
const dataDir = path.resolve(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqlitePath = process.env.SQLITE_DB_PATH
  ? path.resolve(process.env.SQLITE_DB_PATH)
  : path.join(dataDir, 'studentp.db');

function initSQLite() {
  const sqlite3 = require('sqlite3').verbose();
  sqliteDb = new sqlite3.Database(sqlitePath, (err) => {
    if (err) {
      console.error('❌ Failed to open SQLite database:', err.message);
    } else {
      console.log(`📦 Relational SQLite connected at: ${sqlitePath}`);
      sqliteDb.run('PRAGMA foreign_keys = ON');
    }
  });
}

function initPostgres() {
  const { Pool } = require('pg');
  const connectionConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST || 'localhost',
        port: process.env.PGPORT || 5432,
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'studentp_db',
      };

  pgPool = new Pool(connectionConfig);
  return pgPool;
}

// Initial setup attempt
if (dbType === 'postgres') {
  try {
    initPostgres();
    console.log('🐘 PostgreSQL pool initialized. Testing connection...');
  } catch (err) {
    console.warn('⚠️ PostgreSQL setup encountered error, falling back to SQLite:', err.message);
    dbType = 'sqlite';
    initSQLite();
  }
} else {
  initSQLite();
}

/**
 * Universal Query Adapter
 * Supports both PostgreSQL and SQLite using standard parameter arrays
 */
async function query(text, params = []) {
  if (dbType === 'postgres' && pgPool) {
    try {
      const res = await pgPool.query(text, params);
      return { rows: res.rows, rowCount: res.rowCount };
    } catch (err) {
      // If postgres is configured but fails at runtime (e.g. server down), fallback to SQLite seamlessly
      if (err.code === 'ECONNREFUSED' || err.code === '28P01' || err.code === '3D000') {
        console.warn(`⚠️ PostgreSQL unavailable (${err.code}). Switching dynamic runtime to SQLite.`);
        dbType = 'sqlite';
        if (!sqliteDb) initSQLite();
        return query(text, params);
      }
      throw err;
    }
  }

  // SQLite execution
  return new Promise((resolve, reject) => {
    if (!sqliteDb) {
      initSQLite();
    }

    // Convert PostgreSQL $1, $2 to SQLite ? placeholders
    const sqliteSql = text.replace(/\$(\d+)/g, '?');
    const isSelect = /^\s*(SELECT|PRAGMA)/i.test(sqliteSql);
    const hasReturning = /RETURNING/i.test(sqliteSql);

    if (isSelect || hasReturning) {
      sqliteDb.all(sqliteSql, params, (err, rows) => {
        if (err) return reject(err);
        resolve({
          rows: rows || [],
          rowCount: rows ? rows.length : 0,
        });
      });
    } else {
      sqliteDb.run(sqliteSql, params, function (err) {
        if (err) return reject(err);
        resolve({
          rows: [],
          rowCount: this.changes || 0,
          lastID: this.lastID,
        });
      });
    }
  });
}

module.exports = {
  query,
  getDbType: () => dbType,
  setDbType: (type) => {
    dbType = type;
  },
  getSqliteDb: () => sqliteDb,
  getPgPool: () => pgPool,
};
