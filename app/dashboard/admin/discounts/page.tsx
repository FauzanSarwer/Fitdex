import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";
import { logServerError } from "@/lib/logger";
import { Skeleton } from "@/components/ui/skeleton";
import React from "react";

export const dynamic = "force-dynamic";

// Define constants for discount types
const DISCOUNT_TYPES = { FLAT: "FLAT", PERCENTAGE: "PERCENTAGE" } as const;

// Define TypeScript type for discounts
interface Discount {
  id: string;
  gym?: { name: string } | null;
  code: string;
  discountType: keyof typeof DISCOUNT_TYPES;
  discountValue: number;
  usedCount: number;
  maxUses: number;
  validUntil: string;
}

export default async function AdminDiscountsPage() {
  // Defensive: session and admin check
  const session = await getServerSession(authOptions);
  if (!session || !requireAdmin(session)) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Discount codes</h1>
        <div className="text-destructive">Access denied. Admin privileges required.</div>
      </div>
    );
  }

  let discounts: Discount[] = [];
  let error: string | null = null;
  let loading = false;
  try {
    const results = await prisma.discountCode.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
      include: { gym: { select: { name: true } } },
    });
    // Defensive: null/undefined checks
    if (!results || !Array.isArray(results)) {
      error = "Failed to load discount codes.";
    } else {
      discounts = results.map((code) => ({
        ...code,
        discountType: code.discountType as keyof typeof DISCOUNT_TYPES,
        validUntil: code.validUntil?.toISOString?.() ?? "N/A",
        code: code.code ?? "-",
        discountValue: code.discountValue ?? 0,
        maxUses: code.maxUses ?? 0,
        usedCount: code.usedCount ?? 0,
        gym: code.gym ?? { name: "-" },
      }));
    }
  } catch (err) {
    logServerError(err as Error, { scope: "AdminDiscountsPage" });
    error = (err as Error)?.message ?? "Failed to load discount codes.";
  }

  // Defensive: explicit loading and empty/error states
  if (loading) {
    return (
      <div className="p-6">
        <Skeleton className="h-10 w-full mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Discount codes</h1>
        <div className="text-destructive">{error}</div>
      </div>
    );
  }

  // Defensive: idempotent rendering, safe defaults
  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold" tabIndex={0} aria-label="Discount codes">Discount codes</h1>
        <p className="text-sm text-muted-foreground">Global discount visibility for all gyms.</p>
      </div>

      <Card className="glass-card" aria-label="Discount codes table">
        <CardHeader>
          <CardTitle>Recent codes ({discounts.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          {discounts.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">No discount codes found.</div>
          ) : (
            <table className="w-full text-sm" aria-label="Discount codes">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2">Gym</th>
                  <th className="py-2">Code</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Value</th>
                  <th className="py-2">Uses</th>
                  <th className="py-2">Valid until</th>
                </tr>
              </thead>
              <tbody>
                {discounts.map((code) => (
                  <tr key={code.id} className="border-t border-white/10">
                    <td className="py-2">{code.gym?.name ?? "-"}</td>
                    <td className="py-2 font-mono text-xs">{code.code ?? "-"}</td>
                    <td className="py-2">{code.discountType ?? "-"}</td>
                    <td className="py-2">
                      {code.discountType === DISCOUNT_TYPES.FLAT
                        ? formatPrice(code.discountValue ?? 0)
                        : `${code.discountValue ?? 0}%`}
                    </td>
                    <td className="py-2">{code.usedCount ?? 0}/{code.maxUses ?? 0}</td>
                    <td className="py-2">{code.validUntil !== "N/A" ? new Date(code.validUntil).toLocaleDateString() : "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
