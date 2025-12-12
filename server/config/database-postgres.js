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
        // Parse and validate the connection string
        let connectionString = process.env.DATABASE_URL.trim();
        
        // Validate URL format
        if (!connectionString.startsWith('postgresql://') && !connectionString.startsWith('postgres://')) {
          console.error('\n❌ Invalid DATABASE_URL format!');
          console.error('URL must start with postgresql:// or postgres://');
          console.error('Current value:', connectionString.substring(0, 50) + '...');
          reject(new Error('Invalid DATABASE_URL format. Must start with postgresql://'));
          return;
        }
        
        // Parse URL to validate components
        try {
          const url = new URL(connectionString);
          if (!url.hostname || url.hostname === 'base' || url.hostname.length < 3) {
            console.error('\n❌ Invalid DATABASE_URL hostname!');
            console.error('Hostname is missing or invalid:', url.hostname);
            console.error('Make sure you copied the COMPLETE Internal Database URL from Render');
            console.error('It should look like: postgresql://user:pass@dpg-xxxxx-a.region-postgres.render.com:5432/dbname');
            reject(new Error('Invalid DATABASE_URL hostname. Check that you copied the complete URL.'));
            return;
          }
          
          if (!url.port || url.port !== '5432') {
            console.warn('⚠️  Unexpected port in DATABASE_URL. Expected 5432, got:', url.port);
          }
          
          console.log('✓ DATABASE_URL format validated');
          console.log('  Hostname:', url.hostname);
          console.log('  Database:', url.pathname.replace('/', ''));
        } catch (urlError) {
          console.error('\n❌ Failed to parse DATABASE_URL!');
          console.error('Error:', urlError.message);
          console.error('Make sure the URL is complete and properly formatted');
          reject(new Error('Invalid DATABASE_URL format: ' + urlError.message));
          return;
        }
        
        // If the URL contains an IPv6 address, warn user
        if (connectionString.includes('[') || connectionString.match(/:\/\/([0-9a-f:]+):/i)) {
          console.warn('⚠️  IPv6 address detected in DATABASE_URL. This may cause connection issues.');
          console.warn('⚠️  Make sure you are using the INTERNAL Database URL from Render, not External.');
        }
        
        // Configure pool with better connection handling
        this.pool = new Pool({
          connectionString: connectionString,
          ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1') ? false : {
            rejectUnauthorized: false
          },
          max: 20, // Maximum number of clients in the pool
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000, // Increased timeout for network issues
          // Force IPv4 if IPv6 is causing issues
          // Note: This is handled at the OS level, but we can add retry logic
        });

        // Test connection with retry logic
        const testConnection = (retries = 3) => {
          this.pool.query('SELECT NOW()', (err, result) => {
            if (err) {
              console.error('PostgreSQL connection error:', err.message);
              console.error('Error code:', err.code);
              
              // Provide helpful error messages
              if (err.code === 'ENETUNREACH' || err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
                console.error('\n❌ PostgreSQL Connection Failed!');
                console.error('Error code:', err.code);
                console.error('Error message:', err.message);
                console.error('\n📋 Common Issues & Solutions:');
                console.error('1. ❌ DATABASE_URL is malformed or incomplete');
                console.error('   ✅ Fix: Copy the COMPLETE Internal Database URL from Render');
                console.error('   ✅ It should look like: postgresql://user:pass@dpg-xxxxx-a.region-postgres.render.com:5432/dbname');
                console.error('');
                console.error('2. ❌ Using External Database URL instead of Internal');
                console.error('   ✅ Fix: Use the "Internal Database URL" (NOT External)');
                console.error('');
                console.error('3. ❌ URL was truncated or partially copied');
                console.error('   ✅ Fix: Make sure you copied the ENTIRE URL, including:');
                console.error('      - postgresql:// prefix');
                console.error('      - username:password');
                console.error('      - @hostname:5432');
                console.error('      - /database_name');
                console.error('');
                console.error('4. ❌ Database service not running');
                console.error('   ✅ Fix: Check Render dashboard - database should show "Available"');
                console.error('');
                console.error('5. ❌ Services in different regions');
                console.error('   ✅ Fix: Ensure backend and database are in the SAME region\n');
              }
              
              // Retry logic for transient errors
              if (retries > 0 && (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT')) {
                console.log(`Retrying connection... (${retries} attempts remaining)`);
                setTimeout(() => testConnection(retries - 1), 2000);
              } else {
                reject(err);
              }
            } else {
              console.log('✓ Connected to PostgreSQL database');
              console.log('✓ Database time:', result.rows[0].now);
              resolve(this.pool);
            }
          });
        };
        
        testConnection();
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

