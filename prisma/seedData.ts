// Seed data — imported by both prisma/seed.ts and unit tests.
// filePath is relative to EBOOK_FILES_DIR (never an absolute path).

export const SEED_PRODUCTS = [
  {
    slug: 'lose-weight-challenge-1st-edition',
    name: 'Tantangan Turun Berat Badan 10KG dalam 90 Hari',
    description: null,
    priceIdr: 75000,
    filePath: 'lose-weight-challenge-1st-edition.pdf',
    fileName: 'Tantangan Turun Berat Badan Edisi Pertama',
    mimeType: 'application/pdf',
    isActive: true,
  },
] as const;

export type SeedProduct = (typeof SEED_PRODUCTS)[number];
