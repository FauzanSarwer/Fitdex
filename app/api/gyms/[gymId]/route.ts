import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ gymId: string }> }
) {
  try {
    const { gymId } = await params;
    const gym = await prisma.gym.findUnique({
      where: { id: gymId },
      include: {
        owner: { select: { id: true, name: true } },
      },
    });
    if (!gym) {
      return NextResponse.json({ error: "Gym not found" }, { status: 404 });
    }
    const monthly = gym.monthlyPrice;
    const quarterly =
      gym.quarterlyPrice ?? Math.round(gym.monthlyPrice * 3 * 0.9);
    const yearly = gym.yearlyPrice;
    const yearlySavePercent =
      monthly > 0
        ? Math.round(100 - (yearly / 12 / monthly) * 100)
        : 0;
    const quarterlySavePercent =
      monthly > 0
        ? Math.round(100 - (quarterly / 3 / monthly) * 100)
        : 0;
    return NextResponse.json({
      gym: {
        id: gym.id,
        name: gym.name,
        address: gym.address,
        latitude: gym.latitude,
        longitude: gym.longitude,
        coverImageUrl: gym.coverImageUrl,
        owner: gym.owner,
        monthlyPrice: monthly,
        quarterlyPrice: quarterly,
        yearlyPrice: yearly,
        partnerDiscountPercent: gym.partnerDiscountPercent,
        quarterlyDiscountPercent: gym.quarterlyDiscountPercent,
        yearlyDiscountPercent: gym.yearlyDiscountPercent,
        welcomeDiscountPercent: gym.welcomeDiscountPercent,
        maxDiscountCapPercent: gym.maxDiscountCapPercent,
        yearlySavePercent,
        quarterlySavePercent,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to fetch gym" },
      { status: 500 }
    );
  }
}
