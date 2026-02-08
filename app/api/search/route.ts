import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireOwner, requireUser } from "@/lib/permissions";
import { buildGymSlug } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const role = (session.user as { role?: string }).role ?? "USER";
  const userId = (session.user as { id?: string }).id;
  const query = q.toLowerCase();

  const results: Array<{ type: string; label: string; subtitle?: string; href: string }> = [];

  if (role === "ADMIN" && requireAdmin(session)) {
    const [gyms, users, memberships] = await Promise.all([
      prisma.gym.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { address: { contains: query, mode: "insensitive" } },
          ],
        },
        take: 6,
        select: { id: true, name: true, address: true },
      }),
      prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        },
        take: 6,
        select: { id: true, name: true, email: true },
      }),
      prisma.membership.findMany({
        where: {
          OR: [
            { user: { name: { contains: query, mode: "insensitive" } } },
            { user: { email: { contains: query, mode: "insensitive" } } },
            { gym: { name: { contains: query, mode: "insensitive" } } },
          ],
        },
        take: 6,
        select: {
          id: true,
          gym: { select: { id: true, name: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    gyms.forEach((gym) =>
      results.push({
        type: "Gym",
        label: gym.name,
        subtitle: gym.address,
        href: `/dashboard/admin/gyms?highlight=${gym.id}`,
      })
    );
    users.forEach((user) =>
      results.push({
        type: "User",
        label: user.name ?? user.email,
        subtitle: user.email ?? "",
        href: `/dashboard/admin/users?highlight=${user.id}`,
      })
    );
    memberships.forEach((membership) =>
      results.push({
        type: "Membership",
        label: membership.gym?.name ?? "Gym",
        subtitle: membership.user?.name ?? membership.user?.email ?? "Member",
        href: `/dashboard/admin/memberships?highlight=${membership.id}`,
      })
    );
  } else if (requireOwner(session)) {
    const gyms = await prisma.gym.findMany({
      where: {
        ownerId: userId,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { address: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 8,
      select: { id: true, name: true, address: true },
    });
    gyms.forEach((gym) =>
      results.push({
        type: "Gym",
        label: gym.name,
        subtitle: gym.address,
        href: `/dashboard/owner/gym?highlight=${gym.id}`,
      })
    );
  } else if (requireUser(session)) {
    const gyms = await prisma.gym.findMany({
      where: {
        verificationStatus: { not: "REJECTED" },
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { address: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 8,
      select: { id: true, name: true, address: true },
    });
    gyms.forEach((gym) =>
      results.push({
        type: "Gym",
        label: gym.name,
        subtitle: gym.address,
        href: `/explore/${buildGymSlug(gym.name, gym.id)}`,
      })
    );
  }

  return NextResponse.json({ results: results.slice(0, 12) });
}
