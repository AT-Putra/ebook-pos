import { PrismaClient } from '@prisma/client';
import { SEED_PRODUCTS } from './seedData';

const prisma = new PrismaClient();

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
