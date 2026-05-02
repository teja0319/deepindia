import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const TOKEN = process.env.WHATSAPP_TOKEN;
const WABA_ID = process.env.WABA_ID;
const VERSION = process.env.API_VERSION || 'v21.0';

async function testConnection() {
  try {
    const url = `https://graph.facebook.com/${VERSION}/${WABA_ID}/message_templates`;
    console.log(`Testing URL: ${url}`);
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    console.log('SUCCESS! Templates found:', response.data.data.length);
  } catch (error: any) {
    console.error('FAILED!', error.response?.data || error.message);
  }
}

testConnection();
