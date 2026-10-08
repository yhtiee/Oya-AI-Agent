/**
 * Oya's WhatsApp line in international format, no "+" or spaces (e.g. "2348012345678").
 * While this is empty, every WhatsApp CTA falls back to the early-access form.
 */
export const WHATSAPP_NUMBER = "";

export const WHATSAPP_LIVE = WHATSAPP_NUMBER.length > 0;

export function whatsappLink(text = "Hi Oya") {
  return WHATSAPP_LIVE ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}` : "#early-access";
}

export const PRIMARY_CTA = WHATSAPP_LIVE
  ? { label: "Chat on WhatsApp", href: whatsappLink() }
  : { label: "Get early access", href: "#early-access" };

export const NAV_LINKS = [
  { label: "What Oya does", href: "#what-it-does" },
  { label: "What to ask", href: "#ask" },
  { label: "Why Oya", href: "#why" },
  { label: "Questions", href: "#faq" },
];
