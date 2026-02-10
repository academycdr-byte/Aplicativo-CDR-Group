"use client";

import { useEffect, useRef } from "react";
import { smartSync } from "@/actions/sync";

export function BackgroundSync() {
  const hasFired = useRef(false);

  useEffect(() => {
    if (hasFired.current) return;
    hasFired.current = true;

    smartSync()
      .then((result) => {
        if (result.triggered) {
          console.log("[BackgroundSync] Sync triggered in background");
        }
      })
      .catch((error) => {
        console.warn("[BackgroundSync] Failed to check sync:", error);
      });
  }, []);

  return null;
}
