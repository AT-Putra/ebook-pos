import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { deleteUploadedFile } from '@/lib/files';

type Props = { params: Promise<{ id: string; attId: string }> };

/** Removes one attachment from a program and unlinks its file. */
export async function DELETE(req: NextRequest, { params }: Props) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const { id, attId } = await params;

  const attachment = await db.productAttachment.findUnique({ where: { id: attId } });
  if (!attachment || attachment.productId !== id) {
    return NextResponse.json({ error: 'Lampiran tidak ditemukan.' }, { status: 404 });
  }

  await db.productAttachment.delete({ where: { id: attId } });
  await deleteUploadedFile(attachment.filePath);

  return NextResponse.json({ ok: true });
}
