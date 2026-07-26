"use client";
import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
  useUser,
} from "@clerk/nextjs";
import {
  ArrowRight,
  Bookmark,
  Bot,
  Check,
  ChevronDown,
  Clock3,
  Download,
  FileAudio,
  FileText,
  Highlighter,
  Link2,
  LoaderCircle,
  Menu,
  MessageSquare,
  Moon,
  Pencil,
  Pin,
  Play,
  Plus,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  Users,
  X,
  Zap,
} from "lucide-react";
import { ColdStartNote } from "@/components/ColdStartNote";
import type { Action, Meeting, Note, Segment } from "@/lib/types";
import { API, bindRequestTiming, bindTokenGetter, getAccessToken, request } from "@/lib/api";
import { date, fmt, segmentEnd } from "@/lib/format";

function MediaPlayer({
  meeting,
  seek,
  setSeek,
  clipPlay,
}: {
  meeting: Meeting;
  seek: number;
  setSeek: (n: number) => void;
  clipPlay?: { start: number; end: number; token: number } | null;
}) {
  // Backend returns "/api/meetings/:id/media"; request() already prefixes NEXT_PUBLIC_API_URL (.../api).
  const mediaPath = (meeting.media_url || "").replace(/^\/api/, ""),
    media = useRef<HTMLMediaElement>(null),
    clipEndRef = useRef<number | null>(null),
    [duration, setDuration] = useState(meeting.duration_seconds || 1),
    [src, setSrc] = useState(""),
    [mediaLoading, setMediaLoading] = useState(false),
    [mediaError, setMediaError] = useState(""),
    [playing, setPlaying] = useState(false);
  useEffect(() => {
    setDuration(Math.max(meeting.duration_seconds || 1, 1));
    setPlaying(false);
    clipEndRef.current = null;
  }, [meeting.id, meeting.duration_seconds]);
  useEffect(() => {
    if (!mediaPath) {
      setSrc("");
      setMediaError("");
      setMediaLoading(false);
      return;
    }
    let active = true;
    setMediaLoading(true);
    setMediaError("");
    setSrc("");
    (async () => {
      try {
        const token = await getAccessToken();
        if (!active) return;
        if (!token) {
          setMediaError("Sign in again to load this recording.");
          return;
        }
        // Stream via query token so <video>/<audio> can seek without downloading the full blob first.
        setSrc(
          `${API}${mediaPath}?access_token=${encodeURIComponent(token)}`,
        );
      } catch {
        if (active) setMediaError("Could not authorize media playback.");
      } finally {
        if (active) setMediaLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [mediaPath]);
  useEffect(() => {
    if (media.current && Math.abs(media.current.currentTime - seek) > 0.8)
      media.current.currentTime = seek;
  }, [seek]);
  useEffect(() => {
    if (!clipPlay) return;
    clipEndRef.current = clipPlay.end;
    setSeek(clipPlay.start);
    setPlaying(true);
    const el = media.current;
    if (el) {
      el.currentTime = clipPlay.start;
      void el.play().catch(() => undefined);
    }
  }, [clipPlay, setSeek]);
  const seekRef = useRef(seek);
  seekRef.current = seek;
  useEffect(() => {
    if (src || !playing) return;
    const id = window.setInterval(() => {
      const next = seekRef.current + 1;
      const stopAt = clipEndRef.current;
      if ((stopAt != null && next >= stopAt) || next >= duration) {
        setPlaying(false);
        clipEndRef.current = null;
        setSeek(stopAt != null ? stopAt : duration);
      } else {
        setSeek(next);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [playing, src, duration, setSeek]);
  function onTimeUpdate(current: number) {
    const t = Math.floor(current);
    setSeek(t);
    const stopAt = clipEndRef.current;
    if (stopAt != null && current >= stopAt) {
      clipEndRef.current = null;
      setPlaying(false);
      media.current?.pause();
    }
  }
  return (
    <div className="player">
      {src ? (
        <>
          {meeting.media_type?.startsWith("video/") ? (
            <video
              ref={(node) => {
                media.current = node;
              }}
              controls
              src={src}
              onLoadedMetadata={(e) =>
                setDuration(
                  Math.ceil(e.currentTarget.duration) ||
                    meeting.duration_seconds ||
                    1,
                )
              }
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onError={() =>
                setMediaError(
                  "Recording failed to play. Token may have expired — reopen the meeting.",
                )
              }
              onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
            />
          ) : (
            <audio
              ref={(node) => {
                media.current = node;
              }}
              controls
              src={src}
              onLoadedMetadata={(e) =>
                setDuration(
                  Math.ceil(e.currentTarget.duration) ||
                    meeting.duration_seconds ||
                    1,
                )
              }
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onError={() =>
                setMediaError(
                  "Recording failed to play. Token may have expired — reopen the meeting.",
                )
              }
              onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
            />
          )}
        </>
      ) : (
        <div className="no-media">
          <FileAudio size={24} />
          <div>
            <strong>
              {mediaLoading
                ? "Loading recording…"
                : mediaError
                  ? "Recording unavailable"
                  : meeting.media_url
                    ? "Preparing player…"
                    : "Placeholder player"}
            </strong>
            <span>
              {mediaError ||
                (meeting.media_url
                  ? "Fetching authorized media stream…"
                  : "No recording attached. Use the seek bar or click a transcript timestamp — active lines stay in sync.")}
            </span>
          </div>
          {!meeting.media_url && (
            <button
              className="new-btn"
              onClick={() => setPlaying((value) => !value)}
            >
              {playing ? "Pause" : "Play"}
            </button>
          )}
        </div>
      )}
      <div className="player-controls">
        <span>{fmt(seek)}</span>
        <input
          aria-label="Seek recording"
          type="range"
          min="0"
          max={Math.max(duration, 1)}
          value={Math.min(seek, duration || 0)}
          onChange={(e) => {
            clipEndRef.current = null;
            setSeek(+e.target.value);
            setPlaying(false);
          }}
        />
        <span>{fmt(duration)}</span>
      </div>
    </div>
  );
}
function Summary({
  meeting,
  busy,
  onGenerate,
  onTranscribe,
  onSeek,
  onToggle,
  onEdit,
  onDelete,
  onRefresh,
}: {
  meeting: Meeting;
  busy: boolean;
  onGenerate: () => void;
  onTranscribe: () => void;
  onSeek: (seconds: number) => void;
  onToggle: (a: Action) => void;
  onEdit: (a: Action) => void;
  onDelete: (a: Action) => void;
  onRefresh: () => Promise<void>;
}) {
  const [text, setText] = useState(""),
    [owner, setOwner] = useState("");
  async function add(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    await request(`/meetings/${meeting.id}/actions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, owner: owner || "Unassigned" }),
    });
    setText("");
    setOwner("");
    await onRefresh();
  }
  return (
    <div className="summary-layout">
      <article>
        <section className="ai-note">
          <div className="ai-title">
            <span>
              <Bot size={17} />
            </span>
            <div>
              <strong>AI Summary</strong>
              <small>
                {meeting.processing_status === "ready"
                  ? "Ready"
                  : "Status: " + meeting.processing_status.replaceAll("_", " ")}
              </small>
            </div>
            {meeting.media_url &&
            (!meeting.segments?.length ||
              meeting.processing_status === "transcription_failed" ||
              meeting.processing_status === "awaiting_transcription") ? (
              <button
                className="new-btn"
                onClick={onTranscribe}
                disabled={busy || meeting.processing_status === "transcribing"}
              >
                {busy || meeting.processing_status === "transcribing" ? (
                  <LoaderCircle className="spin" size={15} />
                ) : (
                  <FileAudio size={15} />
                )}
                {meeting.processing_status === "transcription_failed"
                  ? "Retry transcribe"
                  : "Transcribe"}
              </button>
            ) : (
              <button
                className="new-btn"
                onClick={onGenerate}
                disabled={busy || !meeting.segments?.length}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={15} />
                ) : (
                  <Bot size={15} />
                )}
                Generate
              </button>
            )}
          </div>
          {meeting.processing_error && (
            <p className="process-error" role="alert">
              {meeting.processing_error}
            </p>
          )}
          {meeting.processing_status === "transcribing" && (
            <p className="process-hint">
              Transcription is running in the background. Large files can take a
              minute — keep this meeting open.
            </p>
          )}
          <p>
            {meeting.summary ||
              "Add a transcript, then generate AI insights with the server-configured provider."}
          </p>
        </section>
        <section className="topics">
          <h3>Key topics</h3>
          <div>
            {meeting.topics.length ? (
              meeting.topics.map((t) => <span key={t}>{t}</span>)
            ) : (
              <p className="muted">No topics generated yet.</p>
            )}
          </div>
        </section>
        <TalkTime segments={meeting.segments} />
        <section className="chapters">
          <h3>Chapters</h3>
          {meeting.chapters.length ? (
            meeting.chapters.map((c) => (
              <button
                key={`${c.title}${c.start_seconds}`}
                className="chapter"
                onClick={() => onSeek(c.start_seconds)}
              >
                <time>{fmt(c.start_seconds)}</time>
                <div>
                  <strong>{c.title}</strong>
                  <p>{c.summary}</p>
                </div>
              </button>
            ))
          ) : (
            <p className="muted">Generate insights to create chapters.</p>
          )}
        </section>
      </article>
      <article className="action-panel">
        <h3>
          Action items{" "}
          <em>{meeting.actions?.filter((x) => !x.completed).length || 0}</em>
        </h3>
        {meeting.actions?.map((a) => (
          <div className={`action ${a.completed ? "done" : ""}`} key={a.id}>
            <button className="checkbox" onClick={() => onToggle(a)}>
              {a.completed && <Check size={14} />}
            </button>
            <div>
              <strong>{a.text}</strong>
              <small>{a.owner}</small>
            </div>
            <div className="action-buttons">
              <button aria-label="Edit action" onClick={() => onEdit(a)}>
                <Pencil size={14} />
              </button>
              <button aria-label="Delete action" onClick={() => onDelete(a)}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        <form className="task-form" onSubmit={add}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add an action item"
          />
          <input
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="Owner"
          />
          <button className="new-btn">
            <Plus size={15} />
            Add
          </button>
        </form>
      </article>
    </div>
  );
}
function Ask({
  meeting,
  flash,
  onAsked,
}: {
  meeting: Meeting;
  flash: (s: string) => void;
  onAsked: (row: {
    id: number;
    question: string;
    answer: string;
    created_at?: string | null;
  }) => void;
}) {
  const [question, setQuestion] = useState(""),
    [busy, setBusy] = useState(false),
    threadRef = useRef<HTMLDivElement>(null),
    history = meeting.questions || [];
  useEffect(() => {
    threadRef.current?.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [history.length, busy]);
  async function ask(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    setBusy(true);
    try {
      const r = await request(`/meetings/${meeting.id}/ask`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const row = await r.json();
      onAsked(row);
      setQuestion("");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Question failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="ask-panel">
      <div className="ask-icon">
        <Bot size={22} />
      </div>
      <h3>Ask about this meeting</h3>
      <p>Chat with FireMe using only this meeting’s transcript.</p>
      <div className="ask-thread" ref={threadRef}>
        {history.length === 0 && !busy && (
          <p className="muted ask-empty">
            Ask anything — decisions, owners, follow-ups. Answers stay in this
            thread.
          </p>
        )}
        {history.map((item) => (
          <div key={item.id} className="ask-turn">
            <article className="ask-bubble user">
              <strong>You</strong>
              <p>{item.question}</p>
            </article>
            <article className="ask-bubble bot">
              <strong>FireMe</strong>
              <p>{item.answer}</p>
            </article>
          </div>
        ))}
        {busy && (
          <article className="ask-bubble bot pending">
            <strong>FireMe</strong>
            <p>
              <LoaderCircle className="spin" size={14} /> Thinking…
            </p>
          </article>
        )}
      </div>
      <form onSubmit={ask} className="ask-compose">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What did we decide about the roadmap?"
          disabled={busy || !meeting.segments?.length}
        />
        <button
          className="new-btn"
          disabled={busy || !question.trim() || !meeting.segments?.length}
        >
          {busy ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <Bot size={16} />
          )}
          Ask FireMe
        </button>
      </form>
    </section>
  );
}
function MeetingForm({
  meeting,
  onClose,
  onSaved,
}: {
  meeting?: Meeting;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState(meeting?.title || ""),
    [people, setPeople] = useState(meeting?.participants.join(", ") || ""),
    [occurred, setOccurred] = useState(
      meeting
        ? meeting.occurred_at.slice(0, 16)
        : new Date().toISOString().slice(0, 16),
    ),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await request(meeting ? `/meetings/${meeting.id}` : "/meetings", {
        method: meeting ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          participants: people
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
          occurred_at: new Date(occurred).toISOString(),
          duration_seconds: meeting?.duration_seconds || 0,
          summary: meeting?.summary || "",
          topics: meeting?.topics || [],
        }),
      });
      await onSaved();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={meeting ? "Edit meeting" : "New meeting"} close={onClose}>
      <form onSubmit={submit}>
        <label>
          Meeting title
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          Participants <small>comma separated</small>
          <input
            value={people}
            onChange={(e) => setPeople(e.target.value)}
            placeholder="Maya, Alex"
          />
        </label>
        <label>
          Date and time
          <input
            type="datetime-local"
            value={occurred}
            onChange={(e) => setOccurred(e.target.value)}
          />
        </label>
        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="new-btn" disabled={busy}>
            {busy ? "Saving…" : "Save meeting"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
function ImportForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (m: Meeting) => Promise<void>;
}) {
  const [title, setTitle] = useState(""),
    [people, setPeople] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) return setError("Choose a recording or transcript file.");
    setBusy(true);
    setError("");
    try {
      const f = new FormData();
      f.append("title", title);
      f.append("participants", people);
      f.append("file", file);
      const r = await request("/meetings/import", { method: "POST", body: f });
      await onSaved(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Import a meeting" close={onClose}>
      <form onSubmit={submit}>
        <label>
          Meeting title
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Customer call"
          />
        </label>
        <label>
          Participants
          <input
            value={people}
            onChange={(e) => setPeople(e.target.value)}
            placeholder="Maya, Alex"
          />
        </label>
        <label className="file-field">
          <Upload size={18} />
          <span>
            {file
              ? file.name
              : "Choose .txt, .vtt, .srt, .json, audio, or video"}
          </span>
          <input
            required
            type="file"
            accept=".txt,.vtt,.srt,.json,audio/*,video/*"
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setFile(e.target.files?.[0] || null)
            }
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="new-btn" disabled={busy}>
            {busy ? "Importing…" : "Import"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
function SegmentForm({
  meetingId,
  segment,
  onClose,
  onSaved,
}: {
  meetingId: number;
  segment: Segment | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [speaker, setSpeaker] = useState(segment?.speaker || ""),
    [time, setTime] = useState(String(segment?.start_seconds || 0)),
    [content, setContent] = useState(segment?.content || "");
  async function submit(e: FormEvent) {
    e.preventDefault();
    await request(
      segment ? `/segments/${segment.id}` : `/meetings/${meetingId}/segments`,
      {
        method: segment ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          speaker: speaker || "Speaker 1",
          start_seconds: +time,
          content,
        }),
      },
    );
    await onSaved();
  }
  return (
    <Modal
      title={segment ? "Edit transcript line" : "Add transcript line"}
      close={onClose}
    >
      <form onSubmit={submit}>
        <label>
          Speaker
          <input value={speaker} onChange={(e) => setSpeaker(e.target.value)} />
        </label>
        <label>
          Timestamp <small>seconds</small>
          <input
            type="number"
            min="0"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </label>
        <label>
          Text
          <textarea
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </label>
        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="new-btn">Save line</button>
        </footer>
      </form>
    </Modal>
  );
}
function PasteTranscriptForm({
  meetingId,
  onClose,
  onSaved,
}: {
  meetingId: number;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [content, setContent] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request(`/meetings/${meetingId}/paste-transcript`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      });
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not import transcript");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Paste transcript" close={onClose}>
      <form onSubmit={submit}>
        <label>
          Transcript <small>Use optional [MM:SS] Speaker: text lines.</small>
          <textarea
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="[00:00] Maya: Welcome everyone…"
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="new-btn" disabled={busy}>
            {busy ? "Importing…" : "Import transcript"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
function ActionForm({
  action,
  onClose,
  onSaved,
}: {
  action: Action;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [text, setText] = useState(action.text),
    [owner, setOwner] = useState(action.owner),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await request(`/actions/${action.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, owner }),
      });
      await onSaved();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Edit action item" close={onClose}>
      <form onSubmit={submit}>
        <label>
          Task
          <input
            required
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <label>
          Owner
          <input value={owner} onChange={(e) => setOwner(e.target.value)} />
        </label>
        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="new-btn" disabled={busy}>
            {busy ? "Saving…" : "Save action"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-backdrop">
      <section className="modal">
        <header className="modal-head">
          <h2>{title}</h2>
          <button onClick={close}>
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function highlight(text: string, q: string) {
  if (!q) return text;
  const p = text.split(
    new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, `ig`),
  );
  return (
    <>
      {p.map((x, i) =>
        x.toLowerCase() === q.toLowerCase() ? <mark key={i}>{x}</mark> : x,
      )}
    </>
  );
}

function speakerHue(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

function SpeakerAvatar({ name, size = 28 }: { name: string; size?: number }) {
  const hue = speakerHue(name || "?");
  const initials = (name || "?")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className="speaker-avatar"
      style={{
        width: size,
        height: size,
        fontSize: size < 24 ? 9 : 11,
        background: `hsl(${hue} 55% 42%)`,
      }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

function TalkTime({ segments }: { segments?: Segment[] }) {
  const rows = useMemo(() => {
    const list = segments || [];
    if (!list.length) return [] as { speaker: string; seconds: number; pct: number }[];
    const totals = new Map<string, number>();
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      const next = list[i + 1];
      const dur = Math.max(
        4,
        (next ? next.start_seconds : s.start_seconds + 12) - s.start_seconds,
      );
      totals.set(s.speaker, (totals.get(s.speaker) || 0) + dur);
    }
    const sum = Array.from(totals.values()).reduce((a, b) => a + b, 0) || 1;
    return Array.from(totals.entries())
      .map(([speaker, seconds]) => ({
        speaker,
        seconds,
        pct: (seconds / sum) * 100,
      }))
      .sort((a, b) => b.seconds - a.seconds);
  }, [segments]);
  if (!rows.length) return null;
  return (
    <section className="talk-time">
      <h3>Talk time</h3>
      <div className="talk-bars">
        {rows.map((r) => (
          <div className="talk-row" key={r.speaker}>
            <SpeakerAvatar name={r.speaker} size={22} />
            <div className="talk-meta">
              <div className="talk-label">
                <strong>{r.speaker}</strong>
                <span>{fmt(r.seconds)}</span>
              </div>
              <div className="talk-track">
                <i
                  style={{
                    width: `${Math.max(4, r.pct)}%`,
                    background: `hsl(${speakerHue(r.speaker)} 55% 48%)`,
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Workspace() {
  const { getToken, isLoaded, userId } = useAuth();
  const { user } = useUser();
  const [meetings, setMeetings] = useState<Meeting[]>([]),
    [selected, setSelected] = useState<Meeting | null>(null),
    [q, setQ] = useState(""),
    [participant, setParticipant] = useState(""),
    [topic, setTopic] = useState(""),
    [sort, setSort] = useState("recent"),
    [dateFrom, setDateFrom] = useState(""),
    [dateTo, setDateTo] = useState(""),
    [tab, setTab] = useState<"summary" | "transcript" | "ask" | "clips">("summary"),
    [seek, setSeek] = useState(0),
    [clipPlay, setClipPlay] = useState<{
      start: number;
      end: number;
      token: number;
    } | null>(null),
    [find, setFind] = useState(""),
    [dark, setDark] = useState(false),
    [modal, setModal] = useState<
      | "create"
      | "import"
      | "edit"
      | "segment"
      | "paste"
      | "action"
      | "settings"
      | "export"
      | "note"
      | null
    >(null),
    [noteKind, setNoteKind] = useState<"comment" | "highlight" | "soundbite">(
      "comment",
    ),
    [noteSegment, setNoteSegment] = useState<Segment | null>(null),
    [noteBody, setNoteBody] = useState(""),
    [editing, setEditing] = useState<Segment | null>(null),
    [editingAction, setEditingAction] = useState<Action | null>(null),
    [tokenReady, setTokenReady] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [peopleOptions, setPeopleOptions] = useState<string[]>([]),
    [topicOptions, setTopicOptions] = useState<string[]>([]),
    [apiNotice, setApiNotice] = useState(""),
    [listLoading, setListLoading] = useState(true),
    [pinnedId, setPinnedId] = useState<number | null>(null),
    [mobilePane, setMobilePane] = useState<"list" | "detail">("list"),
    [mobileNav, setMobileNav] = useState(false),
    linesRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const saved = window.localStorage.getItem("fireme-theme");
    const next = saved === "dark";
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
  }, []);
  useEffect(() => {
    bindRequestTiming({
      onSlow: () =>
        setApiNotice(
          "Still waking the Render API — large first actions can take 30–60s.",
        ),
      onSettled: (_ms, ok) => {
        if (ok) setApiNotice("");
      },
    });
    return () => bindRequestTiming({ onSlow: null, onSettled: null });
  }, []);
  useEffect(() => {
    const raw = window.localStorage.getItem("fireme-pin");
    if (raw) setPinnedId(Number(raw) || null);
  }, []);
  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    window.localStorage.setItem("fireme-theme", next ? "dark" : "light");
  };
  const displayName =
    user?.fullName || user?.primaryEmailAddress?.emailAddress || "You";
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const flash = (s: string) => {
    setNotice(s);
    setTimeout(() => setNotice(""), 3200);
  };
  const load = async () => {
    if (!userId || !tokenReady) return;
    setListLoading(true);
    try {
      const params = new URLSearchParams({ query: q, sort });
      if (participant) params.set("participant", participant);
      if (topic) params.set("topic", topic);
      if (dateFrom) params.set("date_from", `${dateFrom}T00:00:00`);
      if (dateTo) params.set("date_to", `${dateTo}T23:59:59.999`);
      const data: Meeting[] = await (await request(`/meetings?${params}`)).json();
      setMeetings(data);
      setPeopleOptions((prev) => {
        const names = new Set(prev);
        data.forEach((m) => m.participants.forEach((p) => names.add(p)));
        return Array.from(names).sort();
      });
      setTopicOptions((prev) => {
        const names = new Set(prev);
        data.forEach((m) => m.topics.forEach((t) => names.add(t)));
        return Array.from(names).sort();
      });
      if (!selected && data.length) {
        const paramsUrl = new URLSearchParams(window.location.search);
        const deepId = Number(paramsUrl.get("meeting") || 0);
        const pin =
          (deepId && data.find((m) => m.id === deepId)?.id) ||
          pinnedId ||
          data.find((m) => m.title === "Product roadmap sync")?.id ||
          data[0].id;
        await open(pin);
        const t = Number(paramsUrl.get("t") || 0);
        if (t > 0) {
          setSeek(t);
          setTab("transcript");
        }
      }
    } catch (e) {
      flash(e instanceof Error ? e.message : "Could not load meetings");
    } finally {
      setListLoading(false);
    }
  };
  const open = async (id: number) => {
    try {
      setSelected(await (await request(`/meetings/${id}`)).json());
      setSeek(0);
      setClipPlay(null);
      setFind("");
      setMobilePane("detail");
      const url = new URL(window.location.href);
      url.searchParams.set("meeting", String(id));
      url.searchParams.delete("t");
      window.history.replaceState({}, "", url.toString());
    } catch (e) {
      flash(e instanceof Error ? e.message : "Could not open meeting");
    }
  };
  const togglePin = (id: number) => {
    const next = pinnedId === id ? null : id;
    setPinnedId(next);
    if (next) window.localStorage.setItem("fireme-pin", String(next));
    else window.localStorage.removeItem("fireme-pin");
    flash(next ? "Pinned for quick demo" : "Unpinned");
  };
  const copyTimestampLink = async (seconds: number) => {
    if (!selected) return;
    const url = new URL(window.location.href);
    url.searchParams.set("meeting", String(selected.id));
    url.searchParams.set("t", String(seconds));
    try {
      await navigator.clipboard.writeText(url.toString());
      flash(`Copied link at ${fmt(seconds)}`);
    } catch {
      flash("Could not copy link");
    }
  };
  const shareMeeting = async () => {
    if (!selected) return;
    const url = new URL(window.location.href);
    url.searchParams.set("meeting", String(selected.id));
    try {
      await navigator.clipboard.writeText(url.toString());
      flash("Meeting link copied");
    } catch {
      flash("Could not copy link");
    }
  };
  useEffect(() => {
    let active = true;
    setTokenReady(false);
    if (userId) {
      bindTokenGetter(getToken);
      getToken().then((token) => {
        if (active) {
          setTokenReady(Boolean(token));
        }
      });
    }
    return () => {
      active = false;
      bindTokenGetter(null);
    };
  }, [getToken, userId]);
  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [q, participant, topic, sort, dateFrom, dateTo, userId, tokenReady]);
  useEffect(() => {
    if (!selected || selected.processing_status !== "transcribing") return;
    const id = window.setInterval(() => {
      open(selected.id);
    }, 2500);
    return () => window.clearInterval(id);
  }, [selected?.id, selected?.processing_status]);
  const refresh = async () => {
    if (selected) await open(selected.id);
    await load();
  };
  const filtered = useMemo(
    () =>
      selected?.segments?.filter((s) =>
        `${s.speaker} ${s.content}`.toLowerCase().includes(find.toLowerCase()),
      ) || [],
    [selected, find],
  );
  const orderedMeetings = useMemo(() => {
    if (!pinnedId) return meetings;
    return [...meetings].sort((a, b) => {
      if (a.id === pinnedId) return -1;
      if (b.id === pinnedId) return 1;
      return 0;
    });
  }, [meetings, pinnedId]);
  useEffect(() => {
    if (!find.trim()) return;
    const hit = linesRef.current?.querySelector(".segment.hit");
    hit?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [find, filtered]);
  async function generate() {
    if (!selected) return;
    setBusy(true);
    try {
      const r = await request(`/meetings/${selected.id}/generate-insights`, {
        method: "POST",
      });
      setSelected(await r.json());
      flash("AI insights generated");
    } catch (e) {
      flash(e instanceof Error ? e.message : "AI processing failed");
    } finally {
      setBusy(false);
    }
  }
  async function transcribe() {
    if (!selected) return;
    setBusy(true);
    try {
      const r = await request(`/meetings/${selected.id}/transcribe`, {
        method: "POST",
      });
      setSelected(await r.json());
      flash("Transcription started — this runs in the background");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Transcription failed");
    } finally {
      setBusy(false);
    }
  }
  async function saveNote() {
    if (!selected) return;
    try {
      await request(`/meetings/${selected.id}/notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: noteKind,
          body: noteBody || (noteKind === "highlight" ? noteSegment?.content || "" : ""),
          segment_id: noteSegment?.id ?? null,
          start_seconds: noteSegment?.start_seconds ?? seek,
          end_seconds:
            noteKind === "soundbite"
              ? (noteSegment ? noteSegment.start_seconds + 30 : seek + 30)
              : null,
        }),
      });
      setModal(null);
      setNoteBody("");
      await refresh();
      flash(`${noteKind} saved`);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Could not save note");
    }
  }
  async function removeNote(note: Note) {
    if (!window.confirm("Delete this note?")) return;
    await request(`/notes/${note.id}`, { method: "DELETE" });
    await refresh();
  }
  async function destroy() {
    if (
      !selected ||
      !window.confirm(`Delete “${selected.title}”? This cannot be undone.`)
    )
      return;
    try {
      await request(`/meetings/${selected.id}`, { method: "DELETE" });
      setSelected(null);
      await load();
      flash("Meeting deleted");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Delete failed");
    }
  }
  async function toggle(a: Action) {
    try {
      await request(`/actions/${a.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ completed: !a.completed }),
      });
      await refresh();
    } catch (e) {
      flash(e instanceof Error ? e.message : "Update failed");
    }
  }
  async function removeAction(a: Action) {
    if (!window.confirm(`Delete “${a.text}”?`)) return;
    try {
      await request(`/actions/${a.id}`, { method: "DELETE" });
      await refresh();
      flash("Action deleted");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Delete failed");
    }
  }
  async function removeSegment(s: Segment) {
    if (!window.confirm("Delete this transcript segment?")) return;
    await request(`/segments/${s.id}`, { method: "DELETE" });
    await refresh();
  }
  async function downloadExport(format: "markdown" | "txt" | "pdf") {
    if (!selected) return;
    try {
      const response = await request(
        `/meetings/${selected.id}/export?format=${format}`,
      );
      const href = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = href;
      const ext = format === "markdown" ? "md" : format;
      link.download = `${selected.title}.${ext}`;
      link.click();
      URL.revokeObjectURL(href);
      setModal(null);
      flash(`Exported as ${ext.toUpperCase()}`);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Export failed");
    }
  }
  if (!isLoaded) return <div className="empty">Loading your workspace…</div>;
  if (!userId)
    return (
      <main className="empty">
        <div>
          <h2>Sign in to open your workspace</h2>
          <p>Your meetings are private to your account.</p>
          <SignInButton>
            <button className="new-btn">Sign in</button>
          </SignInButton>
        </div>
      </main>
    );
  return (
    <>
      <ColdStartNote className="cold-note-workspace" />
      {apiNotice && (
        <div className="api-banner" role="status">
          <LoaderCircle className="spin" size={14} />
          <span>{apiNotice}</span>
          <button type="button" onClick={() => setApiNotice("")}>
            Dismiss
          </button>
        </div>
      )}
      <main className={`app-shell ${mobilePane === "detail" ? "show-detail" : "show-list"}`}>
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand">
          <span className="brand-mark">✦</span>fireme<span>.ai</span>
          <button
            className="mobile-only sidebar-close"
            aria-label="Close menu"
            onClick={() => setMobileNav(false)}
          >
            <X size={18} />
          </button>
        </div>
        <button className="record-btn" onClick={() => setModal("import")}>
          <Upload size={16} /> Import recording or transcript
        </button>
        <nav>
          <button className="nav-item active">
            <FileText size={18} />
            My meetings
          </button>
          <button className="nav-item" onClick={() => setModal("settings")}>
            <Settings size={18} />
            Settings
            <b>Soon</b>
          </button>
          <button className="nav-item" onClick={toggleTheme}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
            {dark ? "Light mode" : "Dark mode"}
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="upgrade">
            <Bot size={18} />
            <div>
              <strong>Meeting intelligence</strong>
              <small>Upload. Transcribe. Act.</small>
            </div>
          </div>
          <div className="user">
            <span>{initials || "YO"}</span>
            <div>
              <strong>{displayName}</strong>
              <small>Private workspace</small>
            </div>
            <UserButton />
          </div>
        </div>
      </aside>
      <section className="library">
        <header className="topbar">
          <div className="topbar-lead">
            <button
              className="mobile-only icon-btn"
              aria-label="Open menu"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={18} />
            </button>
            <div>
              <h1>My meetings</h1>
              <p>Search titles, people, topics, and transcript text.</p>
            </div>
          </div>
          <div className="header-actions">
            <button
              className="new-btn mobile-import"
              onClick={() => setModal("import")}
            >
              <Upload size={16} />
              Import
            </button>
            <button className="new-btn" onClick={() => setModal("create")}>
              <Plus size={17} />
              New meeting
            </button>
          </div>
        </header>
        <div className="library-controls">
          <div className="searchbox">
            <Search size={18} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by title or keyword"
            />
          </div>
          <input
            className="filter-btn date-filter"
            aria-label="Filter from date"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <input
            className="filter-btn date-filter"
            aria-label="Filter to date"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
          <select
            aria-label="Filter by participant"
            className="filter-btn"
            value={participant}
            onChange={(e) => setParticipant(e.target.value)}
          >
            <option value="">All participants</option>
            {peopleOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by topic"
            className="filter-btn"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          >
            <option value="">All topics</option>
            {topicOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            aria-label="Sort meetings"
            className="filter-btn"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="recent">Most recent</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
        <div className="meeting-count">
          {listLoading ? "Loading meetings…" : `${meetings.length} meetings`}
        </div>
        <div className="meeting-list">
          {listLoading &&
            Array.from({ length: 4 }).map((_, i) => (
              <div className="meeting-row skeleton" key={`sk-${i}`} aria-hidden>
                <div className="meeting-icon sk-block" />
                <div className="meeting-main">
                  <strong className="sk-line" />
                  <div className="sk-line short" />
                </div>
              </div>
            ))}
          {!listLoading &&
            orderedMeetings.map((m) => (
            <button
              onClick={() => open(m.id)}
              key={m.id}
              className={`meeting-row ${selected?.id === m.id ? "selected" : ""} ${pinnedId === m.id ? "pinned" : ""}`}
            >
              <div className="meeting-icon">
                {m.media_url ? <FileAudio size={19} /> : <FileText size={19} />}
              </div>
              <div className="meeting-main">
                <strong>
                  {pinnedId === m.id && <Pin size={12} className="pin-mark" />}
                  {m.title}
                </strong>
                <div>
                  {date(m.occurred_at)} <i>•</i>{" "}
                  {m.duration_seconds
                    ? `${Math.ceil(m.duration_seconds / 60)} min`
                    : "No duration"}
                  <i>•</i>
                  {m.participants.join(", ") || "No participants"}
                </div>
              </div>
              <span className={`status ${m.processing_status}`}>
                {m.processing_status.replaceAll("_", " ")}
              </span>
            </button>
          ))}
          {!listLoading && !meetings.length && (
            <p className="muted list-empty">
              {apiNotice
                ? "Waiting for API… meetings will appear when the server wakes."
                : "No meetings yet — create or import one."}
            </p>
          )}
        </div>
      </section>
      <section className="detail">
        {selected ? (
          <>
            <header className="detail-head">
              <div className="crumb">
                <button
                  type="button"
                  className="crumb-link"
                  onClick={() => setMobilePane("list")}
                >
                  My meetings
                </button>{" "}
                <span>/</span> {selected.title}
                {selected.media_url && (
                  <span className="rec-chip" title="Recording attached">
                    REC
                  </span>
                )}
              </div>
              <div className="detail-actions">
                <button
                  type="button"
                  className={pinnedId === selected.id ? "active-pin" : ""}
                  onClick={() => togglePin(selected.id)}
                  title="Pin for demo"
                >
                  <Pin size={15} />
                  {pinnedId === selected.id ? "Pinned" : "Pin"}
                </button>
                <button type="button" onClick={shareMeeting} title="Copy link">
                  <Share2 size={15} />
                  Share
                </button>
                <button onClick={() => setModal("edit")}>Edit</button>
                <button onClick={() => setModal("export")}>
                  <Download size={15} />
                  Export
                  <ChevronDown size={14} />
                </button>
                <button onClick={destroy} className="danger">
                  <Trash2 size={15} />
                  Delete
                </button>
              </div>
            </header>
            <div className="detail-title">
              <h2>{selected.title}</h2>
              <p>
                <Clock3 size={15} />
                {date(selected.occurred_at)} <i>•</i>
                <Users size={15} />
                <span className="avatar-row">
                  {(selected.participants.length
                    ? selected.participants
                    : ["Guest"]
                  )
                    .slice(0, 5)
                    .map((p) => (
                      <SpeakerAvatar key={p} name={p} size={22} />
                    ))}
                </span>
                {selected.participants.join(", ") || "No participants"}
              </p>
            </div>
            <MediaPlayer
              meeting={selected}
              seek={seek}
              setSeek={setSeek}
              clipPlay={clipPlay}
            />
            <div className="tabs">
              <button
                className={tab === "summary" ? "tab active" : "tab"}
                onClick={() => setTab("summary")}
              >
                Summary
              </button>
              <button
                className={tab === "transcript" ? "tab active" : "tab"}
                onClick={() => setTab("transcript")}
              >
                Transcript
              </button>
              <button
                className={tab === "ask" ? "tab active" : "tab"}
                onClick={() => setTab("ask")}
              >
                Ask FireMe
              </button>
              <button
                className={tab === "clips" ? "tab active" : "tab"}
                onClick={() => setTab("clips")}
              >
                Clips & notes
              </button>
            </div>
            <div className="detail-content">
              {tab === "summary" && (
                <Summary
                  meeting={selected}
                  busy={busy}
                  onGenerate={generate}
                  onTranscribe={transcribe}
                  onSeek={(seconds) => {
                    setSeek(seconds);
                    setTab("transcript");
                  }}
                  onToggle={toggle}
                  onEdit={(action) => {
                    setEditingAction(action);
                    setModal("action");
                  }}
                  onDelete={removeAction}
                  onRefresh={refresh}
                />
              )}{" "}
              {tab === "transcript" && (
                <section className="transcript-full transcript-split">
                  <aside className="transcript-side">
                    <label className="side-search-label">
                      <Search size={14} /> Search transcript
                    </label>
                    <div className="mini-search side">
                      <input
                        value={find}
                        onChange={(e) => setFind(e.target.value)}
                        placeholder="Find a moment…"
                      />
                      {find && (
                        <button onClick={() => setFind("")}>
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    {find && (
                      <p className="muted side-hits">
                        {filtered.length} match
                        {filtered.length === 1 ? "" : "es"}
                      </p>
                    )}
                    <button
                      className="new-btn"
                      onClick={() => setModal("paste")}
                    >
                      <FileText size={15} />
                      Paste transcript
                    </button>
                    <button
                      className="new-btn"
                      onClick={() => {
                        setEditing(null);
                        setModal("segment");
                      }}
                    >
                      <Plus size={15} />
                      Add line
                    </button>
                  </aside>
                  <div className="transcript-main">
                    <div className="transcript-head">
                      <div>
                        <h3>Transcript</h3>
                        <span>{selected.segments?.length || 0} segments</span>
                      </div>
                    </div>
                    <div className="transcript-lines" ref={linesRef}>
                      {filtered.map((s, idx) => {
                        const isHit = !!find.trim() && idx === 0;
                        return (
                        <div
                          className={`segment ${seek >= s.start_seconds && seek < segmentEnd(selected.segments, s) ? "playing" : ""} ${isHit ? "hit" : ""}`}
                          key={s.id}
                          data-seg={s.id}
                        >
                          <button
                            className="segment-time"
                            onClick={() => setSeek(s.start_seconds)}
                          >
                            {fmt(s.start_seconds)}
                            <Play size={12} />
                          </button>
                          <div className="segment-copy">
                            <div className="speaker-line">
                              <SpeakerAvatar name={s.speaker} size={26} />
                              <strong>{s.speaker}</strong>
                            </div>
                            <p>{highlight(s.content, find)}</p>
                          </div>
                          <div className="line-actions">
                            <button
                              title="Copy timestamp link"
                              onClick={() => copyTimestampLink(s.start_seconds)}
                            >
                              <Link2 size={14} />
                            </button>
                            <button
                              title="Highlight"
                              onClick={() => {
                                setNoteSegment(s);
                                setNoteKind("highlight");
                                setNoteBody(s.content);
                                setModal("note");
                              }}
                            >
                              <Highlighter size={14} />
                            </button>
                            <button
                              title="Comment"
                              onClick={() => {
                                setNoteSegment(s);
                                setNoteKind("comment");
                                setNoteBody("");
                                setModal("note");
                              }}
                            >
                              <MessageSquare size={14} />
                            </button>
                            <button
                              title="Soundbite"
                              onClick={() => {
                                setNoteSegment(s);
                                setNoteKind("soundbite");
                                setNoteBody(s.content.slice(0, 120));
                                setModal("note");
                              }}
                            >
                              <Bookmark size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setEditing(s);
                                setModal("segment");
                              }}
                            >
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => removeSegment(s)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                      })}
                    </div>
                  </div>
                </section>
              )}
              {tab === "ask" && (
                <Ask
                  meeting={selected}
                  flash={flash}
                  onAsked={(row) =>
                    setSelected({
                      ...selected,
                      questions: [...(selected.questions || []), row],
                    })
                  }
                />
              )}
              {tab === "clips" && (
                <section className="clips-panel">
                  <h3>Comments, highlights & soundbites</h3>
                  <p className="muted">
                    Capture moments from the transcript. Soundbites play the
                    clipped range on the recording.
                  </p>
                  <div className="clips-list">
                    {(selected.notes || []).length === 0 && (
                      <p className="muted">
                        No clips yet — add them from Transcript.
                      </p>
                    )}
                    {(selected.notes || []).map((note) => {
                      const end =
                        note.end_seconds ??
                        note.start_seconds +
                          (note.kind === "soundbite" ? 30 : 0);
                      return (
                        <article
                          key={note.id}
                          className={`clip-card ${note.kind}`}
                        >
                          <button
                            className="segment-time"
                            title={
                              note.kind === "soundbite"
                                ? "Play soundbite"
                                : "Seek to moment"
                            }
                            onClick={() => {
                              if (note.kind === "soundbite") {
                                setClipPlay({
                                  start: note.start_seconds,
                                  end: Math.max(end, note.start_seconds + 1),
                                  token: Date.now(),
                                });
                              } else {
                                setSeek(note.start_seconds);
                                setTab("transcript");
                              }
                            }}
                          >
                            {fmt(note.start_seconds)}
                            {note.kind === "soundbite" && end > note.start_seconds
                              ? `–${fmt(end)}`
                              : ""}
                            <Play size={12} />
                          </button>
                          <div>
                            <strong>{note.kind}</strong>
                            <p>{note.body || "—"}</p>
                          </div>
                          <button onClick={() => removeNote(note)}>
                            <Trash2 size={14} />
                          </button>
                        </article>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          </>
        ) : (
          <div className="empty">Select or create a meeting to begin.</div>
        )}
      </section>
      {modal === "create" && (
        <MeetingForm
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            await load();
            flash("Meeting created");
          }}
        />
      )}
      {modal === "import" && (
        <ImportForm
          onClose={() => setModal(null)}
          onSaved={async (m) => {
            setModal(null);
            await open(m.id);
            await load();
            flash("Import complete");
          }}
        />
      )}
      {modal === "edit" && selected && (
        <MeetingForm
          meeting={selected}
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            await refresh();
            flash("Meeting updated");
          }}
        />
      )}
      {modal === "segment" && selected && (
        <SegmentForm
          meetingId={selected.id}
          segment={editing}
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            await refresh();
            flash("Transcript saved");
          }}
        />
      )}
      {modal === "paste" && selected && (
        <PasteTranscriptForm
          meetingId={selected.id}
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            await refresh();
            flash("Transcript imported");
          }}
        />
      )}
      {modal === "action" && editingAction && (
        <ActionForm
          action={editingAction}
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            await refresh();
            flash("Action updated");
          }}
        />
      )}
      {modal === "settings" && (
        <Modal title="Settings" close={() => setModal(null)}>
          <p className="muted coming-soon">
            Settings is a placeholder for the assignment. Live meeting bots,
            calendar sync, and integrations are out of scope — Coming soon.
          </p>
          <p className="muted" style={{ marginTop: 12 }}>
            Hosting note: the API runs on Render’s free tier. After idle time it
            may sleep — the workspace shows a wake banner, and the first Ask /
            Generate / Transcribe call can take 30–60 seconds.
          </p>
          <div className="form-actions">
            <button className="new-btn" onClick={() => setModal(null)}>
              Close
            </button>
          </div>
        </Modal>
      )}
      {modal === "export" && selected && (
        <Modal title="Export meeting" close={() => setModal(null)}>
          <p className="muted">Download summary, actions, and transcript.</p>
          <div className="export-choices">
            <button className="new-btn" onClick={() => downloadExport("markdown")}>
              Markdown (.md)
            </button>
            <button className="new-btn" onClick={() => downloadExport("txt")}>
              Plain text (.txt)
            </button>
            <button className="new-btn" onClick={() => downloadExport("pdf")}>
              PDF (.pdf)
            </button>
          </div>
        </Modal>
      )}
      {modal === "note" && (
        <Modal title={`Add ${noteKind}`} close={() => setModal(null)}>
          <p className="muted">
            {noteSegment
              ? `On ${noteSegment.speaker} @ ${fmt(noteSegment.start_seconds)}`
              : "Meeting moment"}
          </p>
          <label>
            Note
            <textarea
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              rows={4}
              placeholder={
                noteKind === "comment"
                  ? "Add a comment…"
                  : noteKind === "soundbite"
                    ? "Soundbite label"
                    : "Highlighted text"
              }
            />
          </label>
          <div className="form-actions">
            <button type="button" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button className="new-btn" onClick={saveNote}>
              Save {noteKind}
            </button>
          </div>
        </Modal>
      )}
      {notice && (
        <div className="toast">
          <Check size={16} />
          {notice}
        </div>
      )}
    </main>
    </>
  );
}

export { Workspace };
