"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  LayoutDashboard,
  CreditCard,
  Users,
  MapPin,
  User,
  Settings,
  BarChart3,
  Percent,
  Compass,
  ShieldCheck,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "@/components/layout/global-search";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { EmailVerificationBanner } from "@/components/layout/email-verification-banner";

const USER_LINKS = [
  { href: "/dashboard/user", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/user/membership", label: "Membership", icon: CreditCard },
  { href: "/dashboard/user/duo", label: "Duo", icon: Users },
  { href: "/dashboard/user/payments", label: "Transactions", icon: CreditCard },
  { href: "/dashboard/user/settings", label: "Settings", icon: Settings },
];

const OWNER_LINKS = [
  { href: "/dashboard/owner", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/owner/gym", label: "Gym", icon: MapPin },
  { href: "/dashboard/owner/explore", label: "Owner explore", icon: Compass },
  { href: "/dashboard/owner/members", label: "Members", icon: Users },
  { href: "/dashboard/owner/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/owner/discounts", label: "Discounts", icon: Percent },
  { href: "/dashboard/owner/subscription", label: "Subscription", icon: CreditCard },
  { href: "/dashboard/owner/settings", label: "Settings", icon: Settings },
];

const ADMIN_LINKS = [
  { href: "/dashboard/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/admin/verification", label: "Verification", icon: ShieldCheck },
  { href: "/dashboard/admin/gyms", label: "Gyms", icon: MapPin },
  { href: "/dashboard/admin/users", label: "Users", icon: Users },
  { href: "/dashboard/admin/memberships", label: "Memberships", icon: CreditCard },
  { href: "/dashboard/admin/transactions", label: "Transactions", icon: BarChart3 },
  { href: "/dashboard/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/dashboard/admin/duos", label: "Duos", icon: Users },
  { href: "/dashboard/admin/invites", label: "Invites", icon: Users },
  { href: "/dashboard/admin/notifications", label: "Notifications", icon: Bell },
  { href: "/dashboard/admin/discounts", label: "Discounts", icon: Percent },
  { href: "/dashboard/admin/settings", label: "Settings", icon: Settings },
];

export function DashboardNav({
  role,
  isOwner: _isOwner,
  showVerification,
}: {
  role: string;
  isOwner?: boolean;
  showVerification?: boolean;
}) {
  const pathname = usePathname();
  const navRole = role === "ADMIN"
    ? pathname?.startsWith("/dashboard/owner")
      ? "OWNER"
      : pathname?.startsWith("/dashboard/user")
        ? "USER"
        : "ADMIN"
    : role;
  const links = navRole === "ADMIN"
    ? ADMIN_LINKS
    : navRole === "OWNER"
      ? [
          ...OWNER_LINKS.slice(0, 2),
          ...(showVerification
            ? [{ href: "/dashboard/owner/verification", label: "Verification", icon: ShieldCheck }]
            : []),
          ...OWNER_LINKS.slice(2),
        ]
      : USER_LINKS;
  const adminActive = pathname?.startsWith("/dashboard/admin");
  const ownerActive = pathname?.startsWith("/dashboard/owner");
  const userActive = pathname?.startsWith("/dashboard/user");
  const primaryNav =
    navRole === "ADMIN"
      ? { href: "/dashboard/admin", label: "Admin panel", icon: ShieldCheck }
      : navRole === "OWNER"
        ? { href: "/dashboard/owner", label: "Owner panel", icon: Compass }
        : { href: "/dashboard/user", label: "Dashboard", icon: LayoutDashboard };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 glass border-b border-border/60 md:pl-56">
        <EmailVerificationBanner />
        <div className="relative flex h-16 items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-card/80 shadow-glow-sm">
              <Image
                src="/fitdex-logo.png"
                alt="Fitdex"
                width={24}
                height={24}
                className="h-6 w-6 object-contain rotate-0 skew-x-0 skew-y-0"
                priority
              />
            </div>
            <span className="text-lg font-bold">Fitdex</span>
          </Link>
          <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden -translate-x-1/2 md:flex items-center">
            <Link
              href={primaryNav.href}
              className="pointer-events-auto inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <primaryNav.icon className="h-4 w-4" />
              {primaryNav.label}
            </Link>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden xl:flex">
              <GlobalSearch className="w-[20rem]" />
            </div>
            <ThemeToggle />
            {role === "ADMIN" && (
              <>
              <Link
                href="/dashboard/admin"
                className={cn(
                  "rounded-full px-4 py-2 text-xs font-semibold transition-colors",
                  adminActive
                    ? "bg-primary/20 text-primary"
                    : "bg-card/70 text-foreground hover:bg-card"
                )}
              >
                Admin panel
              </Link>
              <Link
                href="/dashboard/owner"
                className={cn(
                  "rounded-full px-3 py-2 text-xs font-semibold transition-colors",
                  ownerActive
                    ? "bg-primary/20 text-primary"
                    : "bg-card/70 text-foreground hover:bg-card"
                )}
              >
                Owner dashboard
              </Link>
              <Link
                href="/dashboard/user"
                className={cn(
                  "rounded-full px-3 py-2 text-xs font-semibold transition-colors",
                  userActive
                    ? "bg-primary/20 text-primary"
                    : "bg-card/70 text-foreground hover:bg-card"
                )}
              >
                User dashboard
              </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <aside className="fixed left-0 top-0 z-50 hidden h-full w-56 flex-col border-r border-border/60 bg-background/95 backdrop-blur md:flex">
        <div className="flex h-16 items-center border-b border-border/60 px-4">
          <Link href={navRole === "ADMIN" ? "/dashboard/admin" : navRole === "OWNER" ? "/dashboard/owner" : "/dashboard/user"} className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <span className="font-semibold">{navRole === "ADMIN" ? "Admin" : navRole === "OWNER" ? "Owner" : "Member"}</span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {links.map((item) => {
            const isOverview = item.href === "/dashboard/user" || item.href === "/dashboard/owner" || item.href === "/dashboard/admin";
            const active = isOverview ? pathname === item.href : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:bg-card hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
