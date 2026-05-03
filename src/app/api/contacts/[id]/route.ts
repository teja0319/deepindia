import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!pool) return NextResponse.json({ error: 'DB not connected' }, { status: 500 });

  try {
    const { name, age, phone, tags } = await req.json();
    const connection = await pool.getConnection();

    await connection.beginTransaction();

    try {
      // 1. Update basic info
      await connection.query(
        'UPDATE contacts SET name = ?, age = ?, phone_number = ? WHERE id = ?',
        [name, age, phone, id]
      );

      // 2. Update tags if provided
      if (tags && Array.isArray(tags)) {
        // Remove old tags
        await connection.query('DELETE FROM contact_tags WHERE contact_id = ?', [id]);

        // Add new tags
        for (const tagName of tags) {
          if (!tagName.trim()) continue;
          
          // Ensure tag exists
          await connection.query('INSERT IGNORE INTO tags (name) VALUES (?)', [tagName.trim()]);
          const [tagRows]: any = await connection.query('SELECT id FROM tags WHERE name = ?', [tagName.trim()]);
          const tagId = tagRows[0].id;
          
          // Link tag to contact
          await connection.query('INSERT IGNORE INTO contact_tags (contact_id, tag_id) VALUES (?, ?)', [id, tagId]);
        }
      }

      await connection.commit();
      connection.release();
      return NextResponse.json({ success: true });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error: any) {
    console.error('Update contact failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!pool) return NextResponse.json({ error: 'DB not connected' }, { status: 500 });

  try {
    const connection = await pool.getConnection();
    // contact_tags will be deleted automatically due to ON DELETE CASCADE
    await connection.query('DELETE FROM contacts WHERE id = ?', [id]);
    connection.release();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete contact failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
