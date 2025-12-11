const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000/api';

// Test users from USER_CREDENTIALS.md
const testUsers = [
  // Admin
  { email: 'admin@prinstine.com', password: 'Admin@123', role: 'Admin', name: 'Prince S. Cooper' },
  
  // Department Heads
  { email: 'cmoore@prinstinegroup.org', password: 'User@123', role: 'DepartmentHead', name: 'Christian Moore' },
  { email: 'sackie@gmail.com', password: 'User@123', role: 'DepartmentHead', name: 'Emma Sackie' },
  { email: 'eksackie@prinstinegroup.org', password: 'User@123', role: 'DepartmentHead', name: 'Emmanuel Sackie' },
  { email: 'fwallace@gmail.com', password: 'User@123', role: 'DepartmentHead', name: 'Francess Wallace' },
  { email: 'jtokpa@prinstinegroup.org', password: 'User@123', role: 'DepartmentHead', name: 'James S. Tokpa' },
  { email: 'jsieh@prinstinegroup.org', password: 'User@123', role: 'DepartmentHead', name: 'Jamesetta L. Sieh' },
  { email: 'johnbrown@gmail.com', password: 'User@123', role: 'DepartmentHead', name: 'John Brown' },
  { email: 'wbuku@prinstinegroup.org', password: 'User@123', role: 'DepartmentHead', name: 'Williams L. Buku' },
];

async function testLogin(user) {
  try {
    console.log(`\n=== Testing: ${user.name} (${user.email}) ===`);
    
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: user.email,
      password: user.password
    }, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.data && response.data.token) {
      console.log(`✅ SUCCESS: Login successful`);
      console.log(`   Role: ${response.data.user?.role || 'N/A'}`);
      console.log(`   Name: ${response.data.user?.name || 'N/A'}`);
      console.log(`   Token: ${response.data.token.substring(0, 20)}...`);
      return { success: true, user: response.data.user };
    } else {
      console.log(`❌ FAILED: No token in response`);
      return { success: false, error: 'No token received' };
    }
  } catch (error) {
    if (error.response) {
      console.log(`❌ FAILED: ${error.response.status} - ${error.response.data?.error || error.message}`);
      return { success: false, error: error.response.data?.error || error.message, status: error.response.status };
    } else if (error.request) {
      console.log(`❌ FAILED: No response from server - ${error.message}`);
      return { success: false, error: 'Connection error', message: error.message };
    } else {
      console.log(`❌ FAILED: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

async function runAllTests() {
  console.log('========================================');
  console.log('  LOGIN TESTING FOR ALL USERS');
  console.log('========================================\n');
  
  // First check if server is running
  try {
    const healthCheck = await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 });
    console.log('✅ Server is running and responding');
    console.log(`   Health check: ${healthCheck.data.status}\n`);
  } catch (error) {
    console.log('❌ Server is not responding!');
    console.log('   Please make sure the backend server is running on port 5000\n');
    process.exit(1);
  }

  const results = {
    total: testUsers.length,
    successful: 0,
    failed: 0,
    details: []
  };

  for (const user of testUsers) {
    const result = await testLogin(user);
    results.details.push({ user, result });
    if (result.success) {
      results.successful++;
    } else {
      results.failed++;
    }
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Summary
  console.log('\n========================================');
  console.log('  TEST SUMMARY');
  console.log('========================================');
  console.log(`Total Tests: ${results.total}`);
  console.log(`✅ Successful: ${results.successful}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log('========================================\n');

  // Show failed tests
  if (results.failed > 0) {
    console.log('Failed Logins:');
    results.details.forEach(({ user, result }) => {
      if (!result.success) {
        console.log(`  - ${user.name} (${user.email}): ${result.error || result.message || 'Unknown error'}`);
      }
    });
    console.log('');
  }

  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

