import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { jsonError } from "@/lib/api";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
  api_key: process.env.CLOUDINARY_API_KEY?.trim(),
  api_secret: process.env.CLOUDINARY_API_SECRET?.trim(),
});

export const runtime = "nodejs";

export async function GET() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    return jsonError("Missing Cloudinary configuration", 500);
  }

  const timestamp = Math.round(Date.now() / 1000);
  const folder = "fitdex/gyms";

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    apiSecret
  );

  return NextResponse.json({
    signature,
    timestamp,
    cloudName,
    apiKey,
    folder,
  });
}
