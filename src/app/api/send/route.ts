import { NextResponse } from 'next/server';
import { sendMessage } from '@/lib/whatsapp';
import pool from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { to, templateName, languageCode, components, campaignName, contactName, age, tags } = body;
    
    console.log(`Sending to ${to} using template ${templateName} (Campaign: ${campaignName})`);

    let status: 'success' | 'failed' = 'success';
    let errorMessage = null;
    let messageId = null;

    try {
      const result = await sendMessage(to, templateName, languageCode, components);
      messageId = result.messages[0].id;
    } catch (error: any) {
      status = 'failed';
      errorMessage = error.response?.data?.error?.message || error.message;
    }

    // Log to database
    if (pool) {
      try {
        const connection = await pool.getConnection();
        
        // Find or create campaign
        let campaignId = null;
        if (campaignName) {
          const [rows]: any = await connection.query('SELECT id FROM campaigns WHERE name = ?', [campaignName]);
          if (rows.length > 0) {
            campaignId = rows[0].id;
          } else {
            const [result]: any = await connection.query(
              'INSERT INTO campaigns (name, template_name) VALUES (?, ?)',
              [campaignName, templateName]
            );
            campaignId = result.insertId;
          }
        }

        // 2. Ensure/Find Contact
        const [contactRes]: any = await connection.query(
          'INSERT INTO contacts (phone_number, name, age) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = COALESCE(?, name), age = COALESCE(?, age)',
          [to, contactName, age, contactName, age]
        );
        
        // Get contact ID
        const [contactRows]: any = await connection.query('SELECT id FROM contacts WHERE phone_number = ?', [to]);
        const contactId = contactRows[0].id;

        // Process Tags
        if (tags && Array.isArray(tags)) {
          for (const tagName of tags) {
            await connection.query('INSERT IGNORE INTO tags (name) VALUES (?)', [tagName]);
            const [tagRows]: any = await connection.query('SELECT id FROM tags WHERE name = ?', [tagName]);
            const tagId = tagRows[0].id;
            await connection.query('INSERT IGNORE INTO contact_tags (contact_id, tag_id) VALUES (?, ?)', [contactId, tagId]);
          }
        }

        // 3. Insert log
        await connection.query(
          'INSERT INTO message_logs (campaign_id, phone_number, status, error_message, message_id) VALUES (?, ?, ?, ?, ?)',
          [campaignId, to, status, errorMessage, messageId]
        );
        
        // 4. Update campaign stats
        if (campaignId) {
          await connection.query(
            'UPDATE campaigns SET total_recipients = total_recipients + 1, success_count = success_count + ?, fail_count = fail_count + ? WHERE id = ?',
            [status === 'success' ? 1 : 0, status === 'failed' ? 1 : 0, campaignId]
          );
        }
        
        connection.release();
      } catch (dbError) {
        console.error('Database logging failed:', dbError);
      }
    }

    if (status === 'failed') {
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    return NextResponse.json({ success: true, messageId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
