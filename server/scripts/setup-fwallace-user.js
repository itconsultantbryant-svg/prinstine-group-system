#!/usr/bin/env node

/**
 * Script to create or update fwallace@prinstinegroup.org user
 * Usage: node scripts/setup-fwallace-user.js
 */

const db = require('../config/database');
const { hashPassword } = require('../utils/auth');

async function setupFwallaceUser() {
  try {
    await db.connect();
    
    const email = 'fwallace@prinstinegroup.org';
    const name = 'Francess Wallace';
    const role = 'DepartmentHead';
    const password = 'User@123'; // Default password for department heads
    
    console.log('\n=== Setting up fwallace@prinstinegroup.org user ===\n');
    console.log(`Email: ${email}`);
    console.log(`Name: ${name}`);
    console.log(`Role: ${role}`);
    console.log(`Password: ${password}\n`);
    
    // Check if user already exists with this email
    let user = await db.get(
      'SELECT id, email, name, role, is_active FROM users WHERE LOWER(TRIM(email)) = ?',
      [email.toLowerCase().trim()]
    );
    
    if (user) {
      console.log(`✓ User already exists: ${user.email} (ID: ${user.id})`);
      
      // Update password to ensure it's set correctly
      const passwordHash = await hashPassword(password);
      await db.run(
        'UPDATE users SET password_hash = ?, name = ?, role = ?, is_active = 1, email_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [passwordHash, name, role, user.id]
      );
      console.log(`✅ User updated successfully with password reset`);
    } else {
      // Check if fwallace@gmail.com exists and we should update it
      const oldUser = await db.get(
        'SELECT id, email, name, role FROM users WHERE LOWER(TRIM(email)) = ?',
        ['fwallace@gmail.com']
      );
      
      if (oldUser) {
        console.log(`Found existing user with fwallace@gmail.com (ID: ${oldUser.id})`);
        console.log('Updating email to fwallace@prinstinegroup.org...');
        
        const passwordHash = await hashPassword(password);
        await db.run(
          'UPDATE users SET email = ?, password_hash = ?, name = ?, role = ?, is_active = 1, email_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [email, passwordHash, name, role, oldUser.id]
        );
        console.log(`✅ User email updated from fwallace@gmail.com to ${email}`);
      } else {
        // Create new user
        console.log('Creating new user...');
        const passwordHash = await hashPassword(password);
        const username = email.split('@')[0];
        const result = await db.run(
          `INSERT INTO users (email, username, name, role, password_hash, is_active, email_verified, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [email, username, name, role, passwordHash]
        );
        console.log(`✅ New user created with ID: ${result.lastID}`);
        user = { id: result.lastID };
      }
    }
    
    // Verify the user
    const verifiedUser = await db.get(
      'SELECT id, email, username, name, role, is_active, email_verified FROM users WHERE LOWER(TRIM(email)) = ?',
      [email.toLowerCase().trim()]
    );
    
    if (verifiedUser) {
      console.log('\n✅ User setup complete:');
      console.log(`   ID: ${verifiedUser.id}`);
      console.log(`   Email: ${verifiedUser.email}`);
      console.log(`   Username: ${verifiedUser.username}`);
      console.log(`   Name: ${verifiedUser.name}`);
      console.log(`   Role: ${verifiedUser.role}`);
      console.log(`   Active: ${verifiedUser.is_active === 1 ? 'Yes' : 'No'}`);
      console.log(`   Email Verified: ${verifiedUser.email_verified === 1 ? 'Yes' : 'No'}`);
      console.log(`\n📝 Login Credentials:`);
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${password}`);
    } else {
      console.error('❌ Failed to verify user creation');
    }
    
    await db.close();
    console.log('\n✅ Done!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    await db.close();
    process.exit(1);
  }
}

setupFwallaceUser();

