import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: Request) {
  if (!pool) return NextResponse.json({ error: 'DB not connected' }, { status: 500 });

  try {
    const { contacts, tags } = await req.json();
    const connection = await pool.getConnection();

    await connection.beginTransaction();

    try {
      // 1. Process Tags
      const tagIds: number[] = [];
      if (tags && tags.length > 0) {
        for (const tagName of tags) {
          await connection.query('INSERT IGNORE INTO tags (name) VALUES (?)', [tagName]);
          const [tagRows]: any = await connection.query('SELECT id FROM tags WHERE name = ?', [tagName]);
          tagIds.push(tagRows[0].id);
        }
      }

      // 2. Process Contacts
      for (const contact of contacts) {
        const { name, phone, age } = contact;
        if (!phone) continue;

        await connection.query(
          'INSERT INTO contacts (phone_number, name, age) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = COALESCE(?, name), age = COALESCE(?, age)',
          [phone, name, age, name, age]
        );

        const [contactRows]: any = await connection.query('SELECT id FROM contacts WHERE phone_number = ?', [phone]);
        const contactId = contactRows[0].id;

        // 3. Link Tags
        for (const tagId of tagIds) {
          await connection.query('INSERT IGNORE INTO contact_tags (contact_id, tag_id) VALUES (?, ?)', [contactId, tagId]);
        }
      }

      await connection.commit();
      connection.release();
      return NextResponse.json({ success: true, count: contacts.length });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error: any) {
    console.error('Import failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
