const db = require('../config/database');
const { hashPassword, comparePassword } = require('../utils/auth');

async function diagnoseAndFixDepartmentHeads() {
  try {
    await db.connect();
    console.log('\n=== Diagnosing Department Head Login Issues ===\n');

    // Get all departments
    const departments = await db.all('SELECT * FROM departments');
    console.log(`Found ${departments.length} department(s)\n`);

    let issuesFound = 0;
    let fixed = 0;

    for (const dept of departments) {
      console.log(`\n--- Processing: ${dept.name} ---`);
      console.log(`Head Email: ${dept.head_email}`);
      console.log(`Manager ID: ${dept.manager_id}`);

      // Find user by email (case-insensitive)
      const normalizedEmail = dept.head_email?.toLowerCase().trim();
      let user = null;

      if (normalizedEmail) {
        user = await db.get(
          'SELECT * FROM users WHERE LOWER(TRIM(email)) = ?',
          [normalizedEmail]
        );
      }

      // Also try by manager_id
      if (!user && dept.manager_id) {
        user = await db.get('SELECT * FROM users WHERE id = ?', [dept.manager_id]);
      }

      if (!user) {
        console.log('  ❌ ISSUE: No user found for this department head!');
        issuesFound++;
        
        // Create the user
        if (normalizedEmail) {
          console.log('  → Creating user account...');
          const defaultPassword = 'DeptHead@123';
          const passwordHash = await hashPassword(defaultPassword);
          const username = normalizedEmail.split('@')[0];
          
          const userResult = await db.run(
            `INSERT INTO users (email, username, password_hash, role, name, phone, is_active, email_verified)
             VALUES (?, ?, ?, ?, ?, ?, 1, 1)`,
            [normalizedEmail, username, passwordHash, 'DepartmentHead', dept.head_name || 'Department Head', dept.head_phone || null]
          );
          
          // Update department manager_id
          await db.run('UPDATE departments SET manager_id = ? WHERE id = ?', [userResult.lastID, dept.id]);
          
          console.log(`  ✅ Created user (ID: ${userResult.lastID})`);
          console.log(`  ✅ Password set to: ${defaultPassword}`);
          fixed++;
        } else {
          console.log('  ⚠️  Cannot create user - no email provided');
        }
        continue;
      }

      console.log(`  User found: ${user.name} (ID: ${user.id}, Email: ${user.email})`);
      console.log(`  Current Role: ${user.role}`);
      console.log(`  Is Active: ${user.is_active}`);
      console.log(`  Email Verified: ${user.email_verified}`);
      console.log(`  Password Hash: ${user.password_hash ? `SET (${user.password_hash.length} chars)` : 'MISSING'}`);

      let needsFix = false;
      const fixes = [];

      // Check role
      if (user.role !== 'DepartmentHead') {
        console.log(`  ❌ ISSUE: Wrong role (${user.role}), should be DepartmentHead`);
        issuesFound++;
        needsFix = true;
        fixes.push('role');
      }

      // Check password hash
      const hasValidPassword = user.password_hash && 
                                user.password_hash.length >= 20 && 
                                user.password_hash.startsWith('$2');
      
      if (!hasValidPassword) {
        console.log(`  ❌ ISSUE: Invalid or missing password hash`);
        issuesFound++;
        needsFix = true;
        fixes.push('password');
      }

      // Check is_active
      if (!user.is_active) {
        console.log(`  ❌ ISSUE: User account is not active`);
        issuesFound++;
        needsFix = true;
        fixes.push('is_active');
      }

      // Check email match
      if (normalizedEmail && user.email.toLowerCase().trim() !== normalizedEmail) {
        console.log(`  ⚠️  WARNING: Email mismatch (user: ${user.email}, dept: ${normalizedEmail})`);
      }

      // Check manager_id link
      if (dept.manager_id !== user.id) {
        console.log(`  ⚠️  WARNING: manager_id mismatch (dept: ${dept.manager_id}, user: ${user.id})`);
        needsFix = true;
        fixes.push('manager_id');
      }

      // Fix issues
      if (needsFix) {
        console.log(`  → Applying fixes...`);
        
        const updateFields = [];
        const params = [];

        if (fixes.includes('role')) {
          updateFields.push('role = ?');
          params.push('DepartmentHead');
        }

        if (fixes.includes('password')) {
          const defaultPassword = 'DeptHead@123';
          const passwordHash = await hashPassword(defaultPassword);
          updateFields.push('password_hash = ?');
          params.push(passwordHash);
          console.log(`    ✓ Password reset to: ${defaultPassword}`);
        }

        if (fixes.includes('is_active')) {
          updateFields.push('is_active = 1');
        }

        if (updateFields.length > 0) {
          params.push(user.id);
          await db.run(
            `UPDATE users SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            params
          );
          console.log(`  ✅ User updated`);
          fixed++;
        }

        if (fixes.includes('manager_id')) {
          await db.run('UPDATE departments SET manager_id = ? WHERE id = ?', [user.id, dept.id]);
          console.log(`  ✅ Department manager_id updated`);
        }
      } else {
        console.log(`  ✅ No issues found`);
      }

      // Test password verification
      if (user.password_hash && user.password_hash.startsWith('$2')) {
        const testPassword = 'DeptHead@123';
        const isValid = await comparePassword(testPassword, user.password_hash);
        if (isValid) {
          console.log(`  ✅ Password verification test: PASSED (with default password)`);
        } else {
          console.log(`  ⚠️  Password verification test: FAILED (password may have been changed)`);
        }
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Total Departments: ${departments.length}`);
    console.log(`Issues Found: ${issuesFound}`);
    console.log(`Issues Fixed: ${fixed}`);
    console.log('\n=== Login Credentials ===');
    console.log('Default password for all department heads: DeptHead@123');
    console.log('(If password was changed, use the actual password)');
    console.log('\nDepartment heads can now log in with:');
    console.log('- Email: The email from department (case-insensitive)');
    console.log('- Password: DeptHead@123 (or the password set during creation)');

    await db.close();
  } catch (error) {
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    await db.close();
    process.exit(1);
  }
}

diagnoseAndFixDepartmentHeads()
  .then(() => {
    console.log('\n✅ Diagnosis and fix completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });

