const db = require('../config/database');
const { hashPassword } = require('../utils/auth');

async function createMissingDepartmentHeads() {
  try {
    await db.connect();
    console.log('=== Creating Missing Department Head Accounts ===\n');
    
    // Get all departments with head_email but no manager_id
    const departments = await db.all(
      `SELECT id, name, head_email, head_name, head_phone 
       FROM departments 
       WHERE head_email IS NOT NULL AND head_email != '' AND manager_id IS NULL`
    );
    
    console.log(`Found ${departments.length} department(s) with head_email but no manager_id:\n`);
    
    for (const dept of departments) {
      console.log(`--- Processing: ${dept.name} ---`);
      console.log(`Head Email: ${dept.head_email}`);
      console.log(`Head Name: ${dept.head_name}`);
      
      const normalizedEmail = dept.head_email.toLowerCase().trim();
      
      // Check if user exists
      let user = await db.get(
        'SELECT id, email, role FROM users WHERE LOWER(TRIM(email)) = ?',
        [normalizedEmail]
      );
      
      if (!user) {
        user = await db.get(
          'SELECT id, email, role FROM users WHERE LOWER(email) = ?',
          [normalizedEmail]
        );
      }
      
      if (user) {
        // User exists - check if they're already DepartmentHead
        if (user.role === 'DepartmentHead') {
          console.log(`  ✓ User already exists as DepartmentHead (ID: ${user.id})`);
          // Update manager_id
          await db.run(
            'UPDATE departments SET manager_id = ? WHERE id = ?',
            [user.id, dept.id]
          );
          console.log(`  ✓ Linked department to user`);
        } else {
          // User exists but wrong role - update to DepartmentHead
          console.log(`  ⚠️ User exists but has role: ${user.role}`);
          console.log(`  → Converting to DepartmentHead role...`);
          
          // Check password
          const userCheck = await db.get('SELECT password_hash FROM users WHERE id = ?', [user.id]);
          if (!userCheck.password_hash) {
            const defaultPassword = 'DeptHead@123';
            const passwordHash = await hashPassword(defaultPassword);
            await db.run(
              'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [passwordHash, user.id]
            );
            console.log(`  ✓ Password set to: ${defaultPassword}`);
          } else {
            console.log(`  ✓ Password already exists`);
          }
          
          // Update role to DepartmentHead
          await db.run(
            'UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['DepartmentHead', user.id]
          );
          
          // Update manager_id
          await db.run(
            'UPDATE departments SET manager_id = ? WHERE id = ?',
            [user.id, dept.id]
          );
          console.log(`  ✓ Updated role to DepartmentHead and linked department`);
          console.log(`  → User can now log in with email: ${user.email}`);
        }
      } else {
        // User doesn't exist - create new DepartmentHead user
        console.log(`  → Creating new DepartmentHead user...`);
        
        const defaultPassword = 'DeptHead@123';
        const passwordHash = await hashPassword(defaultPassword);
        const username = normalizedEmail.split('@')[0];
        
        // Check if username already exists
        const existingUsername = await db.get('SELECT id FROM users WHERE username = ?', [username]);
        let finalUsername = username;
        if (existingUsername) {
          // Add department name to username to make it unique
          finalUsername = `${username}_${dept.name.toLowerCase().replace(/\s+/g, '_')}`;
          console.log(`  → Username ${username} exists, using: ${finalUsername}`);
        }
        
        const userResult = await db.run(
          `INSERT INTO users (email, username, password_hash, role, name, phone, is_active, email_verified)
           VALUES (?, ?, ?, ?, ?, ?, 1, 1)`,
          [normalizedEmail, finalUsername, passwordHash, 'DepartmentHead', dept.head_name, dept.head_phone || null]
        );
        
        // Update manager_id
        await db.run(
          'UPDATE departments SET manager_id = ? WHERE id = ?',
          [userResult.lastID, dept.id]
        );
        
        console.log(`  ✓ Created DepartmentHead user (ID: ${userResult.lastID})`);
        console.log(`  ✓ Password set to: ${defaultPassword}`);
        console.log(`  ✓ Linked department to user`);
      }
      
      console.log('');
    }
    
    console.log('=== Complete ===\n');
    console.log('Department heads can now log in with:');
    console.log('- Email: The email from department creation');
    console.log('- Password: DeptHead@123 (or the password set during creation)');
    
    await db.close();
  } catch (error) {
    console.error('Error:', error);
    await db.close();
    process.exit(1);
  }
}

createMissingDepartmentHeads();

