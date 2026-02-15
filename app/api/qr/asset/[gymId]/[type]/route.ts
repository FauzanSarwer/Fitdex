import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api";
import { requireGymAdmin, requireSuperAdmin } from "@/lib/permissions";
import { QrTypeSchema } from "@/lib/qr/qr-types";
import { ensureStaticQr, getLastQrGeneration } from "@/lib/qr/qr-service";
import { generateQrPng, generateQrPrintPdf, generateQrSvg } from "@/lib/qr/qr-generator";

const getLabel = (type: string) => {
  if (type === "ENTRY") return "SCAN TO START SESSION";
  if (type === "EXIT") return "SCAN TO END SESSION";
  return "SCAN TO PAY MEMBERSHIP";
};

export async function GET(req: Request, { params }: { params: Promise<{ gymId: string; type: string }> }) {
  const session = await getServerSession(authOptions);
  if (!requireGymAdmin(session)) {
    return jsonError("Unauthorized", 401);
  }

  const { gymId, type } = await params;
  const parsedType = QrTypeSchema.safeParse(type.toUpperCase());
  if (!parsedType.success) return jsonError("Invalid QR type", 400);

  const gym = await prisma.gym.findUnique({ where: { id: gymId } });
  if (!gym) return jsonError("Gym not found", 404);

  const uid = (session!.user as { id: string }).id;
  if (!requireSuperAdmin(session) && gym.ownerId !== uid) {
    return jsonError("Forbidden", 403);
  }

  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://fitdex.app"}/qr/static/${gymId}/${parsedType.data}`;
  await ensureStaticQr(gymId, parsedType.data, uid);

  const searchParams = new URL(req.url).searchParams;
  const format = (searchParams.get("format") ?? "png").toLowerCase();
  const layout = (searchParams.get("layout") ?? "A4").toUpperCase() as "A4" | "A5";
  const size = Number(searchParams.get("size") ?? "512");

  if (format === "svg") {
    const svg = await generateQrSvg(url, size || 512);
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "private, max-age=120",
      },
    });
  }

  const png = await generateQrPng(url, size || 512);

  if (format === "pdf") {
    const lastGeneratedAt = await getLastQrGeneration(gymId, parsedType.data);
    const pdf = await generateQrPrintPdf({
      gymName: gym.name,
      label: getLabel(parsedType.data),
      qrPng: png,
      layout,
      instructions: lastGeneratedAt ? `Last generated ${lastGeneratedAt.toLocaleDateString()}` : undefined,
    });

    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${gym.name}-${parsedType.data}.pdf"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  }

  return new NextResponse(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=120",
    },
  });
}
