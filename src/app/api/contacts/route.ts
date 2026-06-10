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

export async function POST(req: Request) {
  if (!pool) return NextResponse.json({ error: 'DB not connected' }, { status: 500 });

  try {
    const { name, phone, age, tags } = await req.json();
    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const connection = await pool.getConnection();
    
    // Check if phone number already exists
    const [existing]: any = await connection.query('SELECT id FROM contacts WHERE phone_number = ?', [phone]);
    if (existing.length > 0) {
      connection.release();
      return NextResponse.json({ error: 'Contact with this phone number already exists' }, { status: 409 });
    }

    await connection.beginTransaction();

    try {
      // 1. Insert contact
      const [insertRes]: any = await connection.query(
        'INSERT INTO contacts (phone_number, name, age) VALUES (?, ?, ?)',
        [phone, name, age]
      );
      const contactId = insertRes.insertId;

      // 2. Link Tags
      if (tags && Array.isArray(tags)) {
        for (const tagName of tags) {
          const trimmedTag = tagName.trim();
          if (!trimmedTag) continue;
          await connection.query('INSERT IGNORE INTO tags (name) VALUES (?)', [trimmedTag]);
          const [tagRows]: any = await connection.query('SELECT id FROM tags WHERE name = ?', [trimmedTag]);
          const tagId = tagRows[0].id;
          await connection.query('INSERT IGNORE INTO contact_tags (contact_id, tag_id) VALUES (?, ?)', [contactId, tagId]);
        }
      }

      await connection.commit();
      connection.release();
      return NextResponse.json({ success: true, contactId });
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  } catch (error: any) {
    console.error('Failed to add contact:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
