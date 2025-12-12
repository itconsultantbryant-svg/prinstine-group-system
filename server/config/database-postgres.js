const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL Database Connection
class PostgreSQLDatabase {
  constructor() {
    this.pool = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (!process.env.DATABASE_URL) {
        reject(new Error('DATABASE_URL environment variable is not set'));
        return;
      }

      try {
        this.pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: process.env.DATABASE_URL.includes('localhost') ? false : {
            rejectUnauthorized: false
          },
          max: 20, // Maximum number of clients in the pool
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        });

        // Test connection
        this.pool.query('SELECT NOW()', (err, result) => {
          if (err) {
            console.error('PostgreSQL connection error:', err.message);
            reject(err);
          } else {
            console.log('✓ Connected to PostgreSQL database');
            console.log('✓ Database time:', result.rows[0].now);
            resolve(this.pool);
          }
        });
      } catch (error) {
        console.error('PostgreSQL initialization error:', error.message);
        reject(error);
      }
    });
  }

  close() {
    return new Promise((resolve) => {
      if (this.pool) {
        this.pool.end(() => {
          console.log('PostgreSQL connection pool closed');
          this.pool = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // Execute a query and return all rows
  async all(sql, params = []) {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    try {
      // Convert SQLite syntax to PostgreSQL
      const pgSql = this.convertSQLiteToPostgres(sql);
      const result = await this.pool.query(pgSql, params);
      return result.rows;
    } catch (err) {
      // If table doesn't exist, return empty array instead of error
      if (err.message && err.message.includes('does not exist')) {
        console.warn(`Table may not exist yet: ${err.message}`);
        console.warn(`Query: ${sql.substring(0, 100)}...`);
        return [];
      }
      console.error('Database all() error:', err.message);
      throw err;
    }
  }

  // Execute a query and return first row
  async get(sql, params = []) {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    try {
      const pgSql = this.convertSQLiteToPostgres(sql);
      const result = await this.pool.query(pgSql, params);
      return result.rows[0] || null;
    } catch (err) {
      // If table doesn't exist, return null instead of error
      if (err.message && err.message.includes('does not exist')) {
        console.warn(`Table may not exist yet: ${err.message}`);
        console.warn(`Query: ${sql.substring(0, 100)}...`);
        return null;
      }
      console.error('Database get() error:', err.message);
      throw err;
    }
  }

  // Execute a query (INSERT, UPDATE, DELETE)
  async run(sql, params = []) {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    try {
      const pgSql = this.convertSQLiteToPostgres(sql);
      const result = await this.pool.query(pgSql, params);
      
      // Return format compatible with SQLite
      return {
        lastID: result.rows[0]?.id || result.insertId || null,
        changes: result.rowCount || 0
      };
    } catch (err) {
      console.error('Database run() error:', err.message);
      console.error('SQL:', sql.substring(0, 200));
      console.error('Params:', params);
      throw err;
    }
  }

  // Convert SQLite syntax to PostgreSQL
  convertSQLiteToPostgres(sql) {
    let pgSql = sql;

    // Convert AUTOINCREMENT to SERIAL (handled in CREATE TABLE)
    pgSql = pgSql.replace(/AUTOINCREMENT/gi, 'SERIAL');

    // Convert INTEGER PRIMARY KEY to SERIAL PRIMARY KEY
    pgSql = pgSql.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY');

    // Convert DATETIME to TIMESTAMP
    pgSql = pgSql.replace(/DATETIME/gi, 'TIMESTAMP');

    // Convert BOOLEAN DEFAULT 0/1 to BOOLEAN DEFAULT false/true
    pgSql = pgSql.replace(/BOOLEAN DEFAULT 0/gi, 'BOOLEAN DEFAULT false');
    pgSql = pgSql.replace(/BOOLEAN DEFAULT 1/gi, 'BOOLEAN DEFAULT true');

    // Convert CURRENT_TIMESTAMP to NOW()
    pgSql = pgSql.replace(/CURRENT_TIMESTAMP/gi, 'NOW()');

    // Convert sqlite_master to information_schema
    pgSql = pgSql.replace(/sqlite_master/gi, 'information_schema.tables');
    pgSql = pgSql.replace(/type='table'/gi, "table_type='BASE TABLE'");
    pgSql = pgSql.replace(/name=/gi, "table_name=");

    // Convert PRAGMA statements (these won't work in PostgreSQL, but we'll handle them)
    if (pgSql.includes('PRAGMA')) {
      // PRAGMA statements are SQLite-specific, skip them for PostgreSQL
      if (pgSql.includes('PRAGMA table_info')) {
        // Convert to PostgreSQL information_schema query
        const tableName = pgSql.match(/table_info\(['"]?(\w+)['"]?\)/i)?.[1];
        if (tableName) {
          pgSql = `SELECT column_name as name, data_type as type, is_nullable, column_default as dflt_value 
                   FROM information_schema.columns 
                   WHERE table_name = '${tableName}'`;
        }
      } else {
        // For other PRAGMA statements, return empty result
        return 'SELECT 1 WHERE 1=0';
      }
    }

    // Handle RETURNING clause for INSERT (PostgreSQL feature)
    if (pgSql.toUpperCase().includes('INSERT INTO') && !pgSql.toUpperCase().includes('RETURNING')) {
      const insertMatch = pgSql.match(/INSERT INTO\s+(\w+)/i);
      if (insertMatch) {
        const tableName = insertMatch[1];
        pgSql += ` RETURNING id`;
      }
    }

    return pgSql;
  }
}

module.exports = new PostgreSQLDatabase();

