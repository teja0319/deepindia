import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function testDB() {
  console.log('Attempting to connect to:', process.env.DB_HOST);
  console.log('User:', process.env.DB_USER);
  console.log('Database:', process.env.DB_NAME);

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: 3306,
      ssl: { rejectUnauthorized: false },
      connectTimeout: 15000
    });
    console.log('SUCCESS! Connected to Azure MySQL');
    await connection.end();
  } catch (error: any) {
    console.error('CONNECTION FAILED!');
    console.error('Error Code:', error.code);
    console.error('Error Message:', error.message);
    
    if (error.code === 'ETIMEDOUT') {
      console.log('\nTIP: This usually means the Azure Firewall is blocking your IP.');
      console.log('Please go to Azure Portal -> Your MySQL Server -> Networking and:');
      console.log('1. Click "+ Add current client IP address"');
      console.log('2. Check "Allow public access from any Azure service within Azure to this server"');
    }
  }
}

testDB();
