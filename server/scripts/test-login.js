const db = require('../config/database');
const { comparePassword } = require('../utils/auth');

async function testLogin() {
  try {
    await db.connect();
    
    const testCases = [
      { email: 'admin@prinstine.com', password: 'Admin@123' },
      { email: 'jsieh@prinstinegroup.org', password: 'DeptHead@123' }
    ];
    
    for (const test of testCases) {
      console.log(`\n=== Testing: ${test.email} ===`);
      const normalizedEmail = test.email.toLowerCase().trim();
      console.log('Normalized email:', normalizedEmail);
      
      // Try the same queries as the login route
      let user = await db.get(
        'SELECT id, email, username, password_hash, role, name, is_active, email_verified FROM users WHERE LOWER(TRIM(email)) = ?',
        [normalizedEmail]
      );
      
      if (!user) {
        user = await db.get(
          'SELECT id, email, username, password_hash, role, name, is_active, email_verified FROM users WHERE LOWER(email) = ?',
          [normalizedEmail]
        );
      }
      
      if (!user) {
        user = await db.get(
          'SELECT id, email, username, password_hash, role, name, is_active, email_verified FROM users WHERE email = ?',
          [test.email]
        );
      }
      
      if (!user) {
        console.log('❌ User not found');
        continue;
      }
      
      console.log('✓ User found:', {
        id: user.id,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
        hasPassword: !!user.password_hash
      });
      
      // Check role
      if (user.role !== 'Admin' && user.role !== 'DepartmentHead') {
        console.log('❌ Role not allowed:', user.role);
        continue;
      }
      
      // Check active
      if (!user.is_active) {
        console.log('❌ Account not active');
        continue;
      }
      
      // Check password
      if (!user.password_hash) {
        console.log('❌ No password hash');
        continue;
      }
      
      const isValid = await comparePassword(test.password, user.password_hash);
      console.log('Password check:', isValid ? '✓ Valid' : '❌ Invalid');
      
      if (isValid) {
        console.log('✅ Login should succeed!');
      } else {
        console.log('❌ Login would fail - password mismatch');
      }
    }
    
    await db.close();
  } catch (error) {
    console.error('Error:', error);
    await db.close();
    process.exit(1);
  }
}

testLogin();

