import dotenv from 'dotenv';
dotenv.config();
import pool from './db';

async function checkData() {
  console.log('--- DATABASE DATA AUDIT ---');
  if (!pool) {
    console.log('No pool available');
    return;
  }

  try {
    const connection = await pool.getConnection();

    // 1. Campaigns
    const [campaigns]: any = await connection.query('SELECT * FROM campaigns ORDER BY created_at DESC LIMIT 5');
    console.log(`\nCAMPAIGNS (${campaigns.length} recent):`);
    campaigns.forEach((c: any) => {
      console.log(`- [${c.id}] ${c.name} | Sent: ${c.success_count}/${c.total_recipients} | Date: ${c.created_at}`);
    });

    // 2. Recent Message Logs
    const [logs]: any = await connection.query('SELECT * FROM message_logs ORDER BY sent_at DESC LIMIT 5');
    console.log(`\nMESSAGE LOGS (${logs.length} recent):`);
    logs.forEach((l: any) => {
      console.log(`- [${l.sent_at}] ${l.phone_number} | Status: ${l.status} | ID: ${l.message_id || 'N/A'}`);
    });

    // 3. Contacts
    const [contacts]: any = await connection.query('SELECT COUNT(*) as total FROM contacts');
    console.log(`\nTOTAL CONTACTS: ${contacts[0].total}`);

    connection.release();
  } catch (err: any) {
    console.error('Audit failed:', err.message);
  }
  process.exit();
}

checkData();
