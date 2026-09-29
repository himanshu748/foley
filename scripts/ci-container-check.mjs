// Runs only against the isolated localhost Compose project created by the CI
// launcher. Cookies, pairing codes, audio and local CA keys are never artifacts.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";

assert.equal(process.env.GITHUB_ACTIONS, "true");
assert.match(process.env.COMPOSE_PROJECT_NAME || "", /^foley-acceptance-\d+-\d+$/);
assert.equal(process.env.FOLEY_HOST, "localhost");
const compose = (...args) => execFileSync("docker", ["compose", ...args], { encoding: "utf8" }).trim();
const inspect = (id) => JSON.parse(execFileSync("docker", ["inspect", id], { encoding: "utf8" }))[0];
const checks = [];
const evidence = {
  ok: false,
  source_commit: process.env.GITHUB_SHA || null,
  origin: "https://localhost",
  tls: "Caddy local CA on an ephemeral GitHub runner; no public certificate or deployment",
  audio: "Synthetic 1-second WAV; no microphone or audible hardware claim",
  checks,
};
const request = async (path, { method = "GET", cookie, body, raw, headers = {} } = {}) => {
  const res = await fetch("https://localhost/api" + path, {
    method,
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    headers: {
      Origin: "https://localhost",
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(raw ? { "Content-Type": "application/octet-stream", "X-Take-Name": "CI%20tone" } : {}),
      ...headers,
    },
    body: raw || (body ? JSON.stringify(body) : undefined),
  });
  const data = res.headers.get("content-type")?.includes("json") ? await res.json() : Buffer.from(await res.arrayBuffer());
  return { res, data, cookie: res.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ") };
};
const wav = () => {
  const bytes = Buffer.alloc(44 + 48000 * 2);
  bytes.write("RIFF"); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(48000, 24); bytes.writeUInt32LE(96000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36); bytes.writeUInt32LE(96000, 40);
  for (let i = 0; i < 48000; i++) bytes.writeInt16LE(Math.sin(i / 48000 * 440 * Math.PI * 2) * 10000, 44 + i * 2);
  return bytes;
};
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

try {
  const firstApp = compose("ps", "-q", "app"), app = inspect(firstApp), caddy = inspect(compose("ps", "-q", "caddy"));
  assert.equal(app.Config.User, "node");
  assert.equal(app.State.Health.Status, "healthy");
  assert.equal(Object.values(app.NetworkSettings.Ports).some(Boolean), false, "App port must remain unpublished");
  const dataVolume = app.Mounts.find((mount) => mount.Destination === "/app/data");
  assert.equal(dataVolume?.Type, "volume");
  assert(dataVolume.Name.startsWith(process.env.COMPOSE_PROJECT_NAME + "_"));
  evidence.images = { app: app.Image, caddy: caddy.Image };
  checks.push("Image runs as node, is healthy, has a named data volume and no published app port");

  const redirect = await fetch("http://localhost/api/health", { redirect: "manual", signal: AbortSignal.timeout(5000) });
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get("location"), "https://localhost/api/health");
  await redirect.arrayBuffer();
  const health = await request("/health");
  assert.equal(health.res.status, 200);
  assert.deepEqual(health.data, { ok: true, storage: "sqlite", aws: false });
  const home = await fetch("https://localhost", { signal: AbortSignal.timeout(5000) });
  assert.equal(home.status, 200);
  assert.match(home.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  const entry = (await home.text()).match(/src="(\/assets\/[^\"]+\.js)"/);
  assert(entry, "Production HTML must reference the built browser entry point");
  const bundle = await fetch("https://localhost" + entry[1], { signal: AbortSignal.timeout(5000) });
  assert.equal(bundle.status, 200);
  assert((await bundle.arrayBuffer()).byteLength > 0);
  checks.push("Caddy redirects HTTP to HTTPS and serves health with a trusted local certificate");
  checks.push("Production HTML, security policy and built browser bundle are served through Caddy");

  // Secure is configured from PUBLIC_URL; this checks cookie policy, not trust
  // in X-Forwarded-Proto. The forwarding boundary is tested with client IPs below.
  const created = await request("/sessions", { method: "POST", body: { title: "Disposable container acceptance" } });
  assert.equal(created.res.status, 201);
  for (const flag of ["HttpOnly", "Secure", "SameSite=Strict"]) assert(created.res.headers.get("set-cookie").includes(flag));
  const base = "/sessions/" + created.data.id, host = created.cookie;
  assert(created.res.headers.get("set-cookie").includes("Path=/api" + base));
  assert.equal((await request(base)).res.status, 401);
  const state = (await request(base, { cookie: host })).data;
  assert.equal((await request(base + "/code", { method: "POST", cookie: host, headers: { Origin: "https://elsewhere.invalid" } })).res.status, 403);
  checks.push("Secure scoped cookies, anonymous access rejection and cross-origin mutation rejection");

  const pair = await request("/join", { method: "POST", body: { code: state.code, name: "CI crew" } });
  assert.equal(pair.res.status, 200);
  const upload = await request(base + "/clips", { method: "POST", cookie: pair.cookie, raw: wav() });
  assert.equal(upload.res.status, 201);
  const clipPath = base + "/clips/" + upload.data.id + "/audio";
  const clip = await request(clipPath, { cookie: host });
  assert.equal(clip.res.status, 200);
  assert.equal(clip.data.toString("ascii", 0, 4), "RIFF");
  assert.equal((await request(clipPath)).res.status, 401);
  for (const role of ["footsteps", "weather", "creature"]) {
    const current = (await request(base, { cookie: host })).data;
    assert.equal((await request(base + "/cast", { method: "POST", cookie: host, body: { role, clipId: upload.data.id, revision: current.revision } })).res.status, 200);
  }
  checks.push("Pairing, ffmpeg audio normalization, private audio retrieval and three-role casting");

  // One successful join above + 39 invalid codes exhausts the 40-request bucket.
  const wrongCode = state.code === "000000" ? "FFFFFF" : "000000";
  for (let i = 0; i < 39; i++) {
    assert.equal((await request("/join", { method: "POST", body: { code: wrongCode, name: "CI crew" }, headers: { "X-Forwarded-For": `198.51.100.${i + 1}` } })).res.status, 404);
  }
  assert.equal((await request("/join", { method: "POST", body: { code: wrongCode, name: "CI crew" }, headers: { "X-Forwarded-For": "203.0.113.22, 203.0.113.23", "X-Real-IP": "203.0.113.24" } })).res.status, 429);
  checks.push("Changing forged forwarding headers cannot bypass the join rate limit through Caddy");

  compose("up", "-d", "--no-deps", "--force-recreate", "--wait", "--wait-timeout", "90", "app");
  const secondApp = compose("ps", "-q", "app");
  assert.notEqual(secondApp, firstApp);
  assert.equal(inspect(secondApp).Mounts.find((mount) => mount.Destination === "/app/data")?.Name, dataVolume.Name);
  // An old proxy connection can close during replacement. Wait for Caddy's
  // upstream connection to recover before checking durable application state.
  for (let attempt = 0; attempt < 15; attempt++) {
    try {
      assert.equal((await request("/health")).res.status, 200);
      break;
    } catch (error) {
      if (attempt === 14) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  const restored = await request(base, { cookie: host });
  assert.equal(restored.res.status, 200);
  assert.equal(restored.data.clips[0].id, upload.data.id);
  assert.equal(Object.keys(restored.data.casts).length, 3);
  assert.equal(digest((await request(clipPath, { cookie: host })).data), digest(clip.data));
  checks.push("Container replacement preserves authorization, SQLite studio, casting and identical normalized audio");

  assert.equal((await request(base, { method: "DELETE", cookie: host })).res.status, 200);
  assert.equal((await request(clipPath, { cookie: host })).res.status, 404);
  checks.push("Ending the studio removes its audio");
  evidence.ok = true;
  console.log("Container acceptance passed: HTTPS, proxy boundary, audio and volume persistence.");
} finally {
  // Intentionally exclude response bodies, headers, cookies, database and CA files.
  await writeFile(".ci/container-evidence.json", JSON.stringify(evidence, null, 2) + "\n");
}
