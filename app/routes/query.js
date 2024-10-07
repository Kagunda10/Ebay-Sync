async function main() {
  const { PrismaClient } = await import('@prisma/client');
  const db = new PrismaClient();

  const allProducts = await db.product.findMany();
  console.log(allProducts);

  await db.$disconnect();
}

main().catch(console.error);