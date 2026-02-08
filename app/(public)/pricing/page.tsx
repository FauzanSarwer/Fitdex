import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function PricingPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role === "OWNER" || role === "ADMIN") {
    redirect("/dashboard/owner/subscription");
  }
  redirect("/owners");
}
