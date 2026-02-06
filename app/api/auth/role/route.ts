import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_ROLES = new Set(["USER", "OWNER"]);

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const requested = typeof body?.role === "string" ? body.role.toUpperCase() : "USER";
    const normalized = ALLOWED_ROLES.has(requested) ? requested : "USER";

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.role === "ADMIN") {
      return NextResponse.json({ role: "ADMIN" }, { status: 200 });
    }

    let nextRole = normalized;
    if (user.role === "OWNER" && normalized === "USER") {
      nextRole = "OWNER";
    }

    if (user.role !== nextRole) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { role: nextRole },
      });
    }

    return NextResponse.json({ role: nextRole }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to update role" },
      { status: 500 }
    );
  }
}
