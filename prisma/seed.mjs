import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SEED_PRODUCTS = [
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
];

async function main() {
  for (const product of SEED_PRODUCTS) {
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        name: product.name,
        description: product.description,
        priceIdr: product.priceIdr,
        filePath: product.filePath,
        fileName: product.fileName,
        mimeType: product.mimeType,
        isActive: product.isActive,
      },
      create: product,
    });
    console.log(`Seeded product: ${product.slug}`);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
