import { NextResponse } from 'next/server';
import { fetchTemplates } from '@/lib/whatsapp';

export async function GET() {
  try {
    const templates = await fetchTemplates();
    // Filter for APPROVED templates
    const approvedTemplates = templates.filter((t: any) => t.status === 'APPROVED');
    return NextResponse.json(approvedTemplates);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
