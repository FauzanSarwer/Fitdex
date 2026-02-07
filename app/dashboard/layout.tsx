import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LocationGate } from "@/components/layout/location-gate";
import { DashboardNav } from "@/components/layout/dashboard-nav";
import { Footer } from "@/components/layout/footer";

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

  return (
    <LocationGate>
      <div className="min-h-screen bg-background flex flex-col">
        <DashboardNav role={role ?? "USER"} isOwner={isOwner} />
        <main className="pl-0 md:pl-56 pt-16 flex-1">
          {children}
        </main>
        <div className="pl-0 md:pl-56">
          <Footer />
        </div>
      </div>
    </LocationGate>
  );
}
