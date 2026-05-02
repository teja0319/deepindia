import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  if (!pool) {
    return NextResponse.json({ totalSent: 0, campaigns: 0, deliveryRate: 0 });
  }

  try {
    const connection = await pool.getConnection();
    
    // 1. Total Sent
    const [sentRows]: any = await connection.query('SELECT COUNT(*) as total FROM message_logs WHERE status = "success"');
    
    // 2. Total Campaigns
    const [campRows]: any = await connection.query('SELECT COUNT(*) as total FROM campaigns');
    
    // 3. Delivery Rate
    const [totalRows]: any = await connection.query('SELECT COUNT(*) as total FROM message_logs');
    const total = totalRows[0].total || 0;
    const success = sentRows[0].total || 0;
    const deliveryRate = total > 0 ? Math.round((success / total) * 100) : 0;

    connection.release();

    return NextResponse.json({
      totalSent: success,
      campaigns: campRows[0].total || 0,
      deliveryRate: deliveryRate
    });
  } catch (error: any) {
    console.error('Stats fetch failed:', error);
    return NextResponse.json({ totalSent: 0, campaigns: 0, deliveryRate: 0, error: error.message }, { status: 500 });
  }
}
