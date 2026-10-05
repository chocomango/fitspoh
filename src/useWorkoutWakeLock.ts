import { useEffect, useState } from "react";

export function useWorkoutWakeLock(enabled: boolean) {
  const [status, setStatus] = useState("");
  useEffect(() => {
    let stopped = false;
    let lock: WakeLockSentinel | undefined;
    let requesting = false;
    const acquire = async () => {
      if (
        stopped ||
        !enabled ||
        document.visibilityState !== "visible" ||
        lock ||
        requesting
      )
        return;
      if (!navigator.wakeLock?.request) {
        setStatus("Screen-awake mode is unavailable in this browser.");
        return;
      }
      requesting = true;
      try {
        const acquired = await navigator.wakeLock.request("screen");
        if (stopped || document.visibilityState !== "visible") {
          await acquired.release();
          return;
        }
        lock = acquired;
        setStatus("Screen stays awake while this workout is visible.");
        acquired.addEventListener("release", () => {
          if (lock === acquired) lock = undefined;
          if (!stopped && !lock)
            setStatus(
              "Screen-awake mode released by the browser. Your workout is still saved.",
            );
        });
      } catch {
        if (!stopped)
          setStatus(
            "Screen-awake mode could not be enabled. Your workout is still saved.",
          );
      } finally {
        requesting = false;
      }
    };
    const visibility = () => {
      if (document.visibilityState === "visible") void acquire();
      else if (lock)
        void lock
          .release()
          .then(() => {
            if (document.visibilityState === "visible") void acquire();
          })
          .catch(() => {});
    };
    setStatus("");
    if (enabled) void acquire();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", visibility);
      if (lock) void lock.release();
    };
  }, [enabled]);
  return status;
}
