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
} from "@clerk/nextjs";
import {
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  Clock3,
  Download,
  FileAudio,
  FileText,
  LoaderCircle,
  Menu,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
  Zap,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
type Segment = {
  id: number;
  speaker: string;
  start_seconds: number;
  content: string;
};
type Action = { id: number; text: string; owner: string; completed: boolean };
type Chapter = { title: string; start_seconds: number; summary: string };
type Meeting = {
  id: number;
  title: string;
  occurred_at: string;
  duration_seconds: number;
  participants: string[];
  summary: string;
  topics: string[];
  chapters: Chapter[];
  processing_status: string;
  media_url?: string | null;
  media_type?: string | null;
  segments?: Segment[];
  actions?: Action[];
};
const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`,
  date = (v: string) =>
    new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(v));
const segmentEnd = (segments: Segment[] | undefined, segment: Segment) =>
  segments?.find((item) => item.start_seconds > segment.start_seconds)
    ?.start_seconds ?? Infinity;
let getSessionToken: (() => Promise<string | null>) | null = null;
async function request(path: string, options?: RequestInit) {
  const headers = new Headers(options?.headers);
  const token = await getSessionToken?.();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const r = await fetch(`${API}${path}`, { ...options, headers });
  if (!r.ok)
    throw new Error(
      (await r.json().catch(() => ({}))).detail || "Request failed",
    );
  return r;
}

export default function Home() {
  const [screen, setScreen] = useState<"site" | "workspace">("site");
  return screen === "site" ? (
    <Landing openWorkspace={() => setScreen("workspace")} />
  ) : (
    <Workspace />
  );
}
function Workspace() {
  const { getToken, isLoaded, userId } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]),
    [selected, setSelected] = useState<Meeting | null>(null),
    [q, setQ] = useState(""),
    [sort, setSort] = useState("recent"),
    [dateFrom, setDateFrom] = useState(""),
    [dateTo, setDateTo] = useState(""),
    [tab, setTab] = useState<"summary" | "transcript" | "ask">("summary"),
    [seek, setSeek] = useState(0),
    [find, setFind] = useState(""),
    [modal, setModal] = useState<
      "create" | "import" | "edit" | "segment" | "paste" | "action" | null
    >(null),
    [editing, setEditing] = useState<Segment | null>(null),
    [editingAction, setEditingAction] = useState<Action | null>(null),
    [tokenReady, setTokenReady] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const flash = (s: string) => {
    setNotice(s);
    setTimeout(() => setNotice(""), 3200);
  };
  const load = async () => {
    if (!userId || !tokenReady) return;
    try {
      const params = new URLSearchParams({ query: q, sort });
      if (dateFrom) params.set("date_from", `${dateFrom}T00:00:00`);
      if (dateTo) params.set("date_to", `${dateTo}T23:59:59.999`);
      const data = await (await request(`/meetings?${params}`)).json();
      setMeetings(data);
      if (!selected && data[0]) open(data[0].id);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Could not load meetings");
    }
  };
  const open = async (id: number) => {
    try {
      setSelected(await (await request(`/meetings/${id}`)).json());
      setSeek(0);
      setFind("");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Could not open meeting");
    }
  };
  useEffect(() => {
    let active = true;
    setTokenReady(false);
    if (userId) {
      getSessionToken = getToken;
      getToken().then((token) => {
        if (active) {
          setTokenReady(Boolean(token));
        }
      });
    }
    return () => {
      active = false;
      getSessionToken = null;
    };
  }, [getToken, userId]);
  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [q, sort, dateFrom, dateTo, userId, tokenReady]);
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
      flash("Transcription complete");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Transcription failed");
    } finally {
      setBusy(false);
    }
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
  async function downloadExport() {
    if (!selected) return;
    try {
      const response = await request(
        `/meetings/${selected.id}/export?format=markdown`,
      );
      const href = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = href;
      link.download = `${selected.title}.md`;
      link.click();
      URL.revokeObjectURL(href);
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
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">✦</span>fireme<span>.ai</span>
        </div>
        <button className="record-btn" onClick={() => setModal("import")}>
          <Upload size={16} /> Import recording or transcript
        </button>
        <nav>
          <button className="nav-item active">
            <FileText size={18} />
            My meetings
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
            <span>AK</span>
            <div>
              <strong>Alex Kim</strong>
              <small>Local workspace</small>
            </div>
          </div>
        </div>
      </aside>
      <section className="library">
        <header className="topbar">
          <div>
            <h1>My meetings</h1>
            <p>Your searchable meeting library.</p>
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
              placeholder="Search title, people, topics"
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
            aria-label="Sort meetings"
            className="filter-btn"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="recent">Most recent</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
        <div className="meeting-count">{meetings.length} meetings</div>
        <div className="meeting-list">
          {meetings.map((m) => (
            <button
              onClick={() => open(m.id)}
              key={m.id}
              className={`meeting-row ${selected?.id === m.id ? "selected" : ""}`}
            >
              <div className="meeting-icon">
                {m.media_url ? <FileAudio size={19} /> : <FileText size={19} />}
              </div>
              <div className="meeting-main">
                <strong>{m.title}</strong>
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
        </div>
      </section>
      <section className="detail">
        {selected ? (
          <>
            <header className="detail-head">
              <div className="crumb">
                My meetings <span>/</span> {selected.title}
              </div>
              <div className="detail-actions">
                <button onClick={() => setModal("edit")}>Edit</button>
                <button onClick={downloadExport}>
                  <Download size={15} />
                  Export
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
                {selected.participants.join(", ") || "No participants"}
              </p>
            </div>
            <MediaPlayer meeting={selected} seek={seek} setSeek={setSeek} />
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
            </div>
            <div className="detail-content">
              {tab === "summary" && (
                <Summary
                  meeting={selected}
                  busy={busy}
                  onGenerate={generate}
                  onTranscribe={transcribe}
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
                <section className="transcript-full">
                  <div className="transcript-head">
                    <div>
                      <h3>Transcript</h3>
                      <span>{selected.segments?.length || 0} segments</span>
                    </div>
                    <div className="transcript-tools">
                      <div className="mini-search">
                        <Search size={16} />
                        <input
                          value={find}
                          onChange={(e) => setFind(e.target.value)}
                          placeholder="Search transcript"
                        />
                        {find && (
                          <button onClick={() => setFind("")}>
                            <X size={14} />
                          </button>
                        )}
                      </div>
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
                    </div>
                  </div>
                  <div className="transcript-lines">
                    {filtered.map((s) => (
                      <div
                        className={`segment ${seek >= s.start_seconds && seek < segmentEnd(selected.segments, s) ? "playing" : ""}`}
                        key={s.id}
                      >
                        <button
                          className="segment-time"
                          onClick={() => setSeek(s.start_seconds)}
                        >
                          {fmt(s.start_seconds)}
                          <Play size={12} />
                        </button>
                        <div className="segment-copy">
                          <strong>{s.speaker}</strong>
                          <p>{highlight(s.content, find)}</p>
                        </div>
                        <div className="line-actions">
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
                    ))}
                  </div>
                </section>
              )}
              {tab === "ask" && <Ask meeting={selected} flash={flash} />}
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
      {notice && (
        <div className="toast">
          <Check size={16} />
          {notice}
        </div>
      )}
    </main>
  );
}
function AuthControls({ openWorkspace }: { openWorkspace: () => void }) {
  return (
    <>
      <Show when="signed-out">
        <SignInButton>
          <button className="ff-login">Sign in</button>
        </SignInButton>
        <SignUpButton>
          <button className="ff-cta small">
            Get started <ArrowRight size={15} />
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <button className="ff-login" onClick={openWorkspace}>
          Open workspace
        </button>
        <UserButton />
      </Show>
    </>
  );
}
function Landing({ openWorkspace }: { openWorkspace: () => void }) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (items) =>
        items.forEach((x) => x.isIntersecting && x.target.classList.add("in")),
      { threshold: 0.15 },
    );
    document.querySelectorAll(".reveal").forEach((x) => observer.observe(x));
    return () => observer.disconnect();
  }, []);
  const features = [
    {
      icon: <FileAudio />,
      title: "Capture every conversation",
      text: "Bring recordings and transcripts into one reliable, searchable memory.",
    },
    {
      icon: <Sparkles />,
      title: "Notes that move work forward",
      text: "Turn long conversations into clear decisions, chapters, and tasks.",
    },
    {
      icon: <Bot />,
      title: "Ask your meetings anything",
      text: "Find the answer and the exact moment it was discussed.",
    },
  ];
  const demos = ["Overview", "Decisions", "Action items", "Follow-up"];
  return (
    <div className="ff-site">
      <div className="ff-banner">
        <span>NEW</span>
        <p>Meeting intelligence that keeps your momentum moving.</p>
        <button onClick={openWorkspace}>
          See it in action <ArrowRight size={14} />
        </button>
      </div>
      <header className="ff-nav">
        <button
          className="ff-logo"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <i>✦</i>fireme<span>.ai</span>
        </button>
        <nav>
          <a href="#product">Product</a>
          <a href="#workflows">Workflows</a>
          <a href="#security">Security</a>
        </nav>
        <div>
          <AuthControls openWorkspace={openWorkspace} />
          <button className="ff-menu">
            <Menu size={20} />
          </button>
        </div>
      </header>
      <main>
        <section className="ff-hero">
          <div className="ff-eyebrow">
            <span></span> MEETING INTELLIGENCE, REIMAGINED
          </div>
          <h1>
            Your meetings,
            <br />
            <em>working for you.</em>
          </h1>
          <p>
            Capture conversations, turn them into clear next steps, and move
            from discussion to action—without losing a detail.
          </p>
          <div className="ff-hero-actions">
            <Show when="signed-out">
              <SignUpButton>
                <button className="ff-cta">
                  Create your account <ArrowRight size={17} />
                </button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <button className="ff-cta" onClick={openWorkspace}>
                Open your workspace <ArrowRight size={17} />
              </button>
            </Show>
            <a href="#product">
              Explore the product <ArrowRight size={16} />
            </a>
          </div>
          <div className="ff-social">
            <div className="stars">★★★★★</div>
            <span>Built for teams that value their time</span>
            <i>•</i>
            <span>Private by design</span>
          </div>
          <div className="ff-orbit o1"></div>
          <div className="ff-orbit o2"></div>
        </section>
        <section className="ff-showcase reveal">
          <div className="showcase-top">
            <span className="live-dot">● Live meeting</span>
            <span>Product roadmap sync</span>
            <button>Share</button>
          </div>
          <div className="showcase-body">
            <aside>
              <b>✦ fireme</b>
              <span className="side-active">◈ My meetings</span>
              <span>◷ Calendar</span>
              <span>✧ Insights</span>
              <span>⚙ Settings</span>
            </aside>
            <article>
              <div className="fake-player">
                <span className="pulse">✦</span>
                <b>Recording is ready</b>
                <small>42:18 · 3 speakers</small>
                <div className="fake-wave">
                  <i></i>
                  <i></i>
                  <i></i>
                  <i></i>
                  <i></i>
                  <i></i>
                  <i></i>
                  <i></i>
                  <i></i>
                  <i></i>
                  <i></i>
                  <i></i>
                </div>
              </div>
              <div className="fake-tabs">
                <b>Summary</b>
                <span>Transcript</span>
                <span>Ask FireMe</span>
              </div>
              <div className="fake-grid">
                <div>
                  <small className="purple-label">✦ AI BRIEF</small>
                  <h3>Q3 priorities are locked.</h3>
                  <p>
                    Analytics leads the release, with activation improvements
                    following in the same milestone.
                  </p>
                  <div className="fake-tags">
                    <span>Roadmap</span>
                    <span>Analytics</span>
                    <span>Activation</span>
                  </div>
                </div>
                <div className="fake-tasks">
                  <b>Action items</b>
                  <p>
                    ✓ Scope the event pipeline <small>Jordan</small>
                  </p>
                  <p>
                    □ Share customer synthesis <small>Alex</small>
                  </p>
                  <p>
                    □ Update the narrative <small>Maya</small>
                  </p>
                </div>
              </div>
            </article>
          </div>
        </section>
        <section className="ff-logo-row reveal">
          <span>TRUSTED AS A FOCUS LAYER FOR MODERN TEAMS</span>
          <div>
            <b>arc</b>
            <b>northstar</b>
            <b>loom</b>
            <b>vertex</b>
            <b>mosaic</b>
          </div>
        </section>
        <section id="product" className="ff-section split reveal">
          <div className="ff-copy">
            <span className="section-kicker">01 — CAPTURE</span>
            <h2>
              Every conversation becomes a <em>searchable asset.</em>
            </h2>
            <p>
              Import a recording or transcript, preserve speaker context and
              timestamps, then return to the moments that matter.
            </p>
            <button className="text-link" onClick={openWorkspace}>
              Explore meeting library <ArrowRight size={16} />
            </button>
          </div>
          <div className="ff-visual transcript-card">
            <div className="visual-head">
              <span className="tiny-dot"></span>
              <b>Live transcript</b>
              <small>English</small>
            </div>
            <div className="visual-line">
              <time>00:12</time>
              <p>
                <b>Maya</b> Let’s make the customer signal our guide for Q3.
              </p>
            </div>
            <div className="visual-line current">
              <time>00:38</time>
              <p>
                <b>Alex</b> Analytics is the clearest repeated request.
              </p>
            </div>
            <div className="visual-line">
              <time>01:22</time>
              <p>
                <b>Jordan</b> I’ll have the technical scope ready Thursday.
              </p>
            </div>
            <div className="transcript-search">
              ⌕ Search every word, every meeting
            </div>
          </div>
        </section>
        <section className="ff-band">
          <div className="reveal">
            <span className="section-kicker">02 — SYNTHESIZE</span>
            <h2>
              Leave every meeting with <em>clarity.</em>
            </h2>
            <p>
              Summaries, key topics, chapters, and tasks are shaped around the
              conversation—not a generic template.
            </p>
          </div>
          <div className="ff-band-cards reveal">
            <div>
              <Sparkles />
              <b>Decision-ready briefs</b>
              <p>Capture what changed and why.</p>
            </div>
            <div>
              <Check />
              <b>Ownership built in</b>
              <p>Turn discussion into accountable work.</p>
            </div>
            <div>
              <Zap />
              <b>Instant recall</b>
              <p>Return to a precise timestamp.</p>
            </div>
          </div>
        </section>
        <section id="workflows" className="ff-section workflows reveal">
          <div className="center-copy">
            <span className="section-kicker">03 — WORK YOUR WAY</span>
            <h2>
              One conversation. <em>Different lenses.</em>
            </h2>
            <p>Switch the view to fit the work immediately in front of you.</p>
          </div>
          <div className="demo-tabs">
            {demos.map((x, i) => (
              <button
                className={active === i ? "active" : ""}
                key={x}
                onClick={() => setActive(i)}
              >
                {x}
              </button>
            ))}
          </div>
          <div className="workflow-demo">
            <div className="workflow-main">
              <small>{demos[active].toUpperCase()}</small>
              <h3>
                {
                  [
                    "Everything your team needs to know.",
                    "A record of what changed.",
                    "The work that happens next.",
                    "A thoughtful message, ready to send.",
                  ][active]
                }
              </h3>
              <p>
                {
                  [
                    "A concise account of the conversation, with the details available when you need them.",
                    "Key calls are attached to source moments, so context never goes missing.",
                    "Tasks include an owner, a clean status, and a direct link back to the discussion.",
                    "Use the meeting as context for a clear, human follow-up.",
                  ][active]
                }
              </p>
              <button className="ff-cta small" onClick={openWorkspace}>
                Try it yourself <ArrowRight size={15} />
              </button>
            </div>
            <div className={`workflow-side side-${active}`}>
              <span>✦</span>
              <div></div>
              <div></div>
              <div></div>
              <small>Updates in real time</small>
            </div>
          </div>
        </section>
        <section id="security" className="ff-section security reveal">
          <div className="security-orb">
            <ShieldCheck size={58} />
            <span>
              PRIVATE
              <br />
              BY DESIGN
            </span>
          </div>
          <div className="ff-copy">
            <span className="section-kicker">04 — YOUR CONTEXT</span>
            <h2>
              Conversation intelligence with <em>control.</em>
            </h2>
            <p>
              Your meeting records belong in one deliberate workspace, with
              clear ownership and an export path whenever you need it.
            </p>
            <div className="security-list">
              <span>
                <Check size={16} /> Structured, persistent meeting history
              </span>
              <span>
                <Check size={16} /> Exportable notes and transcripts
              </span>
              <span>
                <Check size={16} /> API keys stay server-side
              </span>
            </div>
          </div>
        </section>
        <section className="ff-final reveal">
          <span className="section-kicker">START WHERE THE WORK HAPPENS</span>
          <h2>
            Make every conversation <em>count twice.</em>
          </h2>
          <p>
            Once in the room. Then everywhere it needs to move your work
            forward.
          </p>
          <button className="ff-cta" onClick={openWorkspace}>
            Open FireMe <ArrowRight size={17} />
          </button>
        </section>
      </main>
      <footer className="ff-footer">
        <button
          className="ff-logo"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <i>✦</i>fireme<span>.ai</span>
        </button>
        <span>Meeting intelligence for thoughtful teams.</span>
        <small>© 2026 FireMe</small>
      </footer>
    </div>
  );
}
function MediaPlayer({
  meeting,
  seek,
  setSeek,
}: {
  meeting: Meeting;
  seek: number;
  setSeek: (n: number) => void;
}) {
  const apiSrc = meeting.media_url
      ? `${API.replace(/\/api$/, "")}${meeting.media_url}`
      : "",
    media = useRef<HTMLMediaElement>(null),
    [duration, setDuration] = useState(meeting.duration_seconds),
    [src, setSrc] = useState("");
  useEffect(() => {
    if (!apiSrc) return;
    let objectUrl = "",
      active = true;
    request(meeting.media_url || "")
      .then((response) => response.blob())
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setSrc(objectUrl);
      })
      .catch(() => setSrc(""));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [apiSrc]);
  useEffect(() => {
    if (media.current && Math.abs(media.current.currentTime - seek) > 0.8)
      media.current.currentTime = seek;
  }, [seek]);
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
                    meeting.duration_seconds,
                )
              }
              onTimeUpdate={(e) =>
                setSeek(Math.floor(e.currentTarget.currentTime))
              }
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
                    meeting.duration_seconds,
                )
              }
              onTimeUpdate={(e) =>
                setSeek(Math.floor(e.currentTarget.currentTime))
              }
            />
          )}
          <div className="player-controls">
            <span>{fmt(seek)}</span>
            <input
              aria-label="Seek recording"
              type="range"
              min="0"
              max={Math.max(duration, 1)}
              value={Math.min(seek, duration || 0)}
              onChange={(e) => setSeek(+e.target.value)}
            />
            <span>{fmt(duration)}</span>
          </div>
        </>
      ) : (
        <div className="no-media">
          <FileAudio size={24} />
          <div>
            <strong>No recording attached</strong>
            <span>Import an audio or video recording to enable playback.</span>
          </div>
        </div>
      )}
    </div>
  );
}
function Summary({
  meeting,
  busy,
  onGenerate,
  onTranscribe,
  onToggle,
  onEdit,
  onDelete,
  onRefresh,
}: {
  meeting: Meeting;
  busy: boolean;
  onGenerate: () => void;
  onTranscribe: () => void;
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
            {meeting.media_url && !meeting.segments?.length ? (
              <button
                className="new-btn"
                onClick={onTranscribe}
                disabled={busy}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={15} />
                ) : (
                  <FileAudio size={15} />
                )}
                Transcribe
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
        <section className="chapters">
          <h3>Chapters</h3>
          {meeting.chapters.length ? (
            meeting.chapters.map((c) => (
              <button key={`${c.title}${c.start_seconds}`} className="chapter">
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
}: {
  meeting: Meeting;
  flash: (s: string) => void;
}) {
  const [question, setQuestion] = useState(""),
    [answer, setAnswer] = useState(""),
    [busy, setBusy] = useState(false);
  async function ask(e: FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setBusy(true);
    try {
      const r = await request(`/meetings/${meeting.id}/ask`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });
      setAnswer((await r.json()).answer);
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
      <p>Get an answer grounded in this meeting’s transcript.</p>
      <form onSubmit={ask}>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What did we decide about the roadmap?"
        />
        <button
          className="new-btn"
          disabled={busy || !meeting.segments?.length}
        >
          {busy ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <Bot size={16} />
          )}
          Ask FireMe
        </button>
      </form>
      {answer && (
        <article className="answer">
          <strong>Answer</strong>
          <p>{answer}</p>
        </article>
      )}
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
          speaker: speaker || "Unknown",
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
