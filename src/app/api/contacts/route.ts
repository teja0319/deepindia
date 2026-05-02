import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  if (!pool) return NextResponse.json([]);

  try {
    const connection = await pool.getConnection();
    const [rows]: any = await connection.query(`
      SELECT 
        c.id, 
        c.name, 
        c.age, 
        c.phone_number as phone, 
        c.created_at as joined,
        GROUP_CONCAT(t.name) as tags
      FROM contacts c
      LEFT JOIN contact_tags ct ON c.id = ct.contact_id
      LEFT JOIN tags t ON ct.tag_id = t.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    connection.release();
    
    const formattedRows = rows.map((r: any) => ({
      ...r,
      tags: r.tags ? r.tags.split(',') : []
    }));

    return NextResponse.json(formattedRows);
  } catch (error: any) {
    console.error('Contacts fetch failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
