import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/permissions";

const EXPIRING_SOON_DAYS = 7;
const EXPIRY_THRESHOLDS = [7, 5, 3, 2, 1];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!requireUser(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;

  const now = new Date();
  const upcoming = new Date();
  upcoming.setDate(upcoming.getDate() + EXPIRING_SOON_DAYS);

  const expiringMemberships = await prisma.membership.findMany({
    where: {
      userId: uid,
      active: true,
      expiresAt: { gte: now, lte: upcoming },
    },
    include: { gym: true },
  });

  const dayMs = 1000 * 60 * 60 * 24;
  const expiryNotifications = expiringMemberships
    .map((membership) => {
      const daysLeft = Math.ceil((membership.expiresAt.getTime() - now.getTime()) / dayMs);
      if (!EXPIRY_THRESHOLDS.includes(daysLeft)) return null;
      const title =
        daysLeft === 1
          ? "Membership expires tomorrow"
          : daysLeft === 2
            ? "Membership expires in 2 days"
            : `Membership expires in ${daysLeft} days`;
      const body =
        daysLeft === 1
          ? `Your ${membership.gym.name} membership expires tomorrow. Renew now to keep your savings.`
          : `Your ${membership.gym.name} membership expires in ${daysLeft} days. Renew early to save more.`;
      return {
        membership,
        daysLeft,
        title,
        body,
      };
    })
    .filter(Boolean) as Array<{
      membership: typeof expiringMemberships[number];
      daysLeft: number;
      title: string;
      body: string;
    }>;

  await Promise.all(
    expiryNotifications.map((item) =>
      prisma.notification.upsert({
        where: {
          userId_type_entityId: {
            userId: uid,
            type: "membership_expiring",
            entityId: `${item.membership.id}:${item.daysLeft}`,
          },
        },
        update: {},
        create: {
          userId: uid,
          type: "membership_expiring",
          entityId: `${item.membership.id}:${item.daysLeft}`,
          title: item.title,
          body: item.body,
        },
      })
    )
  );

  const notifications = await prisma.notification.findMany({
    where: { userId: uid, read: false },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ notifications });
}
