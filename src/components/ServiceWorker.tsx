"use client";

import { useEffect } from "react";

/* Registers public/sw.js in production builds (SPEC §14.8). Dev skips it so hot reload isn't cached. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
