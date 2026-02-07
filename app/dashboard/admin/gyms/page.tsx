import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildGymSlug } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminGymsPage() {
  const session = await getServerSession(authOptions);
  if (!requireAdmin(session)) {
    redirect("/dashboard");
  }

  const gyms = await prisma.gym.findMany({
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
                <th className="py-2">Featured</th>
                <th className="py-2">Verified</th>
                <th className="py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {gyms.map((gym) => (
                <tr key={gym.id} className="border-t border-white/10">
                  <td className="py-2">
                    <Link
                      href={`/explore/${buildGymSlug(gym.name, gym.id)}`}
                      className="block rounded-md p-1 -ml-1 hover:bg-white/5"
                    >
                      <div className="font-medium text-primary hover:underline">{gym.name}</div>
                      <div className="text-xs text-muted-foreground">{gym.address}</div>
                    </Link>
                  </td>
                  <td className="py-2">
                    <div>{gym.owner?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{gym.owner?.email ?? "—"}</div>
                  </td>
                  <td className="py-2">{gym.verificationStatus}</td>
                  <td className="py-2">{gym.featuredUntil ? new Date(gym.featuredUntil).toLocaleDateString() : "—"}</td>
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
