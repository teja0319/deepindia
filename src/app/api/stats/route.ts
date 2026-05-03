import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  if (!pool) {
    return NextResponse.json({ 
      totalSent: 0, 
      totalFailed: 0,
      campaigns: 0, 
      totalContacts: 0,
      deliveryRate: 0, 
      topTemplates: [] 
    });
  }

  try {
    const connection = await pool.getConnection();
    
    // 1. Total Sent & Failed
    const [sentRows]: any = await connection.query('SELECT COUNT(*) as total FROM message_logs WHERE status = "success"');
    const [failRows]: any = await connection.query('SELECT COUNT(*) as total FROM message_logs WHERE status = "failed"');
    
    // 2. Total Campaigns
    const [campRows]: any = await connection.query('SELECT COUNT(*) as total FROM campaigns');
    
    // 3. Total Contacts
    const [contactRows]: any = await connection.query('SELECT COUNT(*) as total FROM contacts');

    // 4. Template Usage
    const [templateRows]: any = await connection.query(`
      SELECT template_name as name, 
             CAST(SUM(success_count) AS UNSIGNED) as success, 
             CAST(SUM(fail_count) AS UNSIGNED) as fail,
             COUNT(*) as usage_count
      FROM campaigns 
      GROUP BY template_name 
      ORDER BY usage_count DESC 
      LIMIT 3
    `);

    // 5. Recent Campaigns Performance
    const [recentCampaigns]: any = await connection.query(`
      SELECT name, success_count as success, fail_count as fail, total_recipients as total
      FROM campaigns
      ORDER BY created_at DESC
      LIMIT 5
    `);

    const successCount = Number(sentRows[0].total) || 0;
    const failCount = Number(failRows[0].total) || 0;
    const totalCount = successCount + failCount;
    const deliveryRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;

    connection.release();

    return NextResponse.json({
      totalSent: successCount,
      totalFailed: failCount,
      campaigns: campRows[0].total || 0,
      totalContacts: contactRows[0].total || 0,
      deliveryRate: deliveryRate,
      topTemplates: templateRows,
      recentCampaigns: recentCampaigns
    });
  } catch (error: any) {
    console.error('Stats fetch failed:', error);
    return NextResponse.json({ 
      totalSent: 0, 
      totalFailed: 0,
      campaigns: 0, 
      totalContacts: 0,
      deliveryRate: 0, 
      topTemplates: [],
      recentCampaigns: [],
      error: error.message 
    }, { status: 500 });
  }
}
