"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  Calendar,
  Mic,
  MicOff,
  Radio,
  Square,
  Video,
  ArrowLeft,
  Sparkles,
  LoaderCircle,
} from "lucide-react";
import { request } from "@/lib/api";
import { fmt } from "@/lib/format";

type LiveLine = {
  id: string;
  speaker: string;
  start_seconds: number;
  content: string;
  interim?: boolean;
};

type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

function getSpeechRecognition(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

const PLATFORMS = [
  {
    id: "zoom",
    name: "Zoom",
    blurb: "Auto-join scheduled Zoom calls and stream audio to FireMe.",
  },
  {
    id: "meet",
    name: "Google Meet",
    blurb: "Calendar-aware Meet bot for live notes and action items.",
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    blurb: "Enterprise Teams capture with the same post-meeting workspace.",
  },
] as const;

const CALENDAR_MOCK = [
  { when: "Today · 2:00 PM", title: "Product sync", platform: "Zoom" },
  { when: "Today · 4:30 PM", title: "Design critique", platform: "Meet" },
  { when: "Tomorrow · 11:00 AM", title: "Customer interview", platform: "Teams" },
];

export function LiveHub({
  onSaved,
  onBack,
}: {
  onSaved: (meetingId: number) => Promise<void> | void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<"hub" | "capture">("hub");

  if (mode === "capture") {
    return (
      <LiveCapture
        onCancel={() => setMode("hub")}
        onSaved={onSaved}
      />
    );
  }

  return (
    <section className="live-hub">
      <header className="live-hub-head">
        <button type="button" className="crumb-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back to meetings
        </button>
        <div>
          <p className="live-kicker">
            <Radio size={14} /> Live
          </p>
          <h1>Capture the conversation as it happens</h1>
          <p className="muted">
            Browser live capture works now. Platform bots (Zoom / Meet / Teams)
            are staged as Coming soon — same post-meeting workspace after the
            call.
          </p>
        </div>
      </header>

      <div className="live-grid">
        <article className="live-card live-card-primary">
          <div className="live-card-icon">
            <Mic size={22} />
          </div>
          <h2>Browser live capture</h2>
          <p>
            Use your microphone for a live transcript in Chrome. When you stop,
            FireMe saves a meeting with timestamped lines you can Ask, export,
            and clip.
          </p>
          <button className="new-btn" onClick={() => setMode("capture")}>
            <Mic size={16} /> Start live capture
          </button>
          <small className="muted">
            Uses the Web Speech API in the browser — no Zoom bot required.
          </small>
        </article>

        {PLATFORMS.map((p) => (
          <article className="live-card" key={p.id}>
            <div className="live-card-icon soft">
              <Video size={20} />
            </div>
            <div className="live-card-top">
              <h2>{p.name}</h2>
              <span className="soon-pill">Coming soon</span>
            </div>
            <p>{p.blurb}</p>
            <button className="ghost-disabled" type="button" disabled>
              Connect {p.name}
            </button>
          </article>
        ))}
      </div>

      <section className="live-calendar">
        <div className="live-cal-head">
          <Calendar size={18} />
          <div>
            <h3>Calendar</h3>
            <p className="muted">
              Preview of scheduled joins — connect Google / Outlook later.
            </p>
          </div>
          <span className="soon-pill">Coming soon</span>
        </div>
        <ul>
          {CALENDAR_MOCK.map((row) => (
            <li key={row.title}>
              <div>
                <strong>{row.title}</strong>
                <small>
                  {row.when} · {row.platform}
                </small>
              </div>
              <button type="button" disabled className="ghost-disabled">
                Auto-join
              </button>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

function LiveCapture({
  onCancel,
  onSaved,
}: {
  onCancel: () => void;
  onSaved: (meetingId: number) => Promise<void> | void;
}) {
  const Speech = getSpeechRecognition();
  const [title, setTitle] = useState(
    () => `Live capture · ${new Date().toLocaleString()}`,
  );
  const [listening, setListening] = useState(false);
  const [lines, setLines] = useState<LiveLine[]>([]);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef<number | null>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const wantListen = useRef(false);
  const linesBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!listening) return;
    const id = window.setInterval(() => {
      if (startedAt.current != null) {
        setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [listening]);

  useEffect(() => {
    linesBox.current?.scrollTo({
      top: linesBox.current.scrollHeight,
      behavior: "smooth",
    });
  }, [lines, interim]);

  useEffect(() => {
    return () => {
      wantListen.current = false;
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const start = async () => {
    setError("");
    if (!Speech) {
      setError(
        "Live speech needs Chrome or Edge (Web Speech API). You can still type lines below, or use Import for a recording.",
      );
      return;
    }
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone permission denied. Allow mic access and try again.");
      return;
    }

    const rec = new Speech();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (ev) => {
      let nextInterim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const row = ev.results[i];
        const text = row[0].transcript.trim();
        if (!text) continue;
        if (row.isFinal) {
          const startSec =
            startedAt.current != null
              ? Math.max(0, Math.floor((Date.now() - startedAt.current) / 1000))
              : 0;
          setLines((prev) => [
            ...prev,
            {
              id: `${Date.now()}-${prev.length}`,
              speaker: "Speaker 1",
              start_seconds: startSec,
              content: text,
            },
          ]);
          setInterim("");
        } else {
          nextInterim = text;
        }
      }
      if (nextInterim) setInterim(nextInterim);
    };
    rec.onerror = (ev) => {
      if (ev.error === "aborted" || ev.error === "no-speech") return;
      setError(`Speech error: ${ev.error}`);
    };
    rec.onend = () => {
      if (wantListen.current) {
        try {
          rec.start();
        } catch {
          setListening(false);
        }
      } else {
        setListening(false);
      }
    };

    recRef.current = rec;
    wantListen.current = true;
    startedAt.current = Date.now();
    setElapsed(0);
    setListening(true);
    rec.start();
  };

  const stop = () => {
    wantListen.current = false;
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
    setInterim("");
  };

  const addManual = (e: FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const input = form.elements.namedItem("line") as HTMLInputElement;
    const text = input.value.trim();
    if (!text) return;
    const startSec =
      startedAt.current != null
        ? Math.max(0, Math.floor((Date.now() - startedAt.current) / 1000))
        : lines.length * 8;
    setLines((prev) => [
      ...prev,
      {
        id: `${Date.now()}-m`,
        speaker: "Speaker 1",
        start_seconds: startSec,
        content: text,
      },
    ]);
    input.value = "";
  };

  const save = async () => {
    if (!lines.length) {
      setError("Capture or type at least one transcript line before saving.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      stop();
      const created = await (
        await request("/meetings", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: title.trim() || "Live capture",
            duration_seconds: Math.max(
              elapsed,
              lines[lines.length - 1]?.start_seconds || 0,
            ),
            participants: ["Speaker 1"],
            summary: "",
            topics: ["Live capture"],
          }),
        })
      ).json();
      for (const line of lines) {
        await request(`/meetings/${created.id}/segments`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            speaker: line.speaker,
            start_seconds: line.start_seconds,
            content: line.content,
          }),
        });
      }
      await onSaved(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save meeting");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="live-capture">
      <header className="live-capture-head">
        <button type="button" className="crumb-link" onClick={onCancel}>
          <ArrowLeft size={16} /> Live hub
        </button>
        <div className={`live-pulse ${listening ? "on" : ""}`}>
          <span />
          {listening ? "Listening" : "Idle"} · {fmt(elapsed)}
        </div>
      </header>

      <label className="live-title-field">
        Meeting title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={saving}
        />
      </label>

      <div className="live-controls">
        {!listening ? (
          <button className="new-btn" type="button" onClick={start}>
            <Mic size={16} /> Start microphone
          </button>
        ) : (
          <button className="danger-btn" type="button" onClick={stop}>
            <MicOff size={16} /> Stop listening
          </button>
        )}
        <button
          className="new-btn"
          type="button"
          onClick={save}
          disabled={saving || !lines.length}
        >
          {saving ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <Square size={16} />
          )}
          Save as meeting
        </button>
        <span className="muted live-hint">
          <Sparkles size={14} /> Chrome / Edge recommended for live speech
        </span>
      </div>

      {error && (
        <p className="process-error" role="alert">
          {error}
        </p>
      )}

      <div className="live-transcript" ref={linesBox}>
        {!lines.length && !interim && (
          <p className="muted">
            Press start and speak — final lines appear here with timestamps.
          </p>
        )}
        {lines.map((line) => (
          <div className="live-line" key={line.id}>
            <time>{fmt(line.start_seconds)}</time>
            <div>
              <strong>{line.speaker}</strong>
              <p>{line.content}</p>
            </div>
          </div>
        ))}
        {interim && (
          <div className="live-line interim">
            <time>…</time>
            <div>
              <strong>Speaker 1</strong>
              <p>{interim}</p>
            </div>
          </div>
        )}
      </div>

      <form className="live-manual" onSubmit={addManual}>
        <input
          name="line"
          placeholder="Or type a line manually…"
          disabled={saving}
        />
        <button className="new-btn" type="submit" disabled={saving}>
          Add line
        </button>
      </form>
    </section>
  );
}
