import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function initDB() {
  console.log('Connecting to Azure MySQL to create tables...');
  
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: 3306,
      ssl: { rejectUnauthorized: false },
      connectTimeout: 20000
    });

    console.log('Connected! Creating system tables...');

    // 1. Message Logs Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS message_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        campaign_id INT,
        phone_number VARCHAR(20) NOT NULL,
        status ENUM('success', 'failed') NOT NULL,
        error_message TEXT,
        message_id VARCHAR(255),
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Campaigns Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        template_name VARCHAR(255) NOT NULL,
        total_recipients INT DEFAULT 0,
        success_count INT DEFAULT 0,
        fail_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Contacts Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        age INT,
        phone_number VARCHAR(20) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. Tags Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tags (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL
      )
    `);

    // 5. Contact Tags Table (Relationship)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS contact_tags (
        contact_id INT,
        tag_id INT,
        PRIMARY KEY (contact_id, tag_id),
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      )
    `);

    console.log('SUCCESS: All system tables are ready.');
    await connection.end();
  } catch (error: any) {
    console.error('ERROR: Could not create table.');
    console.error(error.message);
    if (error.code === 'ETIMEDOUT') {
      console.log('\nSTILL TIMING OUT: Please check your Azure Networking / Firewall settings.');
    }
  }
}

initDB();
