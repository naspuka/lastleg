import { ImageResponse } from "next/og";

// Branded favicon — generated at build time via the App Router's `icon.tsx`
// convention, which wires the result into <link rel="icon"> automatically.
// Replaces the placeholder src/app/favicon.ico from the create-next-app scaffold.

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1B4D3E",
          color: "#FAF7F0",
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontWeight: 700,
          fontSize: 24,
          letterSpacing: -1,
          borderRadius: 7,
        }}
      >
        L
      </div>
    ),
    { ...size }
  );
}
