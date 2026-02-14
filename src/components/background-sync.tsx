"use client";

import { useEffect, useRef, useCallback } from "react";
import { smartSync } from "@/actions/sync";

/* eslint-disable no-undef */

const SYNC_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

export function BackgroundSync() {
  const isSyncing = useRef(false);

  const runSync = useCallback(async () => {
    if (isSyncing.current) return;
    isSyncing.current = true;

    try {
      const result = await smartSync();
      if (result.triggered) {
        console.log("[BackgroundSync] Sync triggered in background");
      }
    } catch (error) {
      console.warn("[BackgroundSync] Failed to check sync:", error);
    } finally {
      isSyncing.current = false;
    }
  }, []);

  useEffect(() => {
    // Run immediately on mount
    runSync();

    // Then run every 10 minutes
    const intervalId = setInterval(runSync, SYNC_INTERVAL_MS);

    // Also sync when tab regains focus (user returns after being away)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        runSync();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [runSync]);

  return null;
}
