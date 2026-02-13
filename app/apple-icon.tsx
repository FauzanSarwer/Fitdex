import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const iconDataUrl = `data:image/png;base64,${readFileSync(
  join(process.cwd(), "app", "icon.png")
).toString("base64")}`;

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
        }}
      >
        <div
          style={{
            width: "84%",
            height: "84%",
            borderRadius: "9999px",
            background: "#04060a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16%",
          }}
        >
          <img
            src={iconDataUrl}
            alt="Fitdex"
            width="100%"
            height="100%"
            style={{
              objectFit: "contain",
              borderRadius: "18%",
            }}
          />
        </div>
      </div>
    ),
    size
  );
}
