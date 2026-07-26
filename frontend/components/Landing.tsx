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
  LoaderCircle,
  Menu,
  MessageSquare,
  Moon,
  Pencil,
  Play,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  Users,
  X,
  Zap,
} from "lucide-react";
import type { Action, Meeting, Note, Segment } from "@/lib/types";
import { API, bindTokenGetter, request } from "@/lib/api";
import { date, fmt, segmentEnd } from "@/lib/format";

function AuthControls({ openWorkspace }: { openWorkspace: () => void }) {
  return (
    <>
      <Show when="signed-out">
        <SignInButton>
          <button className="fm-login">Sign in</button>
        </SignInButton>
        <SignUpButton>
          <button className="fm-cta small">
            Get started <ArrowRight size={15} />
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <button className="fm-login" onClick={openWorkspace}>
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
    <div className="fm-site">
      <div className="fm-banner">
        <span>NEW</span>
        <p>Meeting intelligence that keeps your momentum moving.</p>
        <button onClick={openWorkspace}>
          See it in action <ArrowRight size={14} />
        </button>
      </div>
      <header className="fm-nav">
        <button
          className="fm-logo"
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
          <button className="fm-menu">
            <Menu size={20} />
          </button>
        </div>
      </header>
      <main>
        <section className="fm-hero">
          <div className="fm-stars" aria-hidden="true" />
          <div className="fm-stars fm-stars-drift" aria-hidden="true" />
          <div className="fm-eyebrow">
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
          <div className="fm-hero-actions">
            <Show when="signed-out">
              <SignUpButton>
                <button className="fm-cta">
                  Create your account <ArrowRight size={17} />
                </button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <button className="fm-cta" onClick={openWorkspace}>
                Open your workspace <ArrowRight size={17} />
              </button>
            </Show>
            <a href="#product">
              Explore the product <ArrowRight size={16} />
            </a>
          </div>
          <div className="fm-social">
            <div className="stars">★★★★★</div>
            <span>Built for teams that value their time</span>
            <i>•</i>
            <span>Private by design</span>
          </div>
        </section>
        <section className="fm-showcase reveal">
          <div className="showcase-top">
            <span className="live-dot">● Workspace preview</span>
            <span>Product roadmap sync</span>
          </div>
          <div className="showcase-body">
            <aside>
              <b>✦ fireme</b>
              <span className="side-active">◈ My meetings</span>
              <span className="side-soon">⚙ Settings · Coming soon</span>
            </aside>
            <article>
              <div className="fake-player">
                <span className="pulse">✦</span>
                <b>Meeting notepad</b>
                <small>Summary · Transcript · Ask</small>
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
        <section className="fm-logo-row reveal">
          <span>BUILT FOR THE FIREFLIES-STYLE POST-MEETING WORKFLOW</span>
          <div>
            <b>Library</b>
            <b>Transcript</b>
            <b>Summary</b>
            <b>Actions</b>
            <b>Ask</b>
          </div>
        </section>
        <section id="product" className="fm-section split reveal">
          <div className="fm-copy">
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
          <div className="fm-visual transcript-card">
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
        <section className="fm-band">
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
          <div className="fm-band-cards reveal">
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
        <section id="workflows" className="fm-section workflows reveal">
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
              <button className="fm-cta small" onClick={openWorkspace}>
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
        <section id="security" className="fm-section security reveal">
          <div className="security-orb">
            <ShieldCheck size={58} />
            <span>
              PRIVATE
              <br />
              BY DESIGN
            </span>
          </div>
          <div className="fm-copy">
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
        <section className="fm-final reveal">
          <span className="section-kicker">START WHERE THE WORK HAPPENS</span>
          <h2>
            Make every conversation <em>count twice.</em>
          </h2>
          <p>
            Once in the room. Then everywhere it needs to move your work
            forward.
          </p>
          <button className="fm-cta" onClick={openWorkspace}>
            Open FireMe <ArrowRight size={17} />
          </button>
        </section>
      </main>
      <footer className="fm-footer">
        <button
          className="fm-logo"
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

export { Landing };
