/**
 * Seed script.
 *
 * Provisions the admin account, two sellers, two buyers and fifteen approved
 * listings across all six categories.
 *
 * This is load-bearing from Stage A onward. Registration, seller submission and
 * admin approval do not exist until Stage B, so the seed is what puts stock in
 * the marketplace. If `prisma migrate deploy` followed by `prisma db seed` stops
 * producing a browsable catalogue, the slice is not done. See ADR-0001.
 *
 * Idempotent: safe to run repeatedly. It clears the tables it owns first.
 */

import { PrismaClient, type Category, type Condition } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

/** Low enough to keep seeding quick; production hashing uses the default cost. */
const SEED_BCRYPT_ROUNDS = 10;

/** Documented in the README so an examiner can sign in as any role. */
const DEMO_PASSWORD = "declutter";

type SeedItem = {
  title: string;
  description: string;
  category: Category;
  condition: Condition;
  /** What the seller receives. Stored independently of listedPrice. */
  payout: string;
  /** What the buyer pays. The difference is the platform margin. */
  price: string;
  /** Image basenames under public/seed, in display order. */
  images: string[];
  seller: "seller1" | "seller2";
};

const ITEMS: SeedItem[] = [
  {
    title: "Dell Latitude 7420 laptop, 16GB RAM",
    description:
      "Business laptop, used daily for two years and recently serviced. Battery holds about four hours. Small scuff on the lid, screen and keyboard are unmarked. Comes with the original charger.",
    category: "electronics",
    condition: "good",
    payout: "185000.00",
    price: "215000.00",
    images: ["laptop-1.svg", "laptop-2.svg", "laptop-3.svg"],
    seller: "seller1",
  },
  {
    title: "Sony WH-1000XM4 wireless headphones",
    description:
      "Noise cancelling over-ear headphones with the carrying case. Ear cushions replaced last year. Bluetooth and the 3.5mm cable both work.",
    category: "electronics",
    condition: "like_new",
    payout: "78000.00",
    price: "95000.00",
    images: ["headphones-1.svg", "headphones-2.svg"],
    seller: "seller2",
  },
  {
    title: "24 inch LG IPS monitor",
    description:
      "1080p IPS panel with HDMI and DisplayPort. No dead pixels. Stand included, and the VESA mount holes are unused.",
    category: "electronics",
    condition: "good",
    payout: "52000.00",
    price: "64000.00",
    images: ["monitor-1.svg", "monitor-2.svg", "monitor-3.svg"],
    seller: "seller1",
  },
  {
    title: "Upholstered armchair, grey fabric",
    description:
      "Comfortable reading chair with solid wooden legs. Fabric is clean with slight fading on the left arm where it sat near a window. No tears, no pet damage.",
    category: "furniture",
    condition: "good",
    payout: "62000.00",
    price: "78000.00",
    images: ["armchair-1.svg", "armchair-2.svg", "armchair-3.svg"],
    seller: "seller2",
  },
  {
    title: "Writing desk, 120cm oak veneer",
    description:
      "Simple desk with a single drawer. A few ring marks on the surface from mugs, shown in the photographs. Structurally solid, no wobble.",
    category: "furniture",
    condition: "fair",
    payout: "38000.00",
    price: "49000.00",
    images: ["desk-1.svg", "desk-2.svg"],
    seller: "seller1",
  },
  {
    title: "Five shelf bookcase, white",
    description:
      "Flat-pack bookcase, disassembled and ready to transport. All fixings bagged and included. Two shelves have minor bowing from heavy books.",
    category: "furniture",
    condition: "fair",
    payout: "22000.00",
    price: "29000.00",
    images: ["bookshelf-1.svg", "bookshelf-2.svg"],
    seller: "seller2",
  },
  {
    title: "Nutribullet 600 series blender",
    description:
      "Blender with two cups and both lids. Blade is sharp and the motor runs quietly. Cups have light scratching from the dishwasher.",
    category: "appliances",
    condition: "good",
    payout: "24000.00",
    price: "31000.00",
    images: ["blender-1.svg", "blender-2.svg", "blender-3.svg"],
    seller: "seller1",
  },
  {
    title: "Samsung 20L solo microwave",
    description:
      "Compact microwave, 800W. Interior is clean, turntable and roller ring both present. The door seal is intact.",
    category: "appliances",
    condition: "good",
    payout: "34000.00",
    price: "43000.00",
    images: ["microwave-1.svg", "microwave-2.svg"],
    seller: "seller2",
  },
  {
    title: "Wool blend overcoat, size M",
    description:
      "Charcoal overcoat, worn one winter. Dry cleaned and stored in a garment bag. All buttons present, lining unmarked.",
    category: "fashion",
    condition: "like_new",
    payout: "41000.00",
    price: "52000.00",
    images: ["jacket-1.svg", "jacket-2.svg", "jacket-3.svg"],
    seller: "seller1",
  },
  {
    title: "Leather Chelsea boots, size 43",
    description:
      "Brown leather boots with elastic side panels. Soles have wear but plenty of tread left. Creasing across the toe, as expected.",
    category: "fashion",
    condition: "fair",
    payout: "26000.00",
    price: "34000.00",
    images: ["boots-1.svg", "boots-2.svg"],
    seller: "seller2",
  },
  {
    title: "Canvas weekend bag with leather trim",
    description:
      "Holdall with a detachable shoulder strap. One internal zip pocket. Small ink mark inside, shown in the last photograph.",
    category: "fashion",
    condition: "good",
    payout: "18000.00",
    price: "24000.00",
    images: ["bag-1.svg", "bag-2.svg", "bag-3.svg"],
    seller: "seller1",
  },
  {
    title: "Chinua Achebe collection, five novels",
    description:
      "Paperback set including Things Fall Apart and No Longer at Ease. Spines are creased from reading, pages are clean and unmarked.",
    category: "books",
    condition: "good",
    payout: "7000.00",
    price: "9500.00",
    images: ["novels-1.svg", "novels-2.svg"],
    seller: "seller2",
  },
  {
    title: "Introduction to Algorithms, third edition",
    description:
      "Hardback reference textbook. Some highlighting in the first four chapters, the rest is clean. Binding is tight.",
    category: "books",
    condition: "fair",
    payout: "12000.00",
    price: "16000.00",
    images: ["textbook-1.svg", "textbook-2.svg", "textbook-3.svg"],
    seller: "seller1",
  },
  {
    title: "Hybrid bicycle, 54cm frame",
    description:
      "Aluminium frame with 21 gears. Recently serviced with new brake pads and cables. Tyres hold pressure. Light surface rust on the chain.",
    category: "other",
    condition: "good",
    payout: "95000.00",
    price: "118000.00",
    images: ["bicycle-1.svg", "bicycle-2.svg", "bicycle-3.svg"],
    seller: "seller2",
  },
  {
    title: "Yamaha F310 acoustic guitar",
    description:
      "Full size dreadnought with a soft case. Recently restrung. A few small dings on the body, none affecting the sound. Neck is straight.",
    category: "other",
    condition: "good",
    payout: "58000.00",
    price: "72000.00",
    images: ["guitar-1.svg", "guitar-2.svg"],
    seller: "seller1",
  },
];

