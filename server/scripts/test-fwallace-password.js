#!/usr/bin/env node

/**
 * Script to test password for fwallace@prinstinegroup.org (database check)
 * Usage: node scripts/test-fwallace-password.js
 */

const db = require('../config/database');
const { comparePassword } = require('../utils/auth');

async function testPassword() {
  try {
    await db.connect();
    
    const email = 'fwallace@prinstinegroup.org';
    const password = 'User@123';
    
    console.log('\n=== Testing Password for fwallace@prinstinegroup.org ===\n');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}\n`);
    
    const normalizedEmail = email.toLowerCase().trim();
    const user = await db.get(
      'SELECT id, email, username, password_hash, role, name, is_active, email_verified FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1',
      [normalizedEmail]
    );
    
    if (!user) {
      console.log('❌ User not found');
      await db.close();
      process.exit(1);
    }
    
    console.log('✓ User found:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Active: ${user.is_active === 1 ? 'Yes' : 'No'}`);
    console.log(`   Email Verified: ${user.email_verified === 1 ? 'Yes' : 'No'}`);
    console.log(`   Has Password Hash: ${user.password_hash ? 'Yes' : 'No'}\n`);
    
    // Check role
    if (user.role !== 'Admin' && user.role !== 'DepartmentHead' && user.role !== 'Staff') {
      console.log('❌ Role not allowed for login:', user.role);
      console.log('   Only Admin, DepartmentHead, and Staff can log in');
      await db.close();
      process.exit(1);
    }
    
    // Check active
    if (!user.is_active) {
      console.log('❌ Account is not active');
      await db.close();
      process.exit(1);
    }
    
    // Check password
    if (!user.password_hash) {
      console.log('❌ No password hash set');
      await db.close();
      process.exit(1);
    }
    
    console.log('Testing password...');
    const isValid = await comparePassword(password, user.password_hash);
    
    if (isValid) {
      console.log('\n✅ PASSWORD VERIFICATION SUCCESSFUL!');
      console.log('\n📝 Login Credentials:');
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${password}`);
      console.log('\n✅ Ready to login! Start the server and test login.');
    } else {
      console.log('\n❌ PASSWORD VERIFICATION FAILED');
      console.log('   The password "User@123" does not match the stored hash');
    }
    
    await db.close();
    process.exit(isValid ? 0 : 1);
  } catch (error) {
    console.error('Error:', error);
    await db.close();
    process.exit(1);
  }
}

testPassword();

