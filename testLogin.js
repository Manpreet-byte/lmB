const axios = require('axios');

const API_URL = 'http://localhost:5000/api/users/login';

const testUsers = [
  {
    name: 'Admin',
    email: 'admin@example.com',
    password: 'admin123',
  },
  {
    name: 'Student',
    email: 'student@example.com',
    password: 'student123',
  },
];

const testLogin = async () => {
  console.log('\n========================================');
  console.log('  🔐 LOGIN TEST SUITE');
  console.log('========================================\n');

  for (const user of testUsers) {
    try {
      console.log(`🧪 Testing ${user.name} Login...`);
      console.log(`   📧 Email: ${user.email}`);
      console.log(`   🔑 Password: ${user.password}`);

      const response = await axios.post(API_URL, {
        email: user.email,
        password: user.password,
      });

      const data = response.data;

      console.log('\n✅ LOGIN SUCCESSFUL!\n');
      console.log('Response Data:');
      console.log(`   ID: ${data._id}`);
      console.log(`   Name: ${data.name}`);
      console.log(`   Email: ${data.email}`);
      console.log(`   Role: ${data.role}`);
      console.log(`   Token: ${data.token.substring(0, 50)}...`);
      console.log(`   Status: ${response.status}`);

      // Test with token - Get user profile
      console.log('\n🔍 Testing Protected Route (Get Profile)...');
      try {
        const profileResponse = await axios.get(
          'http://localhost:5000/api/users/profile',
          {
            headers: {
              Authorization: `Bearer ${data.token}`,
            },
          }
        );
        console.log('✅ Protected Route Access Successful!');
        console.log(`   Profile: ${profileResponse.data.name} (${profileResponse.data.role})`);
      } catch (error) {
        console.log('❌ Protected Route Failed:');
        console.log(`   Error: ${error.response?.data?.message || error.message}`);
      }

      console.log('\n----------------------------------------\n');
    } catch (error) {
      console.log('❌ LOGIN FAILED!\n');
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Error: ${error.response.data?.message || error.response.statusText}`);
      } else {
        console.log(`   Error: ${error.message}`);
      }
      console.log('\n----------------------------------------\n');
    }
  }

  // Test invalid login
  console.log('🧪 Testing Invalid Login (Wrong Password)...');
  try {
    await axios.post(API_URL, {
      email: 'admin@example.com',
      password: 'wrongpassword',
    });
    console.log('❌ Should have failed but didn\'t!');
  } catch (error) {
    console.log('✅ Correctly Rejected Invalid Credentials!');
    console.log(`   Error: ${error.response?.data?.message}`);
  }

  console.log('\n========================================');
  console.log('  ✨ TEST SUITE COMPLETE');
  console.log('========================================\n');
};

testLogin();