async function main() {
  console.log("Seeding Declutter...");

  // Order matters: children before parents.
  await prisma.payout.deleteMany();
  await prisma.message.deleteMany();
  await prisma.thread.deleteMany();
  await prisma.order.deleteMany();
  await prisma.itemImage.deleteMany();
  await prisma.item.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await hash(DEMO_PASSWORD, SEED_BCRYPT_ROUNDS);

  // The admin is provisioned here and is not self-registerable (AUTH-5).
  const admin = await prisma.user.create({
    data: {
      role: "admin",
      email: "admin@declutter.test",
      phone: "+2348000000001",
      phoneVerified: true,
      passwordHash,
      firstName: "Ada",
    },
  });

  const sellers = {
    seller1: await prisma.user.create({
      data: {
        role: "seller",
        email: "seller1@declutter.test",
        phone: "+2348000000002",
        phoneVerified: true,
        passwordHash,
        firstName: "Tunde",
      },
    }),
    seller2: await prisma.user.create({
      data: {
        role: "seller",
        email: "seller2@declutter.test",
        phone: "+2348000000003",
        phoneVerified: true,
        passwordHash,
        firstName: "Ngozi",
      },
    }),
  };

  // Stage A has no authentication, so checkout acts as the first buyer. Stage B
  // replaces that with the session user; see `src/lib/acting-buyer.ts`.
  await prisma.user.create({
    data: {
      role: "buyer",
      email: "buyer1@declutter.test",
      phone: "+2348000000004",
      phoneVerified: true,
      passwordHash,
      firstName: "Chidi",
    },
  });
  await prisma.user.create({
    data: {
      role: "buyer",
      email: "buyer2@declutter.test",
      phone: "+2348000000005",
      phoneVerified: true,
      passwordHash,
      firstName: "Amaka",
    },
  });

  for (const item of ITEMS) {
    await prisma.item.create({
      data: {
        sellerId: sellers[item.seller].id,
        title: item.title,
        description: item.description,
        category: item.category,
        condition: item.condition,
        sellerPayoutAmount: item.payout,
        listedPrice: item.price,
        // Already through review, so the catalogue has stock before the admin
        // approval flow exists.
        status: "listed",
        approvedById: admin.id,
        images: {
          create: item.images.map((file, index) => ({
            url: `/seed/${file}`,
            // Lowest sortOrder is the card thumbnail.
            sortOrder: index,
          })),
        },
      },
    });
  }

  const counts = await prisma.item.groupBy({
    by: ["category"],
    _count: true,
    orderBy: { category: "asc" },
  });

  console.log(`  ${await prisma.user.count()} users (1 admin, 2 sellers, 2 buyers)`);
  console.log(`  ${await prisma.item.count()} items, all listed:`);
  for (const row of counts) {
    console.log(`    ${row.category.padEnd(12)} ${row._count}`);
  }
  console.log(`  ${await prisma.itemImage.count()} images`);
  console.log(`\n  Demo password for every account: ${DEMO_PASSWORD}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
