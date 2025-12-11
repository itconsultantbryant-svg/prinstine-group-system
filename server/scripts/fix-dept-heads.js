const db = require('../config/database');
const { hashPassword, comparePassword } = require('../utils/auth');

async function fixDepartmentHeads() {
  try {
    // Connect to database
    await db.connect();
    console.log('=== Fixing Department Head Accounts ===\n');
    
    // Get all department heads
    const deptHeads = await db.all(
      `SELECT u.id, u.email, u.username, u.password_hash, u.role, u.name, u.is_active, u.email_verified,
              d.name as department_name, d.head_email, d.head_name
       FROM users u
       LEFT JOIN departments d ON u.id = d.manager_id OR LOWER(u.email) = LOWER(d.head_email)
       WHERE u.role = 'DepartmentHead'`
    );
    
    console.log(`Found ${deptHeads.length} department head(s):\n`);
    
    for (const head of deptHeads) {
      console.log(`--- Fixing: ${head.name} (${head.email}) ---`);
      
      let needsFix = false;
      const fixes = [];
      
      // Check password hash
      if (!head.password_hash) {
        console.log('  ✗ Password hash is missing!');
        needsFix = true;
        fixes.push('password');
      } else if (!head.password_hash.startsWith('$2')) {
        console.log('  ✗ Password hash is invalid format!');
        needsFix = true;
        fixes.push('password');
      } else {
        console.log('  ✓ Password hash exists and is valid');
      }
      
      // Check is_active
      if (!head.is_active) {
        console.log('  ✗ Account is not active!');
        needsFix = true;
        fixes.push('activate');
      } else {
        console.log('  ✓ Account is active');
      }
      
      // Fix password if needed
      if (fixes.includes('password')) {
        const defaultPassword = 'DeptHead@123';
        console.log(`  → Setting password to: ${defaultPassword}`);
        const passwordHash = await hashPassword(defaultPassword);
        await db.run(
          'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [passwordHash, head.id]
        );
        console.log('  ✓ Password set successfully');
        console.log(`  → Login credentials:`);
        console.log(`     Email: ${head.email}`);
        console.log(`     Password: ${defaultPassword}`);
      }
      
      // Activate account if needed
      if (fixes.includes('activate')) {
        console.log('  → Activating account...');
        await db.run(
          'UPDATE users SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [head.id]
        );
        console.log('  ✓ Account activated');
      }
      
      // Verify fixes
      const updatedUser = await db.get(
        'SELECT password_hash, is_active FROM users WHERE id = ?',
        [head.id]
      );
      
      if (updatedUser.password_hash && updatedUser.is_active) {
        console.log('  ✅ Account is ready for login!\n');
      } else {
        console.log('  ⚠️ Account may still have issues\n');
      }
    }
    
    console.log('=== Fix Complete ===\n');
    console.log('Department heads can now log in with:');
    console.log('- Email: Their email address');
    console.log('- Password: DeptHead@123 (if password was reset)');
    
    await db.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  fixDepartmentHeads();
}

module.exports = fixDepartmentHeads;

