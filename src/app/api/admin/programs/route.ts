import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { saveUploadedPdf, deleteUploadedFile, UploadValidationError, type UploadFile } from '@/lib/files';
import { parseSalesStart, parseSalesEnd } from '@/lib/programs';
import { serializeProgram } from '@/lib/program-serialize';

const fieldsSchema = z.object({
  name: z.string().min(1).max(200),
  programName: z.string().max(200).optional(),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, 'Slug hanya huruf kecil, angka, dan tanda minus.'),
  priceIdr: z.coerce.number().int().min(0),
  description: z.string().max(2000).optional(),
  salesStartAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  salesEndAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** Reads a form text field, treating '' as undefined. */
function field(form: FormData, key: string): string | undefined {
  const v = form.get(key);
  if (typeof v !== 'string' || v.trim() === '') return undefined;
  return v;
}

function isUploadFile(v: FormDataEntryValue | null): v is File & UploadFile {
  return typeof v === 'object' && v !== null && 'arrayBuffer' in v && typeof (v as File).size === 'number';
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const programs = await db.product.findMany({
    orderBy: { createdAt: 'desc' },
    include: { attachments: true, _count: { select: { orders: true } } },
  });
  return NextResponse.json({ programs: programs.map(serializeProgram) });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
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
    salesStartAt: field(form, 'salesStartAt'),
    salesEndAt: field(form, 'salesEndAt'),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validasi gagal.', issues: parsed.error.issues.map(i => i.message) },
      { status: 422 },
    );
  }
  const d = parsed.data;

  if (d.salesStartAt && d.salesEndAt && d.salesStartAt > d.salesEndAt) {
    return NextResponse.json({ error: 'Tanggal mulai harus sebelum tanggal selesai.' }, { status: 422 });
  }

  const ebook = form.get('file');
  if (!isUploadFile(ebook)) {
    return NextResponse.json({ error: 'File e-book (PDF) wajib diunggah.' }, { status: 422 });
  }

  const attachmentFiles = form.getAll('attachments').filter(isUploadFile);

  // Save files first (outside the DB write) so a bad upload fails before any row is created.
  let saved;
  try {
    const ebookSaved = await saveUploadedPdf(ebook);
    const attachmentsSaved = [];
    for (const a of attachmentFiles) attachmentsSaved.push(await saveUploadedPdf(a));
    saved = { ebook: ebookSaved, attachments: attachmentsSaved };
  } catch (err) {
    if (err instanceof UploadValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }

  try {
    const program = await db.product.create({
      data: {
        slug: d.slug,
        name: d.name,
        programName: d.programName ?? null,
        description: d.description ?? null,
        priceIdr: d.priceIdr,
        filePath: saved.ebook.filePath,
        fileName: saved.ebook.fileName,
        mimeType: saved.ebook.mimeType,
        salesStartAt: parseSalesStart(d.salesStartAt),
        salesEndAt: parseSalesEnd(d.salesEndAt),
        attachments: {
          create: saved.attachments.map((a, i) => ({
            filePath: a.filePath,
            fileName: a.fileName,
            mimeType: a.mimeType,
            sizeBytes: a.sizeBytes,
            sortOrder: i + 1,
          })),
        },
      },
      include: { attachments: true, _count: { select: { orders: true } } },
    });
    return NextResponse.json({ program: serializeProgram(program) }, { status: 201 });
  } catch (err) {
    // The DB write failed after the files were saved — don't leak orphaned PDFs.
    await deleteUploadedFile(saved.ebook.filePath);
    for (const a of saved.attachments) await deleteUploadedFile(a.filePath);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: 'Slug sudah dipakai program lain.' }, { status: 409 });
    }
    throw err;
  }
}
