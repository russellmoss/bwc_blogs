import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Seed admin user
  const email = (process.env.ADMIN_EMAIL || "russell@bhutanwine.com").toLowerCase();
  const name = process.env.ADMIN_NAME || "Russell Moss";
  const password = process.env.ADMIN_PASSWORD || "changeme123";

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role: "admin", isActive: true },
    create: { email, name, passwordHash, role: "admin", isActive: true },
  });

  console.log(`Admin user seeded: ${admin.email} (id: ${admin.id})`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
