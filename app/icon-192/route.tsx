import { ImageResponse } from "next/og";

// Dedicated fixed-size PNG referenced by app/manifest.json's icons array
// (separate from the auto-wired app/icon.tsx favicon).
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          color: "#ffffff",
          fontSize: 110,
          fontWeight: 700,
        }}
      >
        S
      </div>
    ),
    { width: 192, height: 192 }
  );
}
