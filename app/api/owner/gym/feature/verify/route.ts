import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";
import { PaymentConfigError, verifyRazorpayPaymentSignature } from "@/lib/razorpay";
import { jsonError, safeJson } from "@/lib/api";
import { logServerError } from "@/lib/logger";

const FEATURE_DAYS = 3;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const parsed = await safeJson<{
    gymId?: string;
    orderId?: string;
    paymentId?: string;
    signature?: string;
  }>(req);
  if (!parsed.ok) {
    return jsonError("Invalid JSON body", 400);
  }
  const gymId = parsed.data.gymId?.trim();
  const orderId = parsed.data.orderId?.trim();
  const paymentId = parsed.data.paymentId?.trim();
  const signature = parsed.data.signature?.trim();
  if (!gymId || !orderId || !paymentId || !signature) {
    return jsonError("Missing fields", 400);
  }
  let purchaseId: string | null = null;
  try {
    const gym = await prisma.gym.findFirst({ where: { id: gymId, ownerId: uid } });
    if (!gym) {
      return jsonError("Gym not found", 404);
    }
    const purchase = await prisma.featuredListingPurchase.findUnique({
      where: { razorpayOrderId: orderId },
    });
    if (!purchase) {
      return jsonError("Purchase not found", 404);
    }
    purchaseId = purchase.id;
    if (!verifyRazorpayPaymentSignature(orderId, paymentId, signature)) {
      await prisma.featuredListingPurchase.update({
        where: { id: purchase.id },
        data: { status: "FAILED" },
      });
      return jsonError("Invalid signature", 400);
    }
    const updated = await prisma.$transaction(async (tx) => {
      const fresh = await tx.gym.findFirst({ where: { id: gymId, ownerId: uid } });
      if (!fresh) throw new Error("GYM_NOT_FOUND");
      const now = new Date();
      const isAlreadyFeatured = (fresh.featuredEndAt && fresh.featuredEndAt > now) || (fresh.featuredUntil && fresh.featuredUntil > now);
      if (!isAlreadyFeatured) {
        const area = fresh.city ?? "UNKNOWN";
        const [totalGyms, featuredCount] = await Promise.all([
          tx.gym.count({ where: { verificationStatus: { not: "REJECTED" }, city: area } }),
          tx.gym.count({
            where: {
              verificationStatus: { not: "REJECTED" },
              city: area,
              OR: [
                { featuredEndAt: { gt: now } },
                { featuredUntil: { gt: now } },
              ],
            },
          }),
        ]);
        const maxFeatured = Math.max(1, Math.floor(totalGyms * 0.2));
        if (featuredCount >= maxFeatured) {
          throw new Error("FEATURED_FULL");
        }
      }
      const current = fresh.featuredEndAt && fresh.featuredEndAt > now
        ? fresh.featuredEndAt
        : fresh.featuredUntil && fresh.featuredUntil > now
          ? fresh.featuredUntil
          : now;
      const featuredEndAt = new Date(current.getTime() + FEATURE_DAYS * 24 * 60 * 60 * 1000);
      await tx.featuredListingPurchase.update({
        where: { id: purchase.id },
        data: { status: "CAPTURED", razorpayPaymentId: paymentId },
      });
      return tx.gym.update({
        where: { id: gymId },
        data: {
          isFeatured: true,
          featuredStartAt: fresh.featuredStartAt ?? now,
          featuredEndAt,
          featuredUntil: featuredEndAt,
        },
      });
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({
      ok: true,
      featuredUntil: updated.featuredEndAt ?? updated.featuredUntil,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "FEATURED_FULL") {
      if (purchaseId) {
        await prisma.featuredListingPurchase.update({
          where: { id: purchaseId },
          data: { status: "FAILED" },
        });
      }
      return jsonError("All featured slots are full. Check back tomorrow.", 409);
    }
    if (error instanceof Error && error.message === "GYM_NOT_FOUND") {
      return jsonError("Gym not found", 404);
    }
    if (error instanceof PaymentConfigError) {
      return jsonError("Payments unavailable", 503);
    }
    logServerError(error as Error, { route: "/api/owner/gym/feature/verify", userId: uid });
    return jsonError("Failed to verify purchase", 500);
  }
}
