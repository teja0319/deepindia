import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function checkLogin() {
  console.log('Testing login for user:', process.env.DB_USER);
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      port: 3306,
      ssl: { rejectUnauthorized: false }
    });
    console.log('✅ LOGIN SUCCESS!');
    const [databases] = await connection.query('SHOW DATABASES');
    console.log('Available Databases:', databases);
    await connection.end();
  } catch (error: any) {
    console.error('❌ LOGIN FAILED:', error.message);
  }
}

checkLogin();
