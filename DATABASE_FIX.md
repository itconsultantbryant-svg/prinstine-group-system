# Database Fix - Departments Table

## Issue
The `departments` table was missing from the database, causing errors when trying to create departments.

## Solution Applied

### 1. Created the Departments Table
The table has been created with the following structure:
- `id` - Primary key (auto-increment)
- `name` - Unique department name (required)
- `description` - Optional description
- `manager_id` - Foreign key to users table
- `created_at` - Timestamp
- `updated_at` - Timestamp

### 2. Updated Server Initialization
The server now automatically checks for and creates the departments table if it's missing when starting up.

### 3. Created Fix Script
A script is available at `server/scripts/fix-departments-table.js` to manually create the table if needed.

## Verification

To verify the table was created:
```bash
sqlite3 database/pms.db "SELECT name FROM sqlite_master WHERE type='table' AND name='departments';"
```

## Next Steps

1. **Restart the server** if it's running to ensure the fix is applied
2. **Try creating a department** - it should work now
3. **Check the departments list** - newly created departments should appear

## If You Still See Errors

1. Make sure the server has been restarted
2. Check the server logs for any database errors
3. Run the fix script manually:
   ```bash
   cd server
   node scripts/fix-departments-table.js
   ```

The departments table is now ready to use!

