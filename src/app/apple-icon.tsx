import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Same mark as app/icon.svg, full-bleed so iOS can round the corners itself.
export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#10241B" }}>
      <svg width="180" height="180" viewBox="0 0 64 64">
        <path
          d="M32 11c11.6 0 21 8.7 21 19.5S43.6 50 32 50c-2.5 0-4.9-.4-7.1-1.1L14 53l3.2-9.3C13.3 40.2 11 35.6 11 30.5 11 19.7 20.4 11 32 11z"
          fill="#F28C28"
        />
        <circle cx="32" cy="30.5" r="8.5" fill="none" stroke="#10241B" strokeWidth="5.5" />
      </svg>
    </div>,
    size,
  );
}
