"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Server, Sparkles, X } from "lucide-react";
import { warmApi } from "@/lib/api";

type Phase = "warming" | "ready" | "slow" | "down" | "hidden";

/**
 * Animated Render free-tier wake note.
 * Shown on first visit so evaluators know a cold start is expected, not a bug.
 */
export function ColdStartNote({
  className = "",
  autoHideReadyMs = 4200,
}: {
  className?: string;
  autoHideReadyMs?: number;
}) {
  const [phase, setPhase] = useState<Phase>("warming");
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let cancelled = false;
    warmApi().then((status) => {
      if (cancelled) return;
      if (status === "ok") setPhase("ready");
      else if (status === "slow") setPhase("slow");
      else setPhase("down");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (phase !== "ready") return;
    const t = window.setTimeout(() => {
      setVisible(false);
      setPhase("hidden");
    }, autoHideReadyMs);
    return () => window.clearTimeout(t);
  }, [phase, autoHideReadyMs]);

  if (!visible || phase === "hidden") return null;

  const copy = {
    warming: {
      title: "Waking the API",
      body: "Hosted on Render’s free tier — the first request after idle can take 30–60 seconds. We’re warming it now.",
    },
    ready: {
      title: "API is ready",
      body: "Backend responded. Workspace actions should feel snappy from here.",
    },
    slow: {
      title: "API woke slowly",
      body: "Still usable — Ask, Generate, or Transcribe may take a bit longer on the first try.",
    },
    down: {
      title: "API still waking",
      body: "If this is your first visit after idle, wait ~30s and refresh. Render free dynos sleep when unused.",
    },
  }[phase];

  return (
    <div
      className={`cold-note ${phase} ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <div className="cold-note-glow" aria-hidden />
      <div className="cold-note-orb" aria-hidden>
        {phase === "warming" || phase === "down" ? (
          <LoaderCircle className="spin" size={18} />
        ) : phase === "ready" ? (
          <Sparkles size={18} />
        ) : (
          <Server size={18} />
        )}
      </div>
      <div className="cold-note-copy">
        <strong>{copy.title}</strong>
        <p>{copy.body}</p>
        <small>Note · Render free tier · cold start</small>
      </div>
      <button
        type="button"
        className="cold-note-close"
        aria-label="Dismiss"
        onClick={() => {
          setVisible(false);
          setPhase("hidden");
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
