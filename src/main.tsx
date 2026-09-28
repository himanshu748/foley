import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  AudioLines,
  Check,
  ChevronRight,
  Clapperboard,
  Copy,
  Footprints,
  Headphones,
  Maximize2,
  Mic,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Smartphone,
  Square,
  Trash2,
  Upload,
  Volume2,
  Wind,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import "@fontsource/bricolage-grotesque/latin-600.css";
import "@fontsource/bricolage-grotesque/latin-700.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import { Film, CUES } from "./film";
import {
  isTV,
  homeUrl,
  studioUrl,
  usePictureMode,
  PictureChoice,
  useTVControls,
  rememberStudio,
  previousStudio,
  forgetStudio,
} from "./tv";
import "./styles.css";
type Role = "footsteps" | "weather" | "creature";
type Clip = {
  id: string;
  name: string;
  duration: number;
  peaks: number[];
  member_id: string;
  contributor: string;
};
type Session = {
  id: string;
  title: string;
  code?: string;
  codeExpires?: number;
  expires: number;
  revision: number;
  role: "host" | "crew";
  me: { id: string; name: string };
  casts: Partial<Record<Role, { clipId: string; volume: number }>>;
  clips: Clip[];
  crew: { id: string; name: string; kind: string }[];
  premieres: number;
  recording: string | null;
  playingUntil: number;
};
const roles: Role[] = ["footsteps", "weather", "creature"];
const roleInfo = {
  footsteps: {
    title: "Footsteps",
    hint: "A slow, stomping entrance.",
    tip: "Try tapping a shoe on a cushion.",
    icon: Footprints,
    color: "mint",
  },
  weather: {
    title: "Weather",
    hint: "A storm rolling through.",
    tip: "Rustle a bag. Shake some rice.",
    icon: Wind,
    color: "blue",
  },
  creature: {
    title: "Creature",
    hint: "A very unexpected voice.",
    tip: "A squeak, a growl, a tiny hello.",
    icon: AudioLines,
    color: "peach",
  },
};
async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch("/api" + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok)
    throw new Error(data.error || "The studio is not responding. Try again.");
  return data;
}
function useRemote() {
  useEffect(() => {
    const primary = () =>
      document.querySelector<HTMLElement>(
        "[data-remote-primary]:not(:disabled)",
      ) ||
      document.querySelector<HTMLElement>(
        "main button:not(:disabled), main a[href]",
      );
    const restore = () => {
      if (
        isTV &&
        (!document.activeElement || document.activeElement === document.body)
      )
        primary()?.focus();
    };
    const observer = new MutationObserver(restore);
    if (isTV) {
      observer.observe(document.body, { childList: true, subtree: true });
      requestAnimationFrame(restore);
    }
    const onKey = (e: KeyboardEvent) => {
      if (
        !["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(e.key) ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement)?.tagName,
        )
      )
        return;
      const all = Array.from(
        document.querySelectorAll<HTMLElement>(
          "button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled)",
        ),
      ).filter((el) => el.offsetParent !== null);
      const current = document.activeElement as HTMLElement;
      const rect = current?.getBoundingClientRect();
      if (!rect || !all.includes(current)) {
        (primary() || all[0])?.focus();
        e.preventDefault();
        return;
      }
      const cx = rect.x + rect.width / 2,
        cy = rect.y + rect.height / 2;
      const scored = all
        .filter((el) => el !== current)
        .map((el) => {
          const r = el.getBoundingClientRect(),
            dx = r.x + r.width / 2 - cx,
            dy = r.y + r.height / 2 - cy;
          const primary =
            e.key === "ArrowRight"
              ? dx
              : e.key === "ArrowLeft"
                ? -dx
                : e.key === "ArrowDown"
                  ? dy
                  : -dy;
          const secondary =
            e.key.includes("Left") || e.key.includes("Right")
              ? Math.abs(dy)
              : Math.abs(dx);
          return {
            el,
            score: primary > 6 ? primary + secondary * 2 : Infinity,
          };
        })
        .sort((a, b) => a.score - b.score);
      if (scored[0]?.score !== Infinity) {
        scored[0]?.el.focus();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      observer.disconnect();
      window.removeEventListener("keydown", onKey);
    };
  }, []);
}
function App() {
  const path = location.pathname.split("/");
  const id = path[1] === "studio" || path[1] === "mic" ? path[2] : null;
  const [session, setSession] = useState<Session | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [notice, setNotice] = useState(""),
    [loaded, setLoaded] = useState(false);
  useRemote();
  useEffect(() => {
    document.documentElement.dataset.display = isTV ? "tv" : "browser";
  }, []);
  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      setSession(await api("/sessions/" + id));
      setLoaded(true);
    } catch (e) {
      setError((e as Error).message);
      setLoaded(true);
    }
  }, [id]);
  useEffect(() => {
    refresh();
    if (!id) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 2500);
    return () => clearInterval(t);
  }, [id, refresh]);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 4500);
      return () => clearTimeout(t);
    }
  }, [notice]);
  const action = async (label: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(label);
    setError("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  return (
    <>
      <header className="topbar">
        <a href={homeUrl} className="wordmark" aria-label="Foley home">
          foley
          <span className="logo-dot" />
        </a>
        <span className="brand-note">Good sounds. Great company.</span>
        <div className="header-actions">
          {session ? (
            <span className="session-badge">
              <span />
              {session.role === "host"
                ? "Director’s chair"
                : `${session.me.name} · sound crew`}
            </span>
          ) : (
            <a className="text-link" href="/join">
              Join a studio <ArrowUpRight size={16} />
            </a>
          )}
        </div>
      </header>
      {error && (
        <div className="alert" role="alert">
          <span>{error}</span>
          <button aria-label="Dismiss error" onClick={() => setError("")}>
            <X size={18} />
          </button>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
      {!id ? (
        path[1] === "join" ? (
          <Join busy={busy} action={action} />
        ) : (
          <Home busy={busy} action={action} />
        )
      ) : session ? (
        session.role === "host" && path[1] !== "mic" ? (
          <Studio
            session={session}
            busy={busy}
            action={action}
            notice={setNotice}
            refresh={refresh}
          />
        ) : (
          <Microphone
            session={session}
            busy={busy}
            action={action}
            notice={setNotice}
          />
        )
      ) : (
        <main className="waiting">
          <Clapperboard size={42} />
          <h1>{loaded ? "Studio unavailable" : "Opening the studio…"}</h1>
          <p>
            {loaded
              ? "Return to the original director browser or pair your phone with a current code."
              : "Finding your saved takes and sound cast."}
          </p>
          {loaded && (
            <a className="button primary" href="/join">
              Pair a phone
            </a>
          )}
        </main>
      )}
      <footer>
        <span>Made for making things together.</span>
        <span>Sessions & recordings expire after 6 hours.</span>
      </footer>
    </>
  );
}
function Home({ busy, action }: { busy: string; action: Function }) {
  const [pictureMode, choosePicture] = usePictureMode();
  const [resume, setResume] = useState<Session | null>(null);
  const [time, setTime] = useState(9),
    [teaser, setTeaser] = useState(false);
  const previewStarted = useRef(false);
  useEffect(() => {
    const id = previousStudio();
    if (!id) return;
    let cancelled = false;
    api(`/sessions/${id}`)
      .then((session) => {
        if (!cancelled && session.role === "host") setResume(session);
      })
      .catch(forgetStudio);
    return () => {
      cancelled = true;
    };
  }, []);
  useTVControls({
    back: () => {
      if (teaser) {
        setTeaser(false);
        return true;
      }
      return false;
    },
    suspend: () => setTeaser(false),
    media: () => setTeaser((value) => !value),
  });
  useEffect(() => {
    if (!teaser) return;
    const start =
      performance.now() -
      (previewStarted.current && time < 20 ? time * 1000 : 0);
    previewStarted.current = true;
    let r = 0;
    const loop = () => {
      const t = (performance.now() - start) / 1000;
      if (t > 20) {
        setTeaser(false);
        setTime(20);
        return;
      }
      setTime(t);
      r = requestAnimationFrame(loop);
    };
    r = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(r);
  }, [teaser]);
  return (
    <main className="home">
      <section className="home-intro">
        <h1>
          A little noise.
          <br />
          <span>A big picture.</span>
        </h1>
        <div className="intro-bottom">
          <p>
            Your living room is the sound crew.
            <br />
            Give a little monster movie a voice.
          </p>
          <button
            className="button primary"
            data-remote-primary
            disabled={!!busy}
            onClick={() =>
              action("Starting studio", async () => {
                const s = await api("/sessions", "POST", {
                  title: "A visitor in the storm",
                });
                rememberStudio(s);
                location.href = studioUrl(s.id);
              })
            }
          >
            {busy || "Start a studio"} <ArrowUpRight size={21} />
          </button>
          {resume && (
            <a
              className="button secondary resume-studio"
              href={studioUrl(resume.id)}
            >
              Resume your studio <ChevronRight size={19} />
            </a>
          )}
        </div>
      </section>
      <section className="home-screen" aria-label="Featured original film">
        <div className="film-heading">
          <span>
            <Clapperboard size={17} /> Tonight’s picture
          </span>
          <span>20 seconds · 3 sound roles</span>
        </div>
        <Film time={time} playing={teaser} mode={pictureMode} />
        <div className="film-overlay">
          <div>
            <h2>A visitor in the storm</h2>
            <p>Looks enormous. Sounds like you.</p>
          </div>
          <button
            className="round-button"
            aria-label={teaser ? "Pause silent film" : "Watch silent film"}
            onClick={() => setTeaser(!teaser)}
          >
            {teaser ? <Pause /> : <Play fill="currentColor" />}
          </button>
        </div>
      </section>
      <div className="home-picture-options">
        <PictureChoice mode={pictureMode} choose={choosePicture} />
        {!isTV && (
          <a href="/tv" className="text-link">
            Open TV view <ArrowUpRight size={17} />
          </a>
        )}
        {isTV && (
          <span>
            Arrows to move · Select to choose · Back to stop the picture
          </span>
        )}
      </div>
      <section className="how-it-works">
        <h2>
          Three sounds.
          <br />
          One roomful of directors.
        </h2>
        <div className="steps">
          <div>
            <Smartphone />
            <h3>Bring a phone</h3>
            <p>
              Scan the TV’s code. One microphone can pass around the whole crew.
            </p>
          </div>
          <div>
            <Mic />
            <h3>Make some noise</h3>
            <p>
              Rustle, tap, squeak. Record a take and cast it into the scene.
            </p>
          </div>
          <div>
            <Clapperboard />
            <h3>Call action</h3>
            <p>
              Watch your sounds become a film. Switch one role. Watch it change.
            </p>
          </div>
        </div>
      </section>
      <div className="home-end">
        <p>No downloads for the crew. No account needed.</p>
        <a className="text-link" href="/join">
          Already have a code? Join in <ChevronRight size={18} />
        </a>
      </div>
    </main>
  );
}
function Join({ busy, action }: { busy: string; action: Function }) {
  const [code, setCode] = useState(
      new URLSearchParams(location.search).get("code") || "",
    ),
    [name, setName] = useState("");
  return (
    <main className="join-layout">
      <div className="join-copy">
        <div className="big-mic">
          <Mic size={68} />
        </div>
        <h1>
          You’re the
          <br />
          sound department.
        </h1>
        <p>
          A little tapping. A little rustling. Maybe a very tiny roar. Your
          first take is waiting.
        </p>
      </div>
      <form
        className="join-form"
        onSubmit={(e) => {
          e.preventDefault();
          action("Joining studio", async () => {
            const s = await api("/join", "POST", { code, name });
            location.href = "/mic/" + s.id;
          });
        }}
      >
        <h2>Join the crew</h2>
        <p>Find the six-character code on your TV.</p>
        <label htmlFor="code">Studio code</label>
        <input
          id="code"
          className="code-input"
          required
          minLength={6}
          maxLength={6}
          pattern="[a-fA-F0-9]{6}"
          autoComplete="off"
          autoCapitalize="characters"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="A1B2C3"
        />
        <label htmlFor="name">Your credit in the film</label>
        <input
          id="name"
          value={name}
          required
          maxLength={32}
          autoComplete="nickname"
          placeholder="e.g. Sam"
          onChange={(e) => setName(e.target.value)}
        />
        <button className="button primary" disabled={!!busy}>
          {busy || "Join the crew"}
          <ArrowUpRight size={20} />
        </button>
        <p className="small">
          Pairing lets this studio’s crew hear your uploaded takes. The
          microphone stays off until you press Record.
        </p>
      </form>
    </main>
  );
}
function Studio({
  session: s,
  busy,
  action,
  notice,
  refresh,
}: {
  session: Session;
  busy: string;
  action: Function;
  notice: Function;
  refresh: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<Role>("footsteps"),
    [qr, setQr] = useState(""),
    [time, setTime] = useState(9),
    [playing, setPlaying] = useState(false),
    [preparing, setPreparing] = useState(false),
    [endConfirm, setEndConfirm] = useState(false);
  const [pictureMode, choosePicture] = usePictureMode();
  const playRequest = useRef(0);
  const playAbort = useRef<AbortController | null>(null);
  useEffect(() => {
    if (isTV && playing && !preparing && !busy)
      document.querySelector<HTMLButtonElement>("#premiere-panel button")
        ?.focus({ preventScroll: true });
  }, [playing, preparing, busy]);
  useEffect(() => rememberStudio(s), [s.id, s.title, s.expires]);
  const player = useRef<{
    context: AudioContext;
    sources: AudioBufferSourceNode[];
    frame: number;
  } | null>(null);
  const base = "/sessions/" + s.id;
  const joinUrl = `${location.origin}/join?code=${s.code}`;
  useEffect(() => {
    QRCode.toDataURL(joinUrl, {
      width: 176,
      margin: 1,
      color: { dark: "#282b27", light: "#f3ecdf" },
    }).then(setQr);
  }, [joinUrl]);
  const stop = useCallback(() => {
    playRequest.current++;
    playAbort.current?.abort();
    setPreparing(false);
    if (player.current) {
      player.current.sources.forEach((n) => {
        try {
          n.stop();
        } catch {}
      });
      cancelAnimationFrame(player.current.frame);
      player.current.context.close();
      player.current = null;
    }
    setPlaying(false);
    api(base + "/stop", "POST")
      .then(refresh)
      .catch(() => {});
  }, [base, refresh]);
  useEffect(
    () => () => {
      if (player.current) {
        cancelAnimationFrame(player.current.frame);
        player.current.context.close();
      }
    },
    [],
  );
  const play = async () => {
    if (playing) {
      stop();
      return;
    }
    if (isTV) {
      const screen = document.querySelector<HTMLElement>(".screen");
      screen?.scrollIntoView({ block: "start", behavior: "instant" });
      // The initiating button becomes disabled while audio is prepared. Keep a
      // stable focus target so remote-focus recovery does not scroll to the nav.
      screen?.focus({ preventScroll: true });
    }
    setPreparing(true);
    const request = ++playRequest.current;
    const abort = new AbortController();
    playAbort.current = abort;
    let context: AudioContext | undefined;
    try {
      context = new AudioContext();
      await context.resume();
      const buffers = new Map<string, AudioBuffer>();
      for (const role of roles) {
        const cid = s.casts[role]!.clipId;
        if (!buffers.has(cid)) {
          const r = await fetch("/api" + base + "/clips/" + cid + "/audio", {
            signal: abort.signal,
          });
          if (!r.ok)
            throw new Error(
              "A cast take could not be loaded. Refresh the studio and try again.",
            );
          buffers.set(
            cid,
            await context.decodeAudioData(await r.arrayBuffer()),
          );
        }
      }
      if (request !== playRequest.current || document.hidden) {
        await context.close();
        return;
      }
      await api(base + "/play", "POST", { revision: s.revision });
      if (request !== playRequest.current || document.hidden) {
        await context.close();
        stop();
        return;
      }
      const start = context.currentTime + 0.2,
        sources: AudioBufferSourceNode[] = [];
      const limiter = context.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.ratio.value = 12;
      limiter.connect(context.destination);
      for (const role of roles) {
        const cast = s.casts[role]!,
          buffer = buffers.get(cast.clipId)!;
        for (const cue of CUES[role]) {
          const source = context.createBufferSource(),
            gain = context.createGain();
          source.buffer = buffer;
          source.loop = role === "weather";
          gain.gain.value = cast.volume * (role === "weather" ? 0.45 : 0.85);
          source.connect(gain);
          gain.connect(limiter);
          source.start(
            start + cue,
            0,
            role === "weather"
              ? 20
              : Math.min(buffer.duration, role === "footsteps" ? 0.85 : 2.6),
          );
          sources.push(source);
        }
      }
      player.current = { context, sources, frame: 0 };
      setTime(0);
      setPlaying(true);
      const tick = () => {
        if (!player.current) return;
        const t = Math.max(0, player.current.context.currentTime - start);
        setTime(Math.min(t, 20));
        if (t >= 20) {
          stop();
          setTime(20);
          return;
        }
        player.current.frame = requestAnimationFrame(tick);
      };
      tick();
      await refresh();
    } catch (e) {
      context?.close();
      if (request !== playRequest.current) return;
      throw e;
    } finally {
      if (playAbort.current === abort) playAbort.current = null;
      setPreparing(false);
    }
  };
  const allCast = roles.every((r) => s.casts[r]);
  useTVControls({
    back: () => {
      if (playing || preparing) {
        stop();
        return true;
      }
      if (endConfirm) {
        setEndConfirm(false);
        return true;
      }
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
        return true;
      }
      if (isTV) {
        location.replace(homeUrl);
        return true;
      }
      return false;
    },
    suspend: () => {
      if (playing || preparing) stop();
    },
    media: () => {
      if (!busy && !preparing && (playing || (allCast && !s.recording)))
        action("Preparing premiere", play);
    },
  });
  const jump = (target: string) => {
    const region = document.getElementById(target);
    const surface = target === "premiere-panel" ? region?.closest(".screen") : region;
    surface?.scrollIntoView({ block: "start", behavior: "instant" });
    region
      ?.querySelector<HTMLElement>('button:not(:disabled),[tabindex="0"]')
      ?.focus({ preventScroll: true });
  };
  const selectedInfo = roleInfo[selected];
  const locked = !!busy || playing || preparing || s.playingUntil > Date.now();
  return (
    <main className="studio">
      <div className="studio-title">
        <div>
          <h1>{s.title}</h1>
          <p>
            {s.premieres
              ? `${s.premieres} premiere${s.premieres === 1 ? "" : "s"} · The next cut is yours.`
              : "A silent picture. Your sounds make the story."}
          </p>
        </div>
        <button
          className="text-link"
          onClick={() => setEndConfirm(!endConfirm)}
        >
          <X size={15} /> End studio
        </button>
      </div>
      <nav className="studio-route" aria-label="Direct your picture">
        <button
          data-remote-primary={!s.clips.length || undefined}
          onClick={() => jump("crew-panel")}
        >
          <Smartphone size={20} />
          <span>Pair crew</span>
          <small>
            {s.crew.filter((member) => member.kind !== "host").length} in the
            room
          </small>
        </button>
        <button
          data-remote-primary={(!!s.clips.length && !allCast) || undefined}
          onClick={() => jump("cast-panel")}
        >
          <AudioLines size={20} />
          <span>Cast sounds</span>
          <small>
            {roles.filter((role) => s.casts[role]).length} of 3 roles
          </small>
        </button>
        <button
          data-remote-primary={allCast || undefined}
          onClick={() => jump("premiere-panel")}
        >
          <Clapperboard size={20} />
          <span>Premiere</span>
          <small>
            {allCast ? "Ready for action" : "Cast three roles first"}
          </small>
        </button>
      </nav>
      {endConfirm && (
        <div className="end-confirm">
          <p>End this studio and permanently delete every recording?</p>
          <button
            className="button danger"
            onClick={() =>
              action("Ending studio", async () => {
                await api(base, "DELETE");
                forgetStudio();
                location.href = homeUrl;
              })
            }
          >
            Delete studio & takes
          </button>
          <button
            className="button secondary"
            onClick={() => setEndConfirm(false)}
          >
            Keep creating
          </button>
        </div>
      )}
      <div className="studio-grid">
        <section className={`screen ${playing ? "is-playing" : ""}`} tabIndex={isTV ? -1 : undefined}>
          <div className="screen-top">
            <span>
              <span className={playing ? "live-dot" : "quiet-dot"} />
              {playing
                ? "Premiere in progress"
                : "Original picture · Foley no. 1"}
            </span>
            <span>{Math.floor(time).toString().padStart(2, "0")} / 20s</span>
          </div>
          <div className="picture">
            <Film time={time} playing={playing} mode={pictureMode} />
            {time >= 20 && (
              <div className="film-credits">
                <h2>That’s your picture.</h2>
                <p>Sound by the people in this room.</p>
                <div>
                  {roles.map((r) => (
                    <span key={r}>
                      <strong>{roleInfo[r].title}</strong>
                      {s.clips.find((c) => c.id === s.casts[r]?.clipId)
                        ?.contributor || "The crew"}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="transport" id="premiere-panel">
            <button
              className="button primary"
              disabled={
                !!busy ||
                preparing ||
                (!allCast && !playing) ||
                (!playing && !!s.recording)
              }
              onClick={() => action("Preparing premiere", play)}
            >
              {preparing ? (
                <RefreshCw className="spin" size={19} />
              ) : playing ? (
                <Square size={18} />
              ) : (
                <Play size={19} fill="currentColor" />
              )}
              {preparing
                ? "Preparing soundtrack"
                : playing
                  ? "Stop premiere"
                  : s.premieres
                    ? "Play the next cut"
                    : "Premiere your film"}
            </button>
            <span>
              {playing
                ? "The sound crew is on the big screen."
                : !allCast
                  ? `Cast ${3 - roles.filter((r) => s.casts[r]).length} more role${roles.filter((r) => s.casts[r]).length === 2 ? "" : "s"} to call action.`
                  : s.recording
                    ? "A microphone is rolling…"
                    : "Your soundtrack is ready."}
            </span>
            <button
              className="fullscreen-button"
              aria-label="Fill screen with film"
              onClick={() =>
                document
                  .querySelector(".screen")
                  ?.requestFullscreen?.()
                  .catch(() =>
                    notice("Full screen is unavailable in this browser."),
                  )
              }
            >
              <Maximize2 size={19} />
            </button>
          </div>
          <PictureChoice mode={pictureMode} choose={choosePicture} />
          <div className="timeline" aria-label="Film cue timeline">
            <div
              className="timeline-progress"
              style={{ width: `${time * 5}%` }}
            />
            {roles.map((role) => (
              <div className={`cue-row ${role}`} key={role}>
                <span>{roleInfo[role].title}</span>
                <div>
                  {CUES[role].map((cue, i) => (
                    <i
                      key={i}
                      style={{
                        left: `${cue * 5}%`,
                        width:
                          role === "weather"
                            ? "100%"
                            : role === "footsteps"
                              ? "3%"
                              : "10%",
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
        <aside className="pairing" id="crew-panel">
          <div className="pair-heading">
            <Smartphone size={22} />
            <h2>Bring the crew in.</h2>
          </div>
          <p>
            Scan with a phone camera.
            <br />
            The phone is your microphone.
          </p>
          {qr && (
            <img
              className="qr"
              src={qr}
              width="150"
              height="150"
              alt="QR code to pair a phone with this studio"
            />
          )}
          <div className="pair-code">{s.code}</div>
          <p className="code-time">
            {(s.codeExpires || 0) > Date.now()
              ? "Pairing code expires in " +
                Math.max(
                  1,
                  Math.ceil(((s.codeExpires || 0) - Date.now()) / 60000),
                ) +
                " min"
              : "Pairing code expired"}
          </p>
          <div className="pair-actions">
            <button
              className="text-link"
              onClick={() => {
                navigator.clipboard
                  .writeText(joinUrl)
                  .then(() => notice("Phone link copied."))
                  .catch(() => notice(joinUrl));
              }}
            >
              <Copy size={15} /> Copy link
            </button>
            <button
              className="text-link"
              disabled={!!busy}
              onClick={() =>
                action("Refreshing code", async () =>
                  api(base + "/code", "POST"),
                )
              }
            >
              <RefreshCw size={15} /> New code
            </button>
          </div>
          <div className="crew-list">
            <span className="crew-label">On the crew · {s.crew.length}</span>
            {s.crew.map((m) => (
              <div key={m.id}>
                <span className="avatar">{m.name.slice(0, 1)}</span>
                <span>{m.name}</span>
                <span className="crew-role">
                  {m.kind === "host"
                    ? "Directing"
                    : s.recording === m.id
                      ? "Recording"
                      : "Paired"}
                </span>
              </div>
            ))}
          </div>
          {location.hostname === "localhost" && (
            <p className="local-note">
              Local studio: phone recording needs this app served over HTTPS.
              You can upload a take here to try the complete edit.
            </p>
          )}
        </aside>
      </div>
      <section className="casting" id="cast-panel">
        <div className="section-head">
          <div>
            <h2>Cast the sound.</h2>
            <p>One take can play any part. That’s where it gets interesting.</p>
          </div>
          <span className="count-label">{s.clips.length} / 18 takes</span>
        </div>
        <div className="casting-grid">
          <div className="role-tabs" role="tablist" aria-label="Sound roles">
            {roles.map((role) => {
              const Icon = roleInfo[role].icon,
                clip = s.clips.find((c) => c.id === s.casts[role]?.clipId);
              return (
                <button
                  role="tab"
                  aria-selected={role === selected}
                  aria-controls="take-panel"
                  key={role}
                  className={`role-tab ${roleInfo[role].color} ${role === selected ? "selected" : ""}`}
                  onClick={() => setSelected(role)}
                >
                  <Icon size={27} />
                  <div>
                    <strong>{roleInfo[role].title}</strong>
                    <span>{clip ? clip.name : "Waiting for its voice"}</span>
                  </div>
                  {clip ? <Check size={18} /> : <Plus size={18} />}
                </button>
              );
            })}
          </div>
          <div id="take-panel" role="tabpanel" className="take-panel">
            <div className="take-panel-title">
              <div>
                <h3>{selectedInfo.hint}</h3>
                <p>{selectedInfo.tip}</p>
              </div>
              {s.casts[selected] && (
                <button
                  className="text-link"
                  disabled={locked}
                  onClick={() =>
                    action("Clearing role", async () =>
                      api(base + "/cast", "POST", {
                        role: selected,
                        clipId: null,
                        revision: s.revision,
                      }),
                    )
                  }
                >
                  Clear role
                </button>
              )}
            </div>
            {s.clips.length === 0 ? (
              <div className="empty-takes">
                <div className="empty-wave">
                  <AudioLines size={45} />
                </div>
                <h3>The first sound is yours.</h3>
                <p>
                  Pair a phone to record, or upload a short audio take below.
                  Your recordings will appear here.
                </p>
              </div>
            ) : (
              <div className="take-list">
                {s.clips.map((c) => (
                  <Take
                    key={c.id}
                    clip={c}
                    session={s}
                    selected={s.casts[selected]?.clipId === c.id}
                    disabled={locked}
                    onCast={() =>
                      action("Casting take", async () => {
                        await api(base + "/cast", "POST", {
                          role: selected,
                          clipId: c.id,
                          revision: s.revision,
                        });
                        notice(
                          `${c.name} is now ${roleInfo[selected].title.toLowerCase()}.`,
                        );
                      })
                    }
                    onDelete={() =>
                      action("Removing take", async () =>
                        api(base + "/clips/" + c.id, "DELETE"),
                      )
                    }
                  />
                ))}
              </div>
            )}
            {s.casts[selected] && (
              <label className="volume">
                <Volume2 size={17} /> Role volume
                <select
                  aria-label="Role volume"
                  disabled={locked}
                  value={s.casts[selected]!.volume}
                  onChange={(e) =>
                    action("Setting volume", async () =>
                      api(base + "/cast", "POST", {
                        role: selected,
                        clipId: s.casts[selected]!.clipId,
                        volume: Number(e.target.value),
                        revision: s.revision,
                      }),
                    )
                  }
                >
                  <option value="0.4">Soft</option>
                  <option value="0.8">Balanced</option>
                  <option value="1">Loud</option>
                </select>
              </label>
            )}
            <UploadTake
              session={s}
              busy={busy}
              action={action}
              notice={notice}
            />
          </div>
        </div>
      </section>
      <div className="director-note">
        <Headphones size={20} />
        <p>
          Leave recording turns quiet. Foley pauses uploads during the premiere
          so the room’s soundtrack stays out of your takes.
        </p>
        <span>Arrow keys to move · Enter to select</span>
      </div>
    </main>
  );
}
function Take({
  clip: c,
  session: s,
  selected = false,
  disabled = false,
  onCast,
  onDelete,
}: {
  clip: Clip;
  session: Session;
  selected?: boolean;
  disabled?: boolean;
  onCast?: () => void;
  onDelete: () => void;
}) {
  const [preview, setPreview] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(
    () => () => {
      audio.current?.pause();
    },
    [],
  );
  useEffect(() => {
    if (disabled) {
      audio.current?.pause();
      setPreview(false);
    }
  }, [disabled]);
  const audition = () => {
    if (preview) {
      audio.current?.pause();
      setPreview(false);
      return;
    }
    audio.current = new Audio(
      "/api/sessions/" + s.id + "/clips/" + c.id + "/audio",
    );
    audio.current.onended = () => setPreview(false);
    audio.current.onerror = () => setPreview(false);
    audio.current
      .play()
      .then(() => setPreview(true))
      .catch(() => setPreview(false));
  };
  return (
    <div className={`take ${selected ? "cast" : ""}`}>
      <button
        className="take-play"
        disabled={disabled}
        aria-label={`${preview ? "Stop" : "Preview"} ${c.name}`}
        onClick={audition}
      >
        {preview ? (
          <Square size={15} />
        ) : (
          <Play size={15} fill="currentColor" />
        )}
      </button>
      <div className="take-name">
        <strong>{c.name}</strong>
        <span>
          {c.contributor} · {c.duration.toFixed(1)}s
        </span>
      </div>
      <div className="waveform" aria-hidden="true">
        {c.peaks.map((peak, i) => (
          <i key={i} style={{ height: Math.max(3, peak * 29) }} />
        ))}
      </div>
      {onCast && (
        <button
          className={`button ${selected ? "cast-button" : "secondary"} small-button`}
          disabled={disabled || selected}
          onClick={onCast}
        >
          {selected ? (
            <>
              <Check size={14} /> Cast
            </>
          ) : (
            "Cast take"
          )}
        </button>
      )}
      <button
        className="delete-take"
        aria-label={"Delete " + c.name}
        disabled={disabled}
        onClick={onDelete}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
function UploadTake({
  session: s,
  busy,
  action,
  notice,
}: {
  session: Session;
  busy: string;
  action: Function;
  notice: Function;
}) {
  const [file, setFile] = useState<File | null>(null),
    [name, setName] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const upload = async () => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024)
      throw new Error("Choose an audio recording smaller than 4 MB.");
    const response = await fetch(`/api/sessions/${s.id}/clips`, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Take-Name": encodeURIComponent(
          name || file.name.replace(/\.[^.]+$/, ""),
        ),
      },
      body: file,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    setFile(null);
    setName("");
    if (input.current) input.current.value = "";
    notice("Take prepared and added to the studio.");
  };
  return (
    <div className="upload-take">
      <input
        ref={input}
        type="file"
        accept="audio/wav,audio/x-wav,audio/mpeg,audio/mp4,audio/webm,audio/ogg,audio/aac,audio/flac"
        id={"upload-" + s.role}
        className="file-input"
        disabled={!!busy || s.playingUntil > Date.now()}
        onChange={(e) => {
          const f = e.target.files?.[0] || null;
          setFile(f);
          setName(f?.name.replace(/\.[^.]+$/, "").slice(0, 48) || "");
        }}
      />
      <button
        className="text-link"
        disabled={!!busy || s.playingUntil > Date.now()}
        onClick={() => input.current?.click()}
      >
        <Upload size={17} />
        {file ? "Choose another file" : "Upload an audio take"}
      </button>
      <span>0.2–8 seconds · up to 4 MB</span>
      {file && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            action("Preparing take", upload);
          }}
        >
          <label>
            Name this take
            <input
              value={name}
              required
              maxLength={48}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button className="button primary" disabled={!!busy}>
            {busy || "Send take"}
            <ArrowUpRight size={17} />
          </button>
          <button
            type="button"
            className="text-link"
            onClick={() => setFile(null)}
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}
function Microphone({
  session: s,
  busy,
  action,
  notice,
}: {
  session: Session;
  busy: string;
  action: Function;
  notice: Function;
}) {
  const [recording, setRecording] = useState(false),
    [seconds, setSeconds] = useState(0),
    [blob, setBlob] = useState<Blob | null>(null),
    [url, setUrl] = useState(""),
    [name, setName] = useState(""),
    [level, setLevel] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    meter = useRef<AudioContext | null>(null),
    frame = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const base = "/sessions/" + s.id;
  const release = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    meter.current?.close();
    meter.current = null;
    cancelAnimationFrame(frame.current);
    if (timer.current) clearTimeout(timer.current);
    setRecording(false);
    setLevel(0);
  };
  useEffect(
    () => () => {
      release();
    },
    [],
  );
  useEffect(() => {
    if (!blob) {
      setUrl("");
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  const stop = () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  };
  const record = async () => {
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error(
        "Microphone recording needs HTTPS (or localhost). Use an audio upload here, or open the secure studio link.",
      );
    await api(base + "/recording", "POST", { active: true });
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      stream.current = media;
      await api(base + "/recording", "POST", { active: true });
      const mime = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((t) => MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(media, mime ? { mimeType: mime } : undefined);
      recorder.current = r;
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      r.onstop = () => {
        setBlob(new Blob(chunks, { type: r.mimeType }));
        setName(
          "Take " + (s.clips.filter((c) => c.member_id === s.me.id).length + 1),
        );
        release();
        api(base + "/recording", "POST", { active: false }).catch(() => {});
      };
      r.onerror = () => {
        release();
        api(base + "/recording", "POST", { active: false }).catch(() => {});
      };
      setBlob(null);
      setSeconds(0);
      setRecording(true);
      meter.current = new AudioContext();
      const analyser = meter.current.createAnalyser();
      analyser.fftSize = 256;
      meter.current.createMediaStreamSource(media).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount),
        start = performance.now();
      const tick = () => {
        analyser.getByteFrequencyData(data);
        setLevel(data.reduce((a, b) => a + b, 0) / data.length / 255);
        setSeconds(Math.min(8, (performance.now() - start) / 1000));
        frame.current = requestAnimationFrame(tick);
      };
      r.start();
      tick();
      timer.current = setTimeout(stop, 7900);
    } catch (e) {
      release();
      await api(base + "/recording", "POST", { active: false });
      throw new Error(
        (e as Error).name === "NotAllowedError"
          ? "Microphone permission was denied. Allow it in your browser, or upload a recording."
          : (e as Error).message,
      );
    }
  };
  const send = async () => {
    if (!blob) return;
    const res = await fetch("/api" + base + "/clips", {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Take-Name": encodeURIComponent(name),
      },
      body: blob,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setBlob(null);
    setName("");
    notice("You’re in the picture. Your take is on the TV.");
  };
  const locked =
    !!busy ||
    s.playingUntil > Date.now() ||
    !!(s.recording && s.recording !== s.me.id);
  return (
    <main className="microphone">
      <div className="mic-intro">
        <h1>
          Make it
          <br />
          <span>sound like you.</span>
        </h1>
        <p>
          {s.playingUntil > Date.now()
            ? "Quiet on set. Look up at the TV."
            : "Your microphone. Your moment. Eight seconds is plenty."}
        </p>
      </div>
      <section className={`recorder ${recording ? "recording" : ""}`}>
        <div className="record-status">
          <span className={recording ? "live-dot" : "quiet-dot"} />
          {recording
            ? "Microphone rolling"
            : blob
              ? "Take ready to audition"
              : "Microphone off"}
          <span>{seconds.toFixed(1)} / 8s</span>
        </div>
        <div className="meter" aria-hidden="true">
          {Array.from({ length: 29 }, (_, i) => (
            <i
              key={i}
              style={{
                height: recording
                  ? 12 +
                    level * 120 * (0.5 + Math.sin(i * 1.7 + seconds * 9) * 0.5)
                  : 8 + Math.sin(i * 0.55) ** 2 * 23,
              }}
            />
          ))}
        </div>
        <button
          className={`record-button ${recording ? "active" : ""}`}
          disabled={locked && !recording}
          onClick={() =>
            recording ? stop() : action("Opening microphone", record)
          }
          aria-label={recording ? "Stop recording" : "Record a take"}
        >
          {recording ? (
            <Square size={31} fill="currentColor" />
          ) : (
            <Mic size={34} />
          )}
        </button>
        <strong className="record-instruction">
          {recording
            ? "Tap to finish your take"
            : blob
              ? "Record another take"
              : "Tap to record"}
        </strong>
        <p className="small">
          Only your saved takes are shared with this crew.
        </p>
        {blob && (
          <form
            className="review-take"
            onSubmit={(e) => {
              e.preventDefault();
              action("Preparing take", send);
            }}
          >
            <audio src={url} controls />
            <label>
              Name your sound
              <input
                value={name}
                required
                maxLength={48}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <div>
              <button className="button primary" disabled={locked}>
                {busy || "Send to the picture"}
                <ArrowUpRight size={18} />
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={!!busy}
                onClick={() => {
                  setBlob(null);
                  setSeconds(0);
                }}
              >
                Discard
              </button>
            </div>
          </form>
        )}
      </section>
      <section className="sound-prompts">
        <h2>What could you make?</h2>
        {roles.map((r) => {
          const I = roleInfo[r].icon;
          return (
            <div key={r}>
              <I size={22} />
              <div>
                <strong>{roleInfo[r].title}</strong>
                <p>{roleInfo[r].tip}</p>
              </div>
            </div>
          );
        })}
      </section>
      <section className="your-takes">
        <h2>
          Your takes{" "}
          <span>{s.clips.filter((c) => c.member_id === s.me.id).length}/6</span>
        </h2>
        {s.clips
          .filter((c) => c.member_id === s.me.id)
          .map((c) => (
            <Take
              key={c.id}
              clip={c}
              session={s}
              disabled={locked || recording}
              onDelete={() =>
                action("Removing take", async () =>
                  api(base + "/clips/" + c.id, "DELETE"),
                )
              }
            />
          ))}
        <UploadTake session={s} busy={busy} action={action} notice={notice} />
      </section>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
