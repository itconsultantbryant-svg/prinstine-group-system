const db = require('../config/database');
const { hashPassword } = require('../utils/auth');

async function resetDepartmentHeadPassword() {
  try {
    // Connect to database
    await db.connect();
    
    const email = process.argv[2];
    const newPassword = process.argv[3] || 'DeptHead@123';
    
    if (!email) {
      console.error('Usage: node reset-dept-head-password.js <email> [new_password]');
      console.error('Example: node reset-dept-head-password.js head@marketing.com NewPass123');
      await db.close();
      process.exit(1);
    }
    
    console.log(`\n=== Resetting Password ===\n`);
    console.log(`Email: ${email}`);
    console.log(`New Password: ${newPassword}\n`);
    
    // Find user
    const normalizedEmail = email.toLowerCase().trim();
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
    
    if (!user) {
      console.error(`✗ User not found with email: ${email}`);
      await db.close();
      process.exit(1);
    }
    
    console.log(`✓ Found user: ${user.email} (ID: ${user.id}, Role: ${user.role})`);
    
    // Hash new password
    console.log('Hashing new password...');
    const passwordHash = await hashPassword(newPassword);
    
    // Update password
    console.log('Updating password in database...');
    await db.run(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [passwordHash, user.id]
    );
    
    // Verify update
    const updatedUser = await db.get(
      'SELECT id, email, password_hash FROM users WHERE id = ?',
      [user.id]
    );
    
    if (updatedUser.password_hash) {
      console.log(`\n✅ Password reset successfully!`);
      console.log(`User can now login with:`);
      console.log(`  Email: ${updatedUser.email}`);
      console.log(`  Password: ${newPassword}`);
    } else {
      console.error(`\n✗ Password update failed - hash not found`);
      await db.close();
      process.exit(1);
    }
    
    await db.close();
  } catch (error) {
    console.error('Error:', error);
    await db.close();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  resetDepartmentHeadPassword();
}

module.exports = resetDepartmentHeadPassword;
