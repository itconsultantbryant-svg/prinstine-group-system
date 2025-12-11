const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database paths
const primaryDb = path.resolve(__dirname, '../../database/pms.db');
const secondaryDb = path.resolve(__dirname, '../../server/database/pms.db');

async function mergeDatabases() {
  return new Promise((resolve, reject) => {
    console.log('Starting database merge...');
    console.log('Primary DB:', primaryDb);
    console.log('Secondary DB:', secondaryDb);

    // Check if both databases exist
    if (!fs.existsSync(primaryDb)) {
      console.error('Primary database not found:', primaryDb);
      reject(new Error('Primary database not found'));
      return;
    }

    if (!fs.existsSync(secondaryDb)) {
      console.log('Secondary database not found, skipping merge');
      resolve();
      return;
    }

    const primary = new sqlite3.Database(primaryDb);
    const secondary = new sqlite3.Database(secondaryDb);

    // Get all tables from secondary database
    secondary.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", (err, tables) => {
      if (err) {
        console.error('Error getting tables:', err);
        primary.close();
        secondary.close();
        reject(err);
        return;
      }

      console.log(`Found ${tables.length} tables to merge`);

      let completed = 0;
      const total = tables.length;

      if (total === 0) {
        console.log('No tables to merge');
        primary.close();
        secondary.close();
        resolve();
        return;
      }

      tables.forEach((table) => {
        const tableName = table.name;
        
        // Get all data from secondary table
        secondary.all(`SELECT * FROM ${tableName}`, (err, rows) => {
          if (err) {
            console.error(`Error reading ${tableName}:`, err.message);
            completed++;
            if (completed === total) {
              primary.close();
              secondary.close();
              resolve();
            }
            return;
          }

          if (rows.length === 0) {
            console.log(`  ${tableName}: No data to merge`);
            completed++;
            if (completed === total) {
              primary.close();
              secondary.close();
              resolve();
            }
            return;
          }

          // Get column names
          secondary.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
            if (err) {
              console.error(`Error getting columns for ${tableName}:`, err.message);
              completed++;
              if (completed === total) {
                primary.close();
                secondary.close();
                resolve();
              }
              return;
            }

            const columnNames = columns.map(c => c.name).join(', ');
            const placeholders = columns.map(() => '?').join(', ');

            // Check if table exists in primary
            primary.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [tableName], (err, exists) => {
              if (err) {
                console.error(`Error checking table ${tableName}:`, err.message);
                completed++;
                if (completed === total) {
                  primary.close();
                  secondary.close();
                  resolve();
                }
                return;
              }

              if (!exists) {
                console.log(`  ${tableName}: Table does not exist in primary, skipping`);
                completed++;
                if (completed === total) {
                  primary.close();
                  secondary.close();
                  resolve();
                }
                return;
              }

              // Insert or replace data
              let inserted = 0;
              let skipped = 0;

              rows.forEach((row) => {
                const values = columns.map(col => row[col.name]);
                const sql = `INSERT OR REPLACE INTO ${tableName} (${columnNames}) VALUES (${placeholders})`;
                
                primary.run(sql, values, (err) => {
                  if (err) {
                    console.error(`Error inserting into ${tableName}:`, err.message);
                    skipped++;
                  } else {
                    inserted++;
                  }

                  if (inserted + skipped === rows.length) {
                    console.log(`  ${tableName}: Merged ${inserted} rows (${skipped} skipped)`);
                    completed++;
                    
                    if (completed === total) {
                      // Final checkpoint
                      primary.run('PRAGMA wal_checkpoint(TRUNCATE)', (err) => {
                        if (err) {
                          console.warn('Checkpoint warning:', err.message);
                        }
                        console.log('\n✅ Database merge completed!');
                        primary.close();
                        secondary.close();
                        resolve();
                      });
                    }
                  }
                });
              });
            });
          });
        });
      });
    });
  });
}

// Run merge
mergeDatabases()
  .then(() => {
    console.log('Merge process finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Merge failed:', error);
    process.exit(1);
  });

