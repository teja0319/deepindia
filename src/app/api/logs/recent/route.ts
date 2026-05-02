import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  if (!pool) return NextResponse.json([]);

  try {
    const connection = await pool.getConnection();
    const [rows]: any = await connection.query(`
      SELECT 
        l.id,
        l.phone_number,
        l.status,
        l.sent_at,
        c.name as campaign_name
      FROM message_logs l
      LEFT JOIN campaigns c ON l.campaign_id = c.id
      ORDER BY l.sent_at DESC
      LIMIT 10
    `);
    connection.release();
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('Recent logs fetch failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
