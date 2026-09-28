import { useEffect, useRef, useState } from "react";
export const isTV =
  location.pathname === "/tv" ||
  new URLSearchParams(location.search).get("tv") === "1";
export const homeUrl = isTV ? "/tv" : "/";
export const studioUrl = (id: string) => `/studio/${id}${isTV ? "?tv=1" : ""}`;
export type PictureMode = "2d" | "3d";
export function usePictureMode() {
  const [mode, setMode] = useState<PictureMode>(() => {
    try {
      const saved = localStorage.getItem("foley.picture");
      if (saved === "2d" || saved === "3d") return saved;
    } catch {}
    return isTV ? "2d" : "3d";
  });
  const choose = (next: PictureMode) => {
    setMode(next);
    try {
      localStorage.setItem("foley.picture", next);
    } catch {}
  };
  return [mode, choose] as const;
}
export function PictureChoice({
  mode,
  choose,
}: {
  mode: PictureMode;
  choose: (mode: PictureMode) => void;
}) {
  return (
    <div className="picture-choice" role="group" aria-label="Picture style">
      <span>Picture</span>
      <button
        type="button"
        aria-pressed={mode === "2d"}
        onClick={() => choose("2d")}
      >
        2D · light
      </button>
      <button
        type="button"
        aria-pressed={mode === "3d"}
        onClick={() => choose("3d")}
      >
        3D · cinema
      </button>
    </div>
  );
}
declare global {
  interface Window {
    FoleyTV?: { back: () => boolean; suspend: () => void; media: () => void };
  }
}
export function useTVControls(controls: {
  back: () => boolean;
  suspend: () => void;
  media: () => void;
}) {
  const current = useRef(controls);
  current.current = controls;
  useEffect(() => {
    const bridge = {
      back: () => current.current.back(),
      suspend: () => current.current.suspend(),
      media: () => current.current.media(),
    };
    window.FoleyTV = bridge;
    const key = (event: KeyboardEvent) => {
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          (event.target as HTMLElement)?.tagName,
        )
      )
        return;
      if (
        (event.key === "Escape" || event.key === "BrowserBack") &&
        bridge.back()
      )
        event.preventDefault();
      if (event.key === "MediaPlayPause") {
        event.preventDefault();
        bridge.media();
      }
    };
    const visibility = () => {
      if (document.hidden) bridge.suspend();
    };
    window.addEventListener("keydown", key);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      if (window.FoleyTV === bridge) delete window.FoleyTV;
      window.removeEventListener("keydown", key);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
}
export function rememberStudio(session: {
  id: string;
  title: string;
  expires: number;
}) {
  try {
    localStorage.setItem(
      "foley.lastStudio",
      JSON.stringify({
        id: session.id,
        title: session.title,
        expires: session.expires,
      }),
    );
  } catch {}
}
export function forgetStudio() {
  try {
    localStorage.removeItem("foley.lastStudio");
  } catch {}
}
export function previousStudio(): string | null {
  try {
    const saved = JSON.parse(
      localStorage.getItem("foley.lastStudio") || "null",
    );
    return saved &&
      /^[a-zA-Z0-9-]+$/.test(saved.id) &&
      saved.expires > Date.now()
      ? saved.id
      : null;
  } catch {
    return null;
  }
}
