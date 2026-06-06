import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { saveUploadedPdf, UploadValidationError, type UploadFile } from '@/lib/files';
import { serializeProgram } from '@/lib/program-serialize';

type Props = { params: Promise<{ id: string }> };

function isUploadFile(v: FormDataEntryValue | null): v is File & UploadFile {
  return typeof v === 'object' && v !== null && 'arrayBuffer' in v && typeof (v as File).size === 'number';
}

/** Adds one or more attachment PDFs to an existing program. */
export async function POST(req: NextRequest, { params }: Props) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const { id } = await params;

  const product = await db.product.findUnique({ where: { id } });
  if (!product) {
    return NextResponse.json({ error: 'Program tidak ditemukan.' }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Request harus multipart/form-data.' }, { status: 400 });
  }

  const files = form.getAll('attachments').filter(isUploadFile);
  if (files.length === 0) {
    return NextResponse.json({ error: 'Tidak ada file lampiran.' }, { status: 422 });
  }

  let saved;
  try {
    saved = [];
    for (const f of files) saved.push(await saveUploadedPdf(f));
  } catch (err) {
    if (err instanceof UploadValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }

  const maxOrder = await db.productAttachment.aggregate({
    where: { productId: id },
    _max: { sortOrder: true },
  });
  let order = maxOrder._max.sortOrder ?? 0;

  await db.productAttachment.createMany({
    data: saved.map(a => ({
      productId: id,
      filePath: a.filePath,
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      sortOrder: ++order,
    })),
  });

  const updated = await db.product.findUniqueOrThrow({
    where: { id },
    include: { attachments: true, _count: { select: { orders: true } } },
  });
  return NextResponse.json({ program: serializeProgram(updated) }, { status: 201 });
}
