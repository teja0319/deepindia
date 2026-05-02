import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function audit() {
  console.log('--- DATABASE DATA AUDIT ---');
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT || '3306'),
    ssl: { rejectUnauthorized: false }
  });

  try {
    const connection = await pool.getConnection();

    // 1. Campaigns
    const [campaigns]: any = await connection.query('SELECT * FROM campaigns');
    console.log(`\nCAMPAIGNS: Found ${campaigns.length} campaigns`);
    campaigns.forEach((c: any) => {
      console.log(`- [${c.id}] ${c.name} (Template: ${c.template_name})`);
    });

    // 2. Logs
    const [logs]: any = await connection.query('SELECT * FROM message_logs LIMIT 5');
    console.log(`\nMESSAGE LOGS: Found ${logs.length} (showing last 5)`);
    logs.forEach((l: any) => {
      console.log(`- ${l.phone_number}: ${l.status}`);
    });

    connection.release();
  } catch (err: any) {
    console.log('Audit failed:', err.message);
  }
  process.exit();
}

audit();
