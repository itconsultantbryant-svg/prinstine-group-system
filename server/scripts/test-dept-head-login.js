const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { comparePassword } = require('../utils/auth');

const dbPath = path.join(__dirname, '../../database/pms.db');
const db = new sqlite3.Database(dbPath);

function promisify(method, ...args) {
  return new Promise((resolve, reject) => {
    db[method](...args, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

async function testDepartmentHeadLogin() {
  try {
    console.log('=== Testing Department Head Login ===\n');
    
    // Get all department heads
    const deptHeads = await promisify('all',
      `SELECT u.id, u.email, u.username, u.password_hash, u.role, u.name, u.is_active, u.email_verified,
              d.name as department_name, d.head_email
       FROM users u
       LEFT JOIN departments d ON u.id = d.manager_id OR LOWER(u.email) = LOWER(d.head_email)
       WHERE u.role = 'DepartmentHead'`
    );
    
    console.log(`Found ${deptHeads.length} department head(s):\n`);
    
    for (const head of deptHeads) {
      console.log(`--- Department Head: ${head.name} ---`);
      console.log(`ID: ${head.id}`);
      console.log(`Email: ${head.email}`);
      console.log(`Username: ${head.username}`);
      console.log(`Role: ${head.role}`);
      console.log(`Is Active: ${head.is_active}`);
      console.log(`Email Verified: ${head.email_verified}`);
      console.log(`Department: ${head.department_name || 'N/A'}`);
      console.log(`Department Head Email: ${head.head_email || 'N/A'}`);
      console.log(`Password Hash: ${head.password_hash ? 'EXISTS (' + head.password_hash.substring(0, 20) + '...)' : 'MISSING!'}`);
      
      // Test email lookup
      const normalizedEmail = head.email.toLowerCase().trim();
      console.log(`\nTesting email lookup for: "${normalizedEmail}"`);
      
      let foundUser = await promisify('get',
        'SELECT id, email, password_hash FROM users WHERE LOWER(TRIM(email)) = ?',
        [normalizedEmail]
      );
      
      if (!foundUser) {
        foundUser = await promisify('get',
          'SELECT id, email, password_hash FROM users WHERE LOWER(email) = ?',
          [normalizedEmail]
        );
      }
      
      if (!foundUser) {
        foundUser = await promisify('get',
          'SELECT id, email, password_hash FROM users WHERE email = ?',
          [head.email]
        );
      }
      
      if (foundUser) {
        console.log(`✓ User found via lookup: ${foundUser.email}`);
        console.log(`  Password hash exists: ${foundUser.password_hash ? 'YES' : 'NO'}`);
      } else {
        console.log(`✗ User NOT found via any lookup method!`);
      }
      
      console.log('\n');
    }
    
    // Test with a sample password
    if (deptHeads.length > 0) {
      const testHead = deptHeads[0];
      console.log(`\n=== Testing Password Verification ===`);
      console.log(`Testing with user: ${testHead.email}`);
      
      if (testHead.password_hash) {
        // Test with common default password
        const testPasswords = ['DeptHead@123', 'password123', 'admin123'];
        for (const testPwd of testPasswords) {
          const isValid = await comparePassword(testPwd, testHead.password_hash);
          console.log(`Password "${testPwd}": ${isValid ? '✓ MATCHES' : '✗ Does not match'}`);
        }
      } else {
        console.log('✗ No password hash found for this user!');
      }
    }
    
    db.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testDepartmentHeadLogin();

