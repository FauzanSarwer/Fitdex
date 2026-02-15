import JSZip from "jszip";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api";
import { requireSuperAdmin } from "@/lib/permissions";
import { ensureStaticQr } from "@/lib/qr/qr-service";
import { generateQrPng, generateQrPrintPdf } from "@/lib/qr/qr-generator";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://fitdex.app";
const TYPES = ["ENTRY", "EXIT", "PAYMENT"] as const;

const sanitize = (value: string) => value.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "");

export async function GET(_req: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!requireSuperAdmin(session)) return jsonError("Unauthorized", 401);

  const { batchId } = await params;
  const job = await prisma.qrBatchJob.findUnique({ where: { id: batchId } });
  if (!job) return jsonError("Batch not found", 404);

  const gyms = job.scope === "GYM" && job.gymId
    ? await prisma.gym.findMany({ where: { id: job.gymId } })
    : await prisma.gym.findMany({ select: { id: true, name: true } });

  await prisma.qrBatchJob.update({
    where: { id: batchId },
    data: { status: "RUNNING", processedCount: 0, totalCount: gyms.length },
  });

  const zip = new JSZip();
  let processed = 0;

  for (const gym of gyms) {
    const folder = zip.folder(sanitize(gym.name ?? gym.id)) ?? zip;

    for (const type of TYPES) {
      await ensureStaticQr(gym.id, type);
      const url = `${APP_URL}/qr/static/${gym.id}/${type}`;
      const png = await generateQrPng(url, 768);
      const pdf = await generateQrPrintPdf({
        gymName: gym.name ?? "Fitdex Gym",
        label: type === "ENTRY" ? "SCAN TO START SESSION" : type === "EXIT" ? "SCAN TO END SESSION" : "SCAN TO PAY MEMBERSHIP",
        qrPng: png,
        layout: "A4",
      });

      folder.file(`${type.toLowerCase()}.png`, png);
      folder.file(`print-${type.toLowerCase()}.pdf`, pdf);
    }

    processed += 1;
    if (processed % 10 === 0) {
      await prisma.qrBatchJob.update({
        where: { id: batchId },
        data: { processedCount: processed },
      });
    }
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer" });

  await prisma.qrBatchJob.update({
    where: { id: batchId },
    data: {
      status: "COMPLETE",
      processedCount: processed,
      completedAt: new Date(),
      downloadUrl: `/api/admin/qr/batch/${batchId}/download`,
    },
  });

return new NextResponse(new Uint8Array(buffer), {
  headers: {
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="fitdex-qr-batch-${batchId}.zip"`,
  },
});

}
