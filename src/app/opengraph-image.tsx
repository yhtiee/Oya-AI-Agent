import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt =
  "Oya: everybody needs one person who knows everybody. A street at dusk with a WhatsApp chat asking Oya when the light will come back.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FOREST = "#10241B";
const LIT = "#F7B26E";
const DARK = "#1E3A2D";

const font = (file: string) => readFile(join(process.cwd(), "assets/fonts", file));

export default async function OpengraphImage() {
  const [display, body, bodyBold] = await Promise.all([
    font("BricolageGrotesque-800.woff"),
    font("DMSans-400.woff"),
    font("DMSans-700.woff"),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background:
          "radial-gradient(ellipse 70% 55% at 50% 100%, rgba(242,140,40,0.38), rgba(242,140,40,0) 70%), linear-gradient(180deg, #10241B 0%, #1A3428 55%, #2C4A3C 100%)",
        fontFamily: "DM Sans",
      }}
    >
      {/* Stars */}
      {[
        [80, 70],
        [260, 40],
        [430, 110],
        [610, 52],
        [790, 96],
        [960, 40],
        [1120, 120],
        [1010, 210],
        [520, 200],
      ].map(([x, y]) => (
        <div
          key={`${x}-${y}`}
          style={{
            position: "absolute",
            left: x,
            top: y,
            width: 4,
            height: 4,
            borderRadius: 4,
            background: "#FAF6EE",
            opacity: 0.5,
          }}
        />
      ))}

      {/* Words */}
      <div style={{ display: "flex", flexDirection: "column", padding: "56px 0 0 72px", width: 700 }}>
        <div style={{ fontFamily: "Bricolage", fontSize: 64, color: "#F28C28", letterSpacing: -2, lineHeight: 1 }}>
          oya
        </div>
        <div
          style={{
            fontFamily: "Bricolage",
            fontSize: 70,
            color: "#FAF6EE",
            letterSpacing: -2.5,
            lineHeight: 1,
            marginTop: 40,
          }}
        >
          Everybody needs one person who knows everybody.
        </div>
        <div style={{ fontSize: 28, color: "#C5D6CC", marginTop: 26, lineHeight: 1.35 }}>
          Oya is that person, right inside WhatsApp. Free, starting in Nigeria.
        </div>
      </div>

      {/* A chat */}
      <div
        style={{
          position: "absolute",
          right: 64,
          top: 96,
          width: 390,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div
          style={{
            alignSelf: "flex-end",
            background: "#DCEFE3",
            color: FOREST,
            fontSize: 25,
            lineHeight: 1.3,
            padding: "16px 20px",
            borderRadius: "24px 24px 6px 24px",
            maxWidth: 330,
          }}
        >
          Light don go again. When e go come back?
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 44,
              background: "#F28C28",
              color: FOREST,
              fontFamily: "Bricolage",
              fontSize: 26,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginTop: 4,
            }}
          >
            o
          </div>
          <div
            style={{
              background: "#FFFDF8",
              color: FOREST,
              fontSize: 25,
              lineHeight: 1.3,
              padding: "16px 20px",
              borderRadius: "6px 24px 24px 24px",
              maxWidth: 334,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>23 people on your street don report am. I go buzz you as e land.</span>
            <span style={{ fontWeight: 700, color: "#1D6B47", fontSize: 20, marginTop: 8 }}>Oya · just now</span>
          </div>
        </div>
      </div>

      {/* The street */}
      <svg width="1200" height="150" viewBox="0 0 1200 150" style={{ position: "absolute", left: 0, bottom: 0 }}>
        <g fill="#24432F">
          <rect x="0" y="40" width="80" height="110" />
          <rect x="380" y="30" width="70" height="120" />
          <rect x="640" y="50" width="60" height="100" />
          <rect x="960" y="36" width="70" height="114" />
        </g>
        <path d="M0 30Q240 70 470 12" stroke={FOREST} strokeWidth="2" fill="none" />
        <path d="M478 12Q820 66 1100 14" stroke={FOREST} strokeWidth="2" fill="none" />
        <rect x="470" y="0" width="8" height="150" fill={FOREST} />
        <rect x="1100" y="0" width="8" height="150" fill={FOREST} />
        {/* Bungalow, lights off */}
        <path d="M40 80 130 40 222 80z" fill={FOREST} />
        <rect x="52" y="78" width="160" height="72" fill={FOREST} />
        <rect x="78" y="98" width="28" height="22" fill={DARK} />
        <rect x="158" y="98" width="28" height="22" fill={DARK} />
        {/* Storey building with tank */}
        <rect x="250" y="34" width="190" height="116" fill={FOREST} />
        <rect x="384" y="10" width="40" height="26" rx="6" fill={FOREST} />
        <rect x="270" y="52" width="34" height="28" fill={LIT} />
        <rect x="324" y="52" width="34" height="28" fill={DARK} />
        <rect x="378" y="52" width="34" height="28" fill={LIT} />
        <rect x="270" y="100" width="34" height="28" fill={DARK} />
        <rect x="324" y="100" width="34" height="28" fill={LIT} />
        <rect x="378" y="100" width="34" height="28" fill={DARK} />
        {/* Kiosk */}
        <rect x="520" y="86" width="110" height="64" fill={FOREST} />
        <rect x="532" y="98" width="86" height="28" fill={LIT} />
        <path d="M512 88h126l-10-18H522z" fill="#F28C28" />
        {/* Palm */}
        <path d="M740 150c4-40-6-76 6-112" stroke={FOREST} strokeWidth="9" fill="none" />
        <path
          d="M746 40q-36-20-70 4 36-14 70 0zM746 40q36-22 72-2-36-6-72 6zM746 40q-4-34 26-48-20 18-22 50zM746 40q-24-30-58-28 32 6 56 32z"
          fill={FOREST}
        />
        {/* House and block */}
        <path d="M820 90 900 54 984 90z" fill={FOREST} />
        <rect x="830" y="88" width="146" height="62" fill={FOREST} />
        <rect x="856" y="104" width="30" height="22" fill={LIT} />
        <rect x="1020" y="44" width="80" height="106" fill={FOREST} />
        <rect x="1034" y="60" width="22" height="20" fill={LIT} />
        <rect x="1066" y="96" width="22" height="20" fill={LIT} />
        <circle cx="1160" cy="84" r="40" fill={FOREST} />
        <rect x="1154" y="100" width="12" height="50" fill={FOREST} />
        <rect x="0" y="140" width="1200" height="10" fill={FOREST} />
      </svg>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Bricolage", data: display, weight: 800, style: "normal" },
        { name: "DM Sans", data: body, weight: 400, style: "normal" },
        { name: "DM Sans", data: bodyBold, weight: 700, style: "normal" },
      ],
    },
  );
}
