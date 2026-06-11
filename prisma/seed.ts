import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const shopName = process.env.SEED_SHOP_NAME || "My Auto Repair";
  const email = (process.env.SEED_OWNER_EMAIL || "owner@example.com").toLowerCase();
  const password = process.env.SEED_OWNER_PASSWORD || "changeme123";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Seed skipped — ${email} already exists.`);
    return;
  }

  const shop = await prisma.shop.create({
    data: {
      name: shopName,
      // sensible small-shop defaults — all editable in Settings
      taxRate: 7.25,
      laborRate: 12000,
      partsMarkupPct: 40,
      suppliesPct: 5,
      suppliesCapCents: 3500,
    },
  });
  await prisma.user.create({
    data: {
      shopId: shop.id,
      name: process.env.SEED_OWNER_NAME || "Owner",
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: "OWNER",
    },
  });
  // One example canned job to show the pattern
  await prisma.cannedJob.create({
    data: {
      shopId: shop.id,
      name: "Oil Change — Full Synthetic",
      items: {
        create: [
          { type: "LABOR", description: "Oil & filter change, top off fluids, courtesy inspection", qty: 0.5, unitPriceCents: 12000, sort: 0 },
          { type: "PART", description: "Full synthetic oil (5 qt)", qty: 1, unitPriceCents: 3500, costCents: 2400, sort: 1 },
          { type: "PART", description: "Oil filter", partNumber: "FILTER", qty: 1, unitPriceCents: 900, costCents: 500, sort: 2 },
        ],
      },
    },
  });

  console.log(`Seeded shop "${shopName}" with owner ${email}. CHANGE THE PASSWORD after first login.`);
}

main().finally(() => prisma.$disconnect());
