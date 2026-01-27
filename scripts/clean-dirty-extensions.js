/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await prisma.globalExtension.deleteMany({
      where: {
        OR: [
          { name: { startsWith: '__MSG_' } },
          { description: { startsWith: '__MSG_' } },
        ],
      },
    });
    console.log(`Deleted ${result.count} dirty GlobalExtension rows`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
