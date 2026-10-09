import express from "express";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createStore, fail } from "./store.mjs";
import { normalizeAudio } from "./audio.mjs";
export async function createApp({
  database = process.env.DATA_PATH || "data/foley.sqlite",
  dev = false,
  trustProxy = process.env.TRUST_PROXY === "1",
} = {}) {
  const app = express(),
    store = createStore(database);
  app.disable("x-powered-by");
  // Enable only when a single trusted proxy is the sole route to this server.
  if (trustProxy) app.set("trust proxy", 1);
  if (!dev)
    app.use((_req, res, next) => {
      res.set(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      );
      next();
    });
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy": "camera=(), geolocation=(), microphone=(self)",
      "Cache-Control": "no-store",
      "X-Frame-Options": "DENY",
    });
    const origin = req.get("origin");
    const expected = process.env.PUBLIC_URL
      ? new URL(process.env.PUBLIC_URL).origin
      : `${req.protocol}://${req.get("host")}`;
    if (
      req.method !== "GET" &&
      ((origin && origin !== expected) ||
        req.get("sec-fetch-site") === "cross-site")
    )
      return res
        .status(403)
        .json({ error: "Open Foley directly to use this studio." });
    next();
  });
  const limits = new Map();
  const rate = (bucket, max) => (req, res, next) => {
    const key = `${bucket}:${req.ip}`;
    const now = Date.now(),
      entry = limits.get(key);
    if (!entry || entry.until < now)
      limits.set(key, { n: 1, until: now + 900000 });
    else if (++entry.n > max)
      return res.status(429).json({
        error: "Too many requests. Wait a few minutes, then try again.",
      });
    if (limits.size > 10000)
      for (const [k, v] of limits) if (v.until < now) limits.delete(k);
    next();
  };
  app.use("/api", express.json({ limit: "16kb" }));
  function tokens(req) {
    const c = Object.fromEntries(
      (req.get("cookie") || "").split(";").map((s) => s.trim().split("=")),
    );
    return [c.foley_host, c.foley_crew];
  }
  function cookie(res, key, value, sessionId) {
    res.cookie(key, value, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.PUBLIC_URL?.startsWith("https://") || false,
      maxAge: 21600000,
      path: "/api/sessions/" + sessionId,
    });
  }
  const endpoint = (fn) => async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (error) {
      next(error);
    }
  };
  app.get("/api/health", (_req, res) =>
    res.json({ ok: true, storage: "sqlite", aws: false }),
  );
  app.post(
    "/api/sessions",
    rate("create", 12),
    endpoint((req, res) => {
      const s = store.create(req.body?.title || "A visitor in the storm");
      cookie(res, "foley_host", s.token, s.id);
      res.status(201).json({ id: s.id });
    }),
  );
  app.post(
    "/api/join",
    rate("join", 40),
    endpoint((req, res) => {
      const s = store.join(req.body?.code, req.body?.name);
      cookie(res, "foley_crew", s.token, s.id);
      res.json({ id: s.id });
    }),
  );
  app.get(
    "/api/sessions/:id",
    endpoint((req, res) =>
      res.json(
        store.snapshot(req.params.id, store.member(req.params.id, tokens(req))),
      ),
    ),
  );
  app.post(
    "/api/sessions/:id/code",
    endpoint((req, res) => {
      store.refresh(req.params.id, tokens(req));
      res.json({ ok: true });
    }),
  );
  let processing = 0;
  app.post(
    "/api/sessions/:id/clips",
    rate("upload", 50),
    express.raw({ type: () => true, limit: "4mb" }),
    endpoint(async (req, res) => {
      const member = store.member(req.params.id, tokens(req));
      if (processing >= 2)
        fail(503, "Two takes are being prepared. Try again in a moment.");
      processing++;
      try {
        const audio = await normalizeAudio(req.body);
        const id = store.addClip(
          req.params.id,
          member,
          decodeURIComponent(req.get("x-take-name") || "New take"),
          audio.duration,
          audio.bytes,
          audio.peaks,
        );
        res.status(201).json({ id });
      } finally {
        processing--;
      }
    }),
  );
  app.get(
    "/api/sessions/:id/clips/:clip/audio",
    endpoint((req, res) => {
      res
        .type("audio/wav")
        .send(
          Buffer.from(store.clip(req.params.id, req.params.clip, tokens(req))),
        );
    }),
  );
  app.delete(
    "/api/sessions/:id/clips/:clip",
    endpoint((req, res) => {
      store.removeClip(
        req.params.id,
        store.member(req.params.id, tokens(req)),
        req.params.clip,
      );
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/sessions/:id/cast",
    endpoint((req, res) => {
      const b = req.body || {};
      store.cast(
        req.params.id,
        tokens(req),
        b.role,
        b.clipId,
        b.revision,
        b.volume,
      );
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/sessions/:id/recording",
    endpoint((req, res) => {
      if (typeof req.body?.active !== "boolean")
        fail(400, "Recording state must be true or false.");
      store.recording(
        req.params.id,
        store.member(req.params.id, tokens(req)),
        req.body.active,
      );
      res.json({ ok: true });
    }),
  );
  app.get(
    "/api/sessions/:id/cuts",
    endpoint((req, res) => {
      res.json({ cuts: store.listCuts(req.params.id, tokens(req)) });
    }),
  );
  app.put(
    "/api/sessions/:id/cuts/:slot",
    endpoint((req, res) => {
      const result = store.saveCut(
        req.params.id,
        tokens(req),
        req.params.slot,
        req.body,
      );
      res.status(result.created ? 201 : 200).json({ cut: result.cut });
    }),
  );
  app.post(
    "/api/sessions/:id/cuts/:slot/play",
    endpoint((req, res) => {
      res.json(
        store.playCut(
          req.params.id,
          tokens(req),
          req.params.slot,
          req.body?.cutId,
        ),
      );
    }),
  );
  app.delete(
    "/api/sessions/:id/cuts/:slot",
    endpoint((req, res) => {
      store.deleteCut(
        req.params.id,
        tokens(req),
        req.params.slot,
        req.body?.cutId,
      );
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/sessions/:id/play",
    endpoint((req, res) => {
      const playbackId = store.play(
        req.params.id,
        tokens(req),
        req.body?.revision,
      );
      res.json({ ok: true, playbackId });
    }),
  );
  app.post(
    "/api/sessions/:id/stop",
    endpoint((req, res) => {
      store.stop(req.params.id, tokens(req), req.body?.playbackId);
      res.json({ ok: true });
    }),
  );
  app.delete(
    "/api/sessions/:id",
    endpoint((req, res) => {
      store.end(req.params.id, tokens(req));
      res.json({ ok: true });
    }),
  );
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "That Foley action does not exist." }),
  );
  if (dev) {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(
      express.static(resolve("dist"), {
        maxAge: "1h",
        setHeaders: (res) => res.set("Cache-Control", "public,max-age=3600"),
      }),
    );
    app.get("/{*path}", (_req, res) =>
      res.sendFile(resolve("dist/index.html")),
    );
  }
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status || 500;
    if (status >= 500) console.error(error.message);
    res.status(status).json({
      ...(error.missingClipIds ? { missingClipIds: error.missingClipIds } : {}),
      error:
        status === 500
          ? "The studio could not finish that action. Try again."
          : error.type === "entity.too.large"
            ? "Choose an audio recording smaller than 4 MB."
            : error.message,
    });
  });
  const cleanup = setInterval(() => store.cleanup(), 60000);
  cleanup.unref();
  return {
    app,
    store,
    close: () => {
      clearInterval(cleanup);
      store.close();
    },
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const runtime = await createApp({ dev: process.argv.includes("--dev") });
  const port = Number(process.env.PORT || 4331);
  const server = runtime.app.listen(port, process.env.HOST || "127.0.0.1", () =>
    console.log(`Foley studio: http://localhost:${port}`),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () =>
      server.close(() => {
        runtime.close();
        process.exit(0);
      }),
    );
}
