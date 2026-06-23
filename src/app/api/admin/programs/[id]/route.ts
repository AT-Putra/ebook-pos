import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { saveUploadedPdf, deleteUploadedFile, UploadValidationError, type UploadFile } from '@/lib/files';
import { parseSalesStart, parseSalesEnd } from '@/lib/programs';
import { serializeProgram } from '@/lib/program-serialize';

type Props = { params: Promise<{ id: string }> };

const fieldsSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  programName: z.string().max(200).optional(),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, 'Slug hanya huruf kecil, angka, dan tanda minus.').optional(),
  priceIdr: z.coerce.number().int().min(0).optional(),
  description: z.string().max(2000).optional(),
  linkMessageTemplate: z.string().max(2000).optional(),
  salesStartAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  salesEndAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

function field(form: FormData, key: string): string | undefined {
  const v = form.get(key);
  if (typeof v !== 'string' || v.trim() === '') return undefined;
  return v;
}

function isUploadFile(v: FormDataEntryValue | null): v is File & UploadFile {
  return typeof v === 'object' && v !== null && 'arrayBuffer' in v && typeof (v as File).size === 'number';
}

export async function PATCH(req: NextRequest, { params }: Props) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const { id } = await params;

  const existing = await db.product.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Program tidak ditemukan.' }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Request harus multipart/form-data.' }, { status: 400 });
  }

  const parsed = fieldsSchema.safeParse({
    name: field(form, 'name'),
    programName: field(form, 'programName'),
    slug: field(form, 'slug'),
    priceIdr: field(form, 'priceIdr'),
    description: field(form, 'description'),
    linkMessageTemplate: field(form, 'linkMessageTemplate'),
    salesStartAt: field(form, 'salesStartAt'),
    salesEndAt: field(form, 'salesEndAt'),
    isActive: field(form, 'isActive'),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validasi gagal.', issues: parsed.error.issues.map(i => i.message) },
      { status: 422 },
    );
  }
  const d = parsed.data;

  // Build the update payload from whatever fields were provided.
  const data: Prisma.ProductUpdateInput = {};
  if (d.name !== undefined) data.name = d.name;
  if (d.programName !== undefined) data.programName = d.programName;
  if (d.slug !== undefined) data.slug = d.slug;
  if (d.priceIdr !== undefined) data.priceIdr = d.priceIdr;
  if (d.description !== undefined) data.description = d.description;
  if (d.linkMessageTemplate !== undefined) data.linkMessageTemplate = d.linkMessageTemplate;
  if (d.salesStartAt !== undefined) data.salesStartAt = parseSalesStart(d.salesStartAt);
  if (d.salesEndAt !== undefined) data.salesEndAt = parseSalesEnd(d.salesEndAt);
  if (d.isActive !== undefined) data.isActive = d.isActive === 'true';

  // Optional e-book replacement.
  let oldEbookPath: string | null = null;
  const newEbook = form.get('file');
  if (isUploadFile(newEbook)) {
    try {
      const saved = await saveUploadedPdf(newEbook);
      data.filePath = saved.filePath;
      data.fileName = saved.fileName;
      data.mimeType = saved.mimeType;
      oldEbookPath = existing.filePath;
    } catch (err) {
      if (err instanceof UploadValidationError) {
        return NextResponse.json({ error: err.message }, { status: 422 });
      }
      throw err;
    }
  }

  // Optional new attachments.
  const attachmentFiles = form.getAll('attachments').filter(isUploadFile);
  let savedAttachments;
  try {
    savedAttachments = [];
    for (const a of attachmentFiles) savedAttachments.push(await saveUploadedPdf(a));
  } catch (err) {
    if (err instanceof UploadValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }

  if (savedAttachments.length > 0) {
    const maxOrder = await db.productAttachment.aggregate({
      where: { productId: id },
      _max: { sortOrder: true },
    });
    let order = maxOrder._max.sortOrder ?? 0;
    data.attachments = {
      create: savedAttachments.map(a => ({
        filePath: a.filePath,
        fileName: a.fileName,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        sortOrder: ++order,
      })),
    };
  }

  try {
    const program = await db.product.update({
      where: { id },
      data,
      include: { attachments: true, _count: { select: { orders: true } } },
    });
    // Best-effort unlink the replaced e-book only after the row points at the new one.
    if (oldEbookPath) await deleteUploadedFile(oldEbookPath);
    return NextResponse.json({ program: serializeProgram(program) });
  } catch (err) {
    // The update failed after new files were saved — drop the orphans (keep the old e-book,
    // which is still the referenced one because the row wasn't repointed).
    if (data.filePath) await deleteUploadedFile(data.filePath as string);
    for (const a of savedAttachments) await deleteUploadedFile(a.filePath);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: 'Slug sudah dipakai program lain.' }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(req: NextRequest, { params }: Props) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const { id } = await params;

  const product = await db.product.findUnique({
    where: { id },
    include: { attachments: true, _count: { select: { orders: true } } },
  });
  if (!product) {
    return NextResponse.json({ error: 'Program tidak ditemukan.' }, { status: 404 });
  }
  if (product._count.orders > 0) {
    return NextResponse.json(
      { error: 'Program punya order — nonaktifkan saja agar riwayat tetap utuh.' },
      { status: 409 },
    );
  }

  await db.product.delete({ where: { id } });
  // Best-effort unlink the e-book + attachment files.
  await deleteUploadedFile(product.filePath);
  for (const a of product.attachments) await deleteUploadedFile(a.filePath);

  return NextResponse.json({ ok: true });
}
