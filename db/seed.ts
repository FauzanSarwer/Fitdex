import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DELHI_GYMS = [
  {
    name: "Gold's Gym – Greater Kailash",
    address: "M-12, Greater Kailash Part 1, New Delhi 110048",
    latitude: 28.5484,
    longitude: 77.2328,
    monthlyPrice: 29900, // ₹299 in paise → 29900
    yearlyPrice: 299000, // ₹2990
    partnerDiscountPercent: 15,
    yearlyDiscountPercent: 20,
    welcomeDiscountPercent: 10,
    maxDiscountCapPercent: 40,
  },
  {
    name: "Anytime Fitness – Saket",
    address: "DLF Avenue, Saket, New Delhi 110017",
    latitude: 28.5244,
    longitude: 77.1855,
    monthlyPrice: 34900,
    yearlyPrice: 349000,
    partnerDiscountPercent: 10,
    yearlyDiscountPercent: 18,
    welcomeDiscountPercent: 10,
    maxDiscountCapPercent: 40,
  },
  {
    name: "Cult.fit – Defence Colony",
    address: "Defence Colony, New Delhi 110024",
    latitude: 28.5692,
    longitude: 77.2291,
    monthlyPrice: 19900,
    yearlyPrice: 199000,
    partnerDiscountPercent: 12,
    yearlyDiscountPercent: 15,
    welcomeDiscountPercent: 10,
    maxDiscountCapPercent: 40,
  },
];

async function main() {
  const gymCount = await prisma.gym.count();
  if (gymCount > 0) {
    console.log("Gyms already seeded, skipping.");
    return;
  }

  const adminEmail = "admin@gymduo.com";
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: adminEmail,
        name: "GYMDUO Admin",
        role: "ADMIN",
      },
    });
  }

  for (const g of DELHI_GYMS) {
    await prisma.gym.create({
      data: {
        ...g,
        ownerId: admin.id,
      },
    });
  }
  console.log("Seeded 3 Delhi gyms.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
