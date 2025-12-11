const db = require('../config/database');
const { hashPassword } = require('../utils/auth');

async function updateFinanceDepartmentHead() {
  try {
    await db.connect();
    
    const newEmail = 'jtokpa@prinstinegroup.org';
    const newName = 'James S. Tokpa';
    const password = 'DeptHead@123';
    
    console.log('\n=== Updating Finance Department Head ===\n');
    console.log(`New Email: ${newEmail}`);
    console.log(`New Name: ${newName}`);
    console.log(`Password: ${password}\n`);
    
    // Check if user already exists
    let user = await db.get(
      'SELECT id, email, name, role FROM users WHERE LOWER(TRIM(email)) = ?',
      [newEmail.toLowerCase().trim()]
    );
    
    if (user) {
      console.log(`✓ User already exists: ${user.email} (ID: ${user.id})`);
      
      // Update user details
      const passwordHash = await hashPassword(password);
      await db.run(
        'UPDATE users SET name = ?, password_hash = ?, role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newName, passwordHash, 'DepartmentHead', user.id]
      );
      console.log(`✅ User updated successfully`);
    } else {
      // Create new user
      console.log('Creating new user...');
      const passwordHash = await hashPassword(password);
      const result = await db.run(
        'INSERT INTO users (email, name, role, password_hash, is_active, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [newEmail, newName, 'DepartmentHead', passwordHash]
      );
      console.log(`✅ New user created with ID: ${result.lastID}`);
      user = { id: result.lastID };
    }
    
    // Update department
    const dept = await db.get('SELECT id, name, head_email, manager_id FROM departments WHERE name LIKE ?', ['%Finance%']);
    if (dept) {
      await db.run(
        'UPDATE departments SET head_email = ?, head_name = ?, manager_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newEmail, newName, user.id, dept.id]
      );
      console.log(`✅ Department "${dept.name}" updated with new head`);
    }
    
    // Remove old user if exists
    const oldUser = await db.get(
      'SELECT id, email FROM users WHERE LOWER(TRIM(email)) = ? AND id != ?',
      ['johnbrown@gmail.com', user.id]
    );
    if (oldUser) {
      console.log(`\n⚠️  Old user found: ${oldUser.email} (ID: ${oldUser.id})`);
      console.log('   Consider removing or updating this user manually if needed');
    }
    
    await db.close();
    console.log('\n✅ Finance Department Head updated successfully!');
    console.log(`\nLogin credentials:`);
    console.log(`  Email: ${newEmail}`);
    console.log(`  Password: ${password}`);
  } catch (error) {
    console.error('Error:', error);
    await db.close();
    process.exit(1);
  }
}

updateFinanceDepartmentHead();

