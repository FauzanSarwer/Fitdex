import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminVerificationQueuePage() {
  const session = await getServerSession(authOptions);
  if (!requireAdmin(session)) {
    redirect("/dashboard");
  }

  const gyms = await prisma.gym.findMany({
    where: { verificationStatus: "PENDING" },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Verification Queue</h1>
        <p className="text-sm text-muted-foreground">
          Pending gym verification reviews.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending gyms ({gyms.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {gyms.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending gyms.</p>
          ) : (
            <div className="space-y-3">
              {gyms.map((gym) => (
                <Link
                  key={gym.id}
                  href={`/dashboard/admin/verification/${gym.id}`}
                  className="block rounded-lg border border-white/10 p-4 transition hover:bg-white/5"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{gym.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {gym.address}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Owner: {gym.owner?.name ?? "Unknown"} · {gym.owner?.email ?? "No email"}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Updated {new Date(gym.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  {gym.verificationNotes && (
                    <div className="mt-2 text-xs text-amber-300">
                      Notes: {gym.verificationNotes}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
