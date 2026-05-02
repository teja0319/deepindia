import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const connection = await pool.getConnection();
    
    // Create Campaigns table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        template_name VARCHAR(255) NOT NULL,
        status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
        total_records INT DEFAULT 0,
        success_count INT DEFAULT 0,
        fail_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Logs table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS message_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        campaign_id INT,
        phone_number VARCHAR(20) NOT NULL,
        status ENUM('success', 'failed') NOT NULL,
        error_message TEXT,
        message_id VARCHAR(255),
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
      )
    `);

    connection.release();
    return NextResponse.json({ message: 'Database initialized successfully' });
  } catch (error: any) {
    console.error('Database Init Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
