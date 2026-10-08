/**
 * Where to go after sign-in. Only same-site relative paths are allowed, so a crafted
 * `?next=` link can't bounce someone to another site (open redirect).
 */
export function safeNext(next: unknown, fallback = "/app"): string {
  if (typeof next !== "string" || next.length > 512) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;
  return next;
}
