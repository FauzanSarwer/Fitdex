"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  CreditCard,
  Users,
  MapPin,
  User,
  Settings,
  BarChart3,
  Percent,
  Dumbbell,
  Compass,
} from "lucide-react";
import { cn } from "@/lib/utils";

const USER_LINKS = [
  { href: "/dashboard/user", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/user/membership", label: "Membership", icon: CreditCard },
  { href: "/dashboard/user/duo", label: "Duo", icon: Users },
  { href: "/dashboard/user/payments", label: "Payments", icon: CreditCard },
  { href: "/dashboard/user/settings", label: "Settings", icon: Settings },
];

const OWNER_LINKS = [
  { href: "/dashboard/owner", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/owner/gym", label: "Gym", icon: MapPin },
  { href: "/dashboard/owner/explore", label: "Explore", icon: Compass },
  { href: "/dashboard/owner/members", label: "Members", icon: Users },
  { href: "/dashboard/owner/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/owner/discounts", label: "Discounts", icon: Percent },
  { href: "/dashboard/owner/settings", label: "Settings", icon: Settings },
];

export function DashboardNav({ role, isOwner }: { role: string; isOwner?: boolean }) {
  const pathname = usePathname();
  const links = isOwner ? OWNER_LINKS : USER_LINKS;

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 glass border-b border-white/10 md:pl-56">
        <div className="flex h-16 items-center px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-glow-sm">
              <Dumbbell className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold">GYMDUO</span>
          </Link>
        </div>
      </header>
      <aside className="fixed left-0 top-0 z-50 hidden h-full w-56 flex-col border-r border-white/10 bg-background/95 backdrop-blur md:flex">
        <div className="flex h-16 items-center border-b border-white/10 px-4">
          <Link href={isOwner ? "/dashboard/owner" : "/dashboard/user"} className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <span className="font-semibold">{isOwner ? "Owner" : "Member"}</span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {links.map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard/user" && item.href !== "/dashboard/owner" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:bg-white/10 hover:text-foreground"
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
