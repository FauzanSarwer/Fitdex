import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildGymSlug } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminGymsPage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!requireAdmin(session)) {
    redirect("/dashboard");
  }
  const tab = searchParams?.tab ?? "all";
  const now = new Date();
  const paidOwners = await prisma.ownerSubscription.findMany({
    where: { status: "ACTIVE", expiresAt: { gt: now } },
    select: { ownerId: true },
    distinct: ["ownerId"],
  });
  const paidOwnerIds = paidOwners.map((o) => o.ownerId);

  const where =
    tab === "paid"
      ? { ownerId: { in: paidOwnerIds } }
      : tab === "free"
        ? paidOwnerIds.length > 0
          ? { ownerId: { notIn: paidOwnerIds } }
          : {}
        : undefined;

  const gyms = await prisma.gym.findMany({
    where,
    take: 100,
    orderBy: { createdAt: "desc" },
    include: { owner: { select: { name: true, email: true } } },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Gyms</h1>
        <p className="text-sm text-muted-foreground">All gyms, verification status, and owner info.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/dashboard/admin/gyms?tab=all"
          className={`rounded-full border px-3 py-1 text-xs ${tab === "all" ? "border-primary/50 bg-primary/10 text-primary" : "border-white/10 text-muted-foreground"}`}
        >
          All
        </Link>
        <Link
          href="/dashboard/admin/gyms?tab=paid"
          className={`rounded-full border px-3 py-1 text-xs ${tab === "paid" ? "border-primary/50 bg-primary/10 text-primary" : "border-white/10 text-muted-foreground"}`}
        >
          Paid gyms
        </Link>
        <Link
          href="/dashboard/admin/gyms?tab=free"
          className={`rounded-full border px-3 py-1 text-xs ${tab === "free" ? "border-primary/50 bg-primary/10 text-primary" : "border-white/10 text-muted-foreground"}`}
        >
          Free gyms
        </Link>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Latest gyms ({gyms.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2">Gym</th>
                <th className="py-2">Owner</th>
                <th className="py-2">Status</th>
                <th className="py-2">Tier</th>
                <th className="py-2">Consent</th>
                <th className="py-2">Suspended</th>
                <th className="py-2">Featured</th>
                <th className="py-2">Verified</th>
                <th className="py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {gyms.map((gym) => (
                <tr key={gym.id} className="border-t border-white/10">
                  <td className="py-2">
                    <div className="space-y-1">
                      <Link
                        href={`/explore/${buildGymSlug(gym.name, gym.id)}`}
                        className="block rounded-md p-1 -ml-1 hover:bg-white/5"
                      >
                        <div className="font-medium text-primary hover:underline">{gym.name}</div>
                        <div className="text-xs text-muted-foreground">{gym.address}</div>
                      </Link>
                      <Link href={`/dashboard/admin/gyms/${gym.id}`} className="text-xs text-primary hover:underline">
                        Edit listing
                      </Link>
                    </div>
                  </td>
                  <td className="py-2">
                    <div>{gym.owner?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{gym.owner?.email ?? "—"}</div>
                  </td>
                  <td className="py-2">{gym.verificationStatus}</td>
                  <td className="py-2">{gym.gymTier}</td>
                  <td className="py-2">{gym.ownerConsentAt ? "Yes" : "No"}</td>
                  <td className="py-2">{gym.suspendedAt ? "Yes" : "No"}</td>
                  {(() => {
                    const featuredDate = gym.featuredEndAt ?? gym.featuredUntil;
                    return (
                      <td className="py-2">
                        {featuredDate ? new Date(featuredDate).toLocaleDateString() : "—"}
                      </td>
                    );
                  })()}
                  <td className="py-2">{gym.verifiedUntil ? new Date(gym.verifiedUntil).toLocaleDateString() : "—"}</td>
                  <td className="py-2">{new Date(gym.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
