// Exits 0 when the database already holds items, 1 when it is empty.
// The entrypoint uses it to decide whether to seed.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const count = await prisma.item.count();
await prisma.$disconnect();

process.exit(count > 0 ? 0 : 1);
