"use client";

import { useEffect, useRef, useCallback } from "react";
import { smartSync, getLastSyncTime } from "@/actions/sync";

/* eslint-disable no-undef */

const SYNC_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const POLL_INTERVAL_MS = 5 * 1000; // 5 seconds
const POLL_MAX_DURATION_MS = 90 * 1000; // 90 seconds max polling

export function BackgroundSync() {
  const isSyncing = useRef(false);

  const runSync = useCallback(async () => {
    if (isSyncing.current) return;
    isSyncing.current = true;

    try {
      const result = await smartSync();

      if (result.triggered) {
        // Sync was triggered in the background — poll to detect completion
        const beforeSync = result.lastSyncAt?.getTime() || 0;
        const pollStart = Date.now();

        const pollId = setInterval(async () => {
          // Stop polling after max duration
          if (Date.now() - pollStart > POLL_MAX_DURATION_MS) {
            clearInterval(pollId);
            // Emit anyway so UI refreshes with whatever data is available
            window.dispatchEvent(new CustomEvent("sync-complete"));
            return;
          }

          try {
            const current = await getLastSyncTime();
            const currentTime = current.lastSyncAt?.getTime() || 0;

            // Sync completed: lastSyncAt moved forward
            if (currentTime > beforeSync) {
              clearInterval(pollId);
              window.dispatchEvent(new CustomEvent("sync-complete"));
            }
          } catch {
            // Ignore polling errors
          }
        }, POLL_INTERVAL_MS);
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
