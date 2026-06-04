import { ImageResponse } from "next/og";

// iOS home-screen icon. 180x180 is Apple's current recommendation; iOS scales
// down for older devices automatically. Pulled out into its own file so we can
// give it more breathing room than the 32x32 favicon — a tiny corner pip plus
// the wordmark initial reads cleanly at home-screen size.

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: 180,
        height: 180,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1B4D3E",
        color: "#FAF7F0",
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontWeight: 700,
        fontSize: 124,
        letterSpacing: -4,
        borderRadius: 40,
      }}
    >
      L
      {/* coral live-dot in the corner echoes the ticket motif on the landing */}
      <div
        style={{
          position: "absolute",
          top: 28,
          right: 28,
          width: 16,
          height: 16,
          borderRadius: 8,
          background: "#E8745C",
          display: "flex",
        }}
      />
    </div>,
    { ...size }
  );
}
