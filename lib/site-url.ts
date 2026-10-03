/**
 * The site's public address, used for share previews, the sitemap and canonical links.
 * Set NEXT_PUBLIC_SITE_URL in production (e.g. https://oya.ng). On Vercel it falls back
 * to the production domain automatically.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");

export const SITE_NAME = "Oya";
export const SITE_TITLE = "Oya · The AI agent for everyday life";
export const SITE_DESCRIPTION =
  "Everybody needs one person who knows everybody. Oya is that person, right inside WhatsApp: say what you need and it asks around, checks what's true today and sees it through. Free for everyone, starting in Nigeria.";
