import axios from 'axios';

async function testAPIs() {
  const BASE_URL = 'http://localhost:3000/api';
  console.log('--- STARTING API HEALTH CHECK ---');

  const endpoints = [
    { name: 'Templates', url: '/templates', method: 'GET' },
    { name: 'Stats', url: '/stats', method: 'GET' },
    { name: 'Campaigns', url: '/campaigns', method: 'GET' },
    { name: 'Contacts', url: '/contacts', method: 'GET' }
  ];

  for (const ep of endpoints) {
    try {
      console.log(`Testing [${ep.method}] ${ep.name}...`);
      const res = await axios.get(`${BASE_URL}${ep.url}`);
      console.log(`✅ ${ep.name}: SUCCESS (${Array.isArray(res.data) ? res.data.length : 'Object'} items)`);
    } catch (err: any) {
      console.log(`❌ ${ep.name}: FAILED - ${err.message}`);
      if (err.response) console.log('   Data:', err.response.data);
    }
  }

  console.log('--- API CHECK COMPLETE ---');
}

testAPIs();
