#!/usr/bin/env node

/**
 * Script to test login for fwallace@prinstinegroup.org
 * Usage: node scripts/test-fwallace-login.js
 */

const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';

async function testFwallaceLogin() {
  const email = 'fwallace@prinstinegroup.org';
  const password = 'User@123';
  
  console.log('\n=== Testing Login for fwallace@prinstinegroup.org ===\n');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`API URL: ${API_BASE_URL}/auth/login\n`);
  
  try {
    const startTime = Date.now();
    
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email,
      password
    }, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (response.status === 200 && response.data) {
      console.log('✅ LOGIN SUCCESSFUL!');
      console.log(`\nResponse time: ${duration}ms`);
      console.log('\nResponse data:');
      console.log(`  Token: ${response.data.token ? response.data.token.substring(0, 50) + '...' : 'Missing'}`);
      if (response.data.user) {
        console.log(`  User ID: ${response.data.user.id}`);
        console.log(`  Email: ${response.data.user.email}`);
        console.log(`  Username: ${response.data.user.username}`);
        console.log(`  Name: ${response.data.user.name}`);
        console.log(`  Role: ${response.data.user.role}`);
        console.log(`  Email Verified: ${response.data.user.emailVerified}`);
      }
      console.log('\n✅ Login test passed!');
      process.exit(0);
    } else {
      console.error('❌ Unexpected response:', response.status, response.data);
      process.exit(1);
    }
  } catch (error) {
    if (error.response) {
      // Server responded with error status
      console.error('❌ LOGIN FAILED');
      console.error(`Status: ${error.response.status}`);
      console.error(`Error: ${error.response.data?.error || error.response.statusText}`);
      if (error.response.data?.errors) {
        console.error('Validation errors:', error.response.data.errors);
      }
    } else if (error.request) {
      // Request made but no response
      console.error('❌ No response from server');
      console.error('Make sure the server is running on port 5000');
      console.error('Error:', error.message);
    } else {
      // Error setting up request
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  }
}

// Check if server is accessible first
axios.get(`${API_BASE_URL.replace('/api', '')}/health`)
  .then(() => {
    testFwallaceLogin();
  })
  .catch(() => {
    console.warn('⚠️  Health check failed, attempting login anyway...');
    testFwallaceLogin();
  });

