import { ImageResponse } from "next/og";

// OG / social-share card. Renders when the URL is pasted into iMessage,
// WhatsApp, Twitter, Slack, LinkedIn, etc. 1200x630 is the canonical size both
// Open Graph and Twitter `summary_large_image` expect; smaller renderers
// scale down cleanly.
//
// Mirrors the landing-page hero in miniature: forest field, cream wordmark,
// coral price highlight on the ticket. Deliberately wordless beyond the
// headline so it reads in 1.5 seconds on a phone preview.

export const alt = "LastLeg — Don't waste your unused coach ticket";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FOREST = "#1B4D3E";
const FOREST_DEEP = "#143A2F";
const CREAM = "#FAF7F0";
const CREAM_DIM = "#D9D2C0";
const CORAL = "#E8745C";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: 1200,
        height: 630,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: `linear-gradient(140deg, ${FOREST} 0%, ${FOREST_DEEP} 100%)`,
        color: CREAM,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Top row: brand mark + live tag */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <div
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 44,
            fontWeight: 700,
            letterSpacing: -1,
            color: CREAM,
          }}
        >
          LastLeg
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 18px",
            border: `1px solid ${CREAM_DIM}`,
            borderRadius: 999,
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: 1.5,
            color: CREAM_DIM,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              background: CORAL,
              display: "flex",
            }}
          />
          UK COACH MARKETPLACE
        </div>
      </div>

      {/* Body: headline + sub */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 28,
          maxWidth: 720,
        }}
      >
        <div
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 88,
            fontWeight: 700,
            lineHeight: 1.04,
            letterSpacing: -2,
            color: CREAM,
          }}
        >
          Don&rsquo;t waste your unused coach ticket.
        </div>
        <div
          style={{
            fontSize: 28,
            lineHeight: 1.4,
            color: CREAM_DIM,
            maxWidth: 640,
            display: "flex",
          }}
        >
          A marketplace for last-minute UK coach tickets. Sellers recoup
          something. Buyers get a discount. No scalping.
        </div>
      </div>

      {/* Bottom row: tagline anchor + mini price chip */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <div
          style={{
            fontSize: 22,
            color: CREAM_DIM,
            letterSpacing: 0.3,
          }}
        >
          lastleg.app
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            padding: "18px 24px",
            background: CREAM,
            color: FOREST,
            borderRadius: 16,
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontWeight: 700,
          }}
        >
          <div
            style={{
              fontSize: 26,
              color: "#7a7565",
              textDecoration: "line-through",
              display: "flex",
            }}
          >
            £24
          </div>
          <div style={{ fontSize: 32, color: FOREST, display: "flex" }}>→</div>
          <div style={{ fontSize: 44, color: FOREST, display: "flex" }}>£9</div>
          <div
            style={{
              marginLeft: 8,
              padding: "6px 12px",
              background: CORAL,
              color: CREAM,
              borderRadius: 999,
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: 0.5,
              display: "flex",
            }}
          >
            −63%
          </div>
        </div>
      </div>
    </div>,
    { ...size }
  );
}
