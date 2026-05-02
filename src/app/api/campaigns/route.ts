import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  if (!pool) return NextResponse.json([]);

  try {
    const connection = await pool.getConnection();
    const [rows]: any = await connection.query(`
      SELECT 
        id, 
        name, 
        template_name as template, 
        total_recipients, 
        success_count, 
        fail_count, 
        created_at as date
      FROM campaigns 
      ORDER BY created_at DESC
    `);
    connection.release();
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('Campaigns fetch failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
