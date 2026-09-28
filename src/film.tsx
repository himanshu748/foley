import { useEffect, useRef, useState } from "react";
import { FlatFilm } from "./film-flat";
import type { FilmScene } from "./film-three";
export const CUES = {
  footsteps: [2.6, 4.1, 5.6, 7.1, 8.6, 10.1],
  weather: [0],
  creature: [12.8, 17.2],
};

/** The audio owner supplies time; this surface never starts a clock or sound. */
export function Film({
  time = 0,
  playing = false,
  mode = "3d",
}: {
  time?: number;
  playing?: boolean;
  mode?: "2d" | "3d";
}) {
  const container = useRef<HTMLDivElement>(null);
  const runtime = useRef<FilmScene | null>(null);
  const latest = useRef(time);
  const visiblePoster = useRef(time);
  latest.current = time;
  const [visible, setVisible] = useState(false);
  if (visible) visiblePoster.current = time;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const node = container.current!;
    let onScreen = false;
    const update = () => setVisible(onScreen && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      update();
    });
    observer.observe(node);
    document.addEventListener("visibilitychange", update);
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(preference.matches);
    preference.addEventListener("change", change);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      preference.removeEventListener("change", change);
    };
  }, []);
  useEffect(() => {
    if (!visible || failed || mode === "2d") return;
    let disposed = false;
    let scene: FilmScene | undefined;
    const canvas = document.createElement("canvas");
    canvas.className = "film-three-canvas";
    canvas.setAttribute("aria-hidden", "true");
    const lost = (event: Event) => {
      event.preventDefault();
      setFailed(true);
    };
    canvas.addEventListener("webglcontextlost", lost);
    import("./film-three")
      .then(({ createFilmScene }) => {
        if (disposed) return;
        try {
          container.current!.appendChild(canvas);
          scene = createFilmScene(canvas);
          runtime.current = scene;
          scene.draw(latest.current, reduced);
          setReady(true);
        } catch {
          scene?.dispose();
          canvas.remove();
          setFailed(true);
        }
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
      canvas.removeEventListener("webglcontextlost", lost);
      scene?.dispose();
      canvas.remove();
      runtime.current = null;
      setReady(false);
    };
  }, [visible, failed, mode]);
  useEffect(() => {
    try {
      runtime.current?.draw(time, reduced);
    } catch {
      setFailed(true);
    }
  }, [time, reduced, ready]);
  return (
    <div
      ref={container}
      className="film-canvas film-frame"
      role="img"
      data-renderer={
        mode === "2d"
          ? "2d-selected"
          : ready
            ? "three"
            : failed
              ? "2d-fallback"
              : "2d-poster"
      }
      aria-label="Original animated film: a mint-green monster approaches a warmly lit miniature cabin in a storm, then opens an umbrella."
    >
      {(!ready || mode === "2d") && (
        <div className="film-flat-layer" aria-hidden="true">
          <FlatFilm
            time={visible ? time : visiblePoster.current}
            playing={playing && visible}
            reduced={reduced}
          />
        </div>
      )}
      {failed && (
        <span className="film-fallback-note">
          2D picture · sound stays in sync
        </span>
      )}
    </div>
  );
}
