import QRCode from "qrcode";
import PDFDocument from "pdfkit";

export async function generateQrPng(text: string, size = 512): Promise<Buffer> {
  return QRCode.toBuffer(text, {
    type: "png",
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}

export async function generateQrSvg(text: string, size = 512): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}

export async function generateQrPrintPdf(params: {
  gymName: string;
  label: string;
  qrPng: Buffer;
  layout?: "A4" | "A5";
  instructions?: string;
}): Promise<Buffer> {
  const layout = params.layout ?? "A4";
  const doc = new PDFDocument({ size: layout, margin: 48 });
  const chunks: Buffer[] = [];
  const page = doc.page;

  doc.on("data", (chunk) => chunks.push(chunk));

  doc.rect(0, 0, page.width, page.height).fill("#FFFFFF");
  doc.fillColor("#111111");

  doc.fontSize(layout === "A4" ? 28 : 22).text(params.gymName, {
    align: "center",
  });
  doc.moveDown(0.2);
  doc.fontSize(layout === "A4" ? 18 : 14).text(params.label, {
    align: "center",
  });

  const qrSize = layout === "A4" ? 360 : 280;
  const qrX = (page.width - qrSize) / 2;
  const qrY = page.height / 2 - qrSize / 2;

  doc.image(params.qrPng, qrX, qrY, { width: qrSize, height: qrSize });

  doc.moveTo(60, qrY - 24)
    .lineTo(page.width - 60, qrY - 24)
    .strokeColor("#E5E7EB")
    .stroke();

  doc.moveTo(60, qrY + qrSize + 24)
    .lineTo(page.width - 60, qrY + qrSize + 24)
    .strokeColor("#E5E7EB")
    .stroke();

  if (params.instructions) {
    doc.fillColor("#4B5563")
      .fontSize(layout === "A4" ? 12 : 10)
      .text(params.instructions, 72, qrY + qrSize + 40, {
        align: "center",
        width: page.width - 144,
      });
  }

  doc.fillColor("#9CA3AF")
    .fontSize(layout === "A4" ? 10 : 9)
    .text("Powered by Fitdex", 72, page.height - 72, {
      align: "center",
      width: page.width - 144,
    });

  doc.end();

  return await new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
}
