import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VerificationActions } from "./verification-actions";

export const dynamic = "force-dynamic";

export default async function AdminVerificationDetailPage({
  params,
}: {
  params: { gymId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!requireAdmin(session)) {
    redirect("/dashboard");
  }

  const gym = await prisma.gym.findUnique({
    where: { id: params.gymId },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!gym) {
    notFound();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/dashboard/admin/verification" className="text-xs text-muted-foreground">
            ← Back to queue
          </Link>
          <h1 className="text-2xl font-semibold mt-2">{gym.name}</h1>
          <p className="text-sm text-muted-foreground">{gym.address}</p>
        </div>
        <div className="text-xs text-muted-foreground">
          Updated {new Date(gym.updatedAt).toLocaleString()}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Owner info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>ID: {gym.owner?.id ?? "Unknown"}</div>
          <div>Name: {gym.owner?.name ?? "Unknown"}</div>
          <div>Email: {gym.owner?.email ?? "Unknown"}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>GST details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>GST Number: {gym.gstNumber ?? "Not submitted"}</div>
          <div>
            Certificate: {gym.gstCertificateUrl ? (
              <a
                href={gym.gstCertificateUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                View document
              </a>
            ) : (
              "Not uploaded"
            )}
          </div>
          <div>
            GST verified at: {gym.gstVerifiedAt ? new Date(gym.gstVerifiedAt).toLocaleString() : "Not verified"}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bank & payout</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>Bank account verified: {gym.bankAccountVerified ? "Yes" : "No"}</div>
          <div>Bank account last 4: {gym.bankAccountLast4 ?? "Not provided"}</div>
          <div>Razorpay sub-account: {gym.razorpaySubAccountId ?? "Not linked"}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Review actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {gym.verificationNotes && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
              Existing notes: {gym.verificationNotes}
            </div>
          )}
          <VerificationActions
            gymId={gym.id}
            initialStatus={gym.verificationStatus}
            initialNotes={gym.verificationNotes}
          />
        </CardContent>
      </Card>
    </div>
  );
}
