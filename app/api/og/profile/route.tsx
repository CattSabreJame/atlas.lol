import { ImageResponse } from "next/og";

export const runtime = "edge";

const WIDTH = 1200;
const HEIGHT = 630;
const HANDLE_MAX_LENGTH = 20;
const NAME_MAX_LENGTH = 60;

function sanitizeHandle(value: string | null): string {
  const normalized = (value ?? "").trim().replace(/^@+/, "").toLowerCase();

  if (!/^[a-z0-9_]{3,20}$/.test(normalized)) {
    return "atlas";
  }

  return normalized.slice(0, HANDLE_MAX_LENGTH);
}

function sanitizeText(value: string | null, fallback: string, maxLength: number): string {
  const normalized = (value ?? "").trim();

  if (!normalized) {
    return fallback;
  }

  return normalized.slice(0, maxLength);
}

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const handle = sanitizeHandle(searchParams.get("handle"));
  const name = sanitizeText(searchParams.get("name"), `@${handle}`, NAME_MAX_LENGTH);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(135deg, #151311 0%, #25201b 45%, #3a2f24 100%)",
          color: "#f5efe6",
          fontFamily: "Inter, Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -120,
            left: -90,
            width: 520,
            height: 520,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,255,255,0.22), rgba(255,255,255,0))",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -80,
            bottom: -170,
            width: 620,
            height: 620,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,206,149,0.3), rgba(255,206,149,0))",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            padding: "58px 72px",
            zIndex: 2,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 26,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#d6ccbf",
            }}
          >
            Atlas
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: 88,
              gap: 14,
              maxWidth: 980,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 72,
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
                textShadow: "0 8px 26px rgba(0,0,0,0.28)",
              }}
            >
              {name}
            </div>

            <div
              style={{
                display: "flex",
                fontSize: 36,
                color: "#d9ccbd",
                lineHeight: 1.15,
              }}
            >
              @{handle}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              marginTop: "auto",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 24,
              color: "#dbd2c6",
            }}
          >
            <div style={{ display: "flex" }}>Premium profile link</div>
            <div style={{ display: "flex", opacity: 0.9 }}>joinatlas.dev</div>
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
    },
  );
}
