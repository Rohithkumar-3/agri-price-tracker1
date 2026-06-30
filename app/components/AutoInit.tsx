"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Phase = "checking" | "empty-triggering" | "loading" | "ready" | "error";

export default function AutoInit() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [message, setMessage] = useState("Checking live data...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout>;

    async function checkStatus(): Promise<boolean> {
      const res = await fetch("/api/status");
      const json = await res.json();
      if (cancelled) return false;
      if (json.ready) {
        setPhase("ready");
        router.refresh();
        return true;
      }
      return false;
    }

    async function triggerBootstrap() {
      setPhase("empty-triggering");
      setMessage("No data yet — pulling live prices from Agmarknet for the first time. This runs once and takes a few minutes.");
      try {
        const res = await fetch("/api/admin/bootstrap");
        const json = await res.json();
        if (cancelled) return;
        if (!json.ok) {
          setPhase("error");
          setError(json.error ?? "Bootstrap failed — check Vercel function logs.");
          return;
        }
      } catch {
        if (!cancelled) {
          setPhase("error");
          setError("Couldn't reach the bootstrap endpoint. It may have timed out — refresh this page to retry, progress is saved incrementally.");
        }
        return;
      }
      if (!cancelled) {
        const done = await checkStatus();
        if (!done) setPhase("loading");
      }
    }

    async function init() {
      const ready = await checkStatus();
      if (ready || cancelled) return;
      await triggerBootstrap();
    }

    init();

    // Poll every 8s while data is still loading, in case bootstrap is still
    // running in the background or got cut off by a function timeout.
    pollTimer = setInterval(async () => {
      if (phase === "ready" || phase === "checking") return;
      const ready = await checkStatus();
      if (ready) clearInterval(pollTimer);
    }, 8000);

    return () => {
      cancelled = true;
      clearInterval(pollTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "ready" || phase === "checking") return null;

  return (
    <div className="tip-box mb-6">
      {phase === "error" ? (
        <>
          <b>⚠️ First-time setup hit a snag:</b> {error}
          <div className="text-xs text-muted mt-2">
            Refresh this page to retry — progress already made is saved, so retrying picks up where it left off.
          </div>
        </>
      ) : (
        <>
          <b>🌾 Setting up live data...</b> {message}
          <div className="text-xs text-muted mt-2">This page will refresh automatically once data is ready.</div>
        </>
      )}
    </div>
  );
}
