import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Placeholder — real product seed is added in the F7 slice.
  // Example shape:
  // await prisma.product.upsert({
  //   where: { slug: 'my-ebook' },
  //   update: {},
  //   create: {
  //     slug: 'my-ebook',
  //     name: 'My E-book',
  //     priceIdr: 100000,
  //     filePath: 'my-ebook.pdf',
  //     fileName: 'my-ebook.pdf',
  //     mimeType: 'application/pdf',
  //   },
  // });
  console.log('Seed: no-op in scaffold slice (real seed added in F7).');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
