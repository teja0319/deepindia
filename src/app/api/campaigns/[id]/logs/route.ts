import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!pool) return NextResponse.json([]);

  try {
    const connection = await pool.getConnection();
    const [rows]: any = await connection.query(
      'SELECT phone_number, status, error_message, message_id, sent_at FROM message_logs WHERE campaign_id = ? ORDER BY sent_at DESC',
      [id]
    );
    connection.release();
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
