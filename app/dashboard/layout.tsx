import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LocationGate } from "@/components/layout/location-gate";
import { DashboardNav } from "@/components/layout/dashboard-nav";
import { prisma } from "@/lib/prisma";
import { buildPageMetadata } from "@/lib/seo/config";

export const metadata: Metadata = buildPageMetadata({
  title: "Dashboard",
  description: "Member and owner dashboard",
  path: "/dashboard",
  noIndex: true,
});

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/auth/login?callbackUrl=/dashboard");
  }
  const role = (session.user as { role?: string }).role;
  if (role !== "USER" && role !== "OWNER" && role !== "ADMIN") {
    redirect("/auth/login");
  }
  const isOwner = role === "OWNER" || role === "ADMIN";
  let showVerification = false;
  if (isOwner) {
    const userId = (session.user as { id: string }).id;
    const gyms = await prisma.gym.findMany({
      where: { ownerId: userId },
      select: { verificationStatus: true },
    });
    showVerification = gyms.some((gym) => gym.verificationStatus !== "VERIFIED");
  }

  return (
    <LocationGate>
      <div className="relative min-h-screen bg-background flex flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 right-0 h-80 w-80 rounded-full bg-primary/15 blur-[120px]" />
          <div className="absolute top-1/3 -left-20 h-96 w-96 rounded-full bg-accent/15 blur-[140px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_55%)] dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_55%)]" />
        </div>
        <DashboardNav role={role ?? "USER"} isOwner={isOwner} showVerification={showVerification} />
        <main className="pl-0 md:pl-56 pt-16 flex-1">{children}</main>
      </div>
    </LocationGate>
  );
}
