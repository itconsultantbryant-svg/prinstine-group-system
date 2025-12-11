const db = require('../config/database');
const path = require('path');

async function fixDepartmentsTable() {
  try {
    await db.connect();
    console.log('Connected to database');

    // Check if departments table exists
    const tableExists = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='departments'"
    );

    if (!tableExists) {
      console.log('Creating departments table...');
      await db.run(`
        CREATE TABLE IF NOT EXISTS departments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          description TEXT,
          manager_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL
        )
      `);
      console.log('✅ Departments table created successfully');
    } else {
      console.log('✅ Departments table already exists');
    }

    // Verify table structure
    const columns = await db.all("PRAGMA table_info(departments)");
    console.log('Table columns:', columns.map(c => c.name).join(', '));

    process.exit(0);
  } catch (error) {
    console.error('Error fixing departments table:', error);
    process.exit(1);
  }
}

fixDepartmentsTable();

