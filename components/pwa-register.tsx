"use client";

import { useEffect } from "react";

/** Registers /sw.js service worker once on mount. Silent — no UI. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => {
        console.error({ msg: "SW registration failed", err });
      });
  }, []);

  return null;
}
