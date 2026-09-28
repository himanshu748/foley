import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
const url = process.env.TEST_URL || "http://localhost:4341";
const folder = ".impeccable/review";
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
const errors = [];
const warnings = [];
const checks = [];
const hash = (b) => createHash("sha256").update(b).digest("hex");
const quantile = (xs, q) =>
  [...xs].sort((a, b) => a - b)[
    Math.min(xs.length - 1, Math.floor(xs.length * q))
  ] || 0;
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "warning") warnings.push(m.text());
  });
  await page.goto(url);
  await page.locator('[data-renderer="three"]').waitFor({ timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  const film = page.locator(".film-three-canvas");
  await page.screenshot({ path: folder + "/3d-desktop.png", fullPage: true });
  const initial = await film.evaluate((c) => ({ ...c.foleyStats }));
  await page.waitForTimeout(500);
  assert.equal(
    await film.evaluate((c) => c.foleyStats.frames),
    initial.frames,
    "poster does not run a hidden clock",
  );
  checks.push("no autoplay or idle redraw");
  await film.evaluate((c) => c.foleySeek(9));
  const pose9 = hash(await film.screenshot());
  await film.evaluate((c) => c.foleySeek(17.8));
  await film.screenshot({ path: folder + "/3d-umbrella.png" });
  await film.evaluate((c) => c.foleySeek(9));
  assert.equal(hash(await film.screenshot()), pose9);
  checks.push("seek 9 → 17.8 → 9 gives identical pixels");
  await page
    .getByRole("button", { name: "Watch silent film", exact: true })
    .click();
  await page.waitForTimeout(600);
  await film.evaluate((c) => {
    c.foleyStats.cpuMs = [];
    c.foleyStats.intervalsMs = [];
  });
  await page.waitForTimeout(3200);
  await page
    .getByRole("button", { name: "Pause silent film", exact: true })
    .click();
  const paused = await film.evaluate((c) => ({ ...c.foleyStats }));
  const pausedPixels = hash(await film.screenshot());
  await page.waitForTimeout(500);
  assert.equal(await film.evaluate((c) => c.foleyStats.time), paused.time);
  assert.equal(hash(await film.screenshot()), pausedPixels);
  checks.push("pause preserves exact frame");
  await page
    .getByRole("button", { name: "Watch silent film", exact: true })
    .click();
  await page.waitForTimeout(200);
  await page
    .getByRole("button", { name: "Pause silent film", exact: true })
    .click();
  assert.ok(await film.evaluate((c, t) => c.foleyStats.time >= t, paused.time));
  checks.push("resume continues previous time");
  await film.evaluate((c) => {
    window.savedFoley = c;
  });
  // Make room below the picture: a 1000px viewport still sees its lower edge
  // when this short landing page is scrolled all the way to the footer.
  await page.setViewportSize({ width: 1440, height: 400 });
  await page.locator("footer").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  assert.equal(
    await page.evaluate(() => window.savedFoley.foleyStats.disposed),
    true,
  );
  assert.equal(
    await page.evaluate(() => window.savedFoley.foleyStats.geometries),
    0,
  );
  // Three r185 retains an internal tone-mapping texture counter after dispose.
  // Losing the context releases that allocation too; counters need not be zero.
  assert.ok(
    await page.evaluate(() =>
      window.savedFoley.getContext("webgl2").isContextLost(),
    ),
  );
  assert.ok(
    await page.evaluate(
      (count) => window.savedFoley.foleyStats.textures <= count,
      initial.textures,
    ),
  );
  assert.equal(await film.count(), 0);
  checks.push("offscreen disposes renderer and removes canvas");
  await page.locator(".home-screen").scrollIntoViewIfNeeded();
  await page.locator('[data-renderer="three"]').waitFor();
  const resources = await film.evaluate((c) => ({ ...c.foleyStats }));
  assert.equal(resources.geometries, initial.geometries);
  assert.equal(resources.textures, initial.textures);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".home-screen").scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  await film.evaluate((c) => c.foleySeek(17.8));
  await page.screenshot({ path: folder + "/3d-mobile.png", fullPage: true });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  checks.push("390px composition without horizontal overflow");
  await film.evaluate((c) => {
    window.savedFoley = c;
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(100);
  assert.equal(
    await page.evaluate(() => window.savedFoley.foleyStats.disposed),
    true,
  );
  checks.push("simulated document-hidden event disposes renderer");
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.locator('[data-renderer="three"]').waitFor();
  await film.evaluate((c) =>
    c.getContext("webgl2").getExtension("WEBGL_lose_context").loseContext(),
  );
  await page.locator('[data-renderer="2d-fallback"]').waitFor();
  await page.screenshot({
    path: folder + "/3d-context-loss-fallback.png",
    fullPage: true,
  });
  checks.push("real WebGL context loss switches to honest 2D picture");
  const reduced = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  reduced.on("pageerror", (e) => errors.push(e.message));
  await reduced.goto(url);
  await reduced.locator(".home-screen").scrollIntoViewIfNeeded();
  await reduced.locator('[data-renderer="three"]').waitFor();
  assert.equal(
    await reduced
      .locator(".film-three-canvas")
      .evaluate((c) => c.foleyStats.reduced),
    true,
  );
  await reduced
    .getByRole("button", { name: "Watch silent film", exact: true })
    .click();
  await reduced.waitForTimeout(250);
  assert.ok(
    (await reduced
      .locator(".film-three-canvas")
      .evaluate((c) => c.foleyStats.time)) > 0,
  );
  await reduced
    .getByRole("button", { name: "Pause silent film", exact: true })
    .click();
  await reduced.screenshot({
    path: folder + "/3d-reduced-motion.png",
    fullPage: true,
  });
  checks.push("reduced motion still allows explicit content playback");
  const blocked = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await blocked.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (
        type === "webgl" ||
        type === "webgl2" ||
        type === "experimental-webgl"
      )
        return null;
      return original.call(this, type, ...args);
    };
  });
  blocked.on("pageerror", (e) => errors.push(e.message));
  await blocked.goto(url);
  await blocked.locator('[data-renderer="2d-fallback"]').waitFor();
  await blocked
    .getByRole("button", { name: "Watch silent film", exact: true })
    .click();
  await blocked.waitForTimeout(200);
  await blocked
    .getByRole("button", { name: "Pause silent film", exact: true })
    .click();
  await blocked.screenshot({
    path: folder + "/3d-webgl-disabled.png",
    fullPage: true,
  });
  checks.push("unavailable WebGL2 keeps 2D playback usable");
  assert.deepEqual(errors, []);
  const results = {
    ok: true,
    checks,
    pageErrors: errors,
    warnings: [...new Set(warnings)],
    machine: {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus()[0]?.model,
      browser: browser.version(),
      rendering:
        "Headless Chromium; unsafe SwiftShader enabled if needed, no physical Fire TV measurement",
      viewport: "1440x1000",
      quality: "one 1024 shadow, DPR capped at 1.75 (1.5 on mobile creation)",
    },
    sample: {
      count: paused.cpuMs.length,
      cpuSubmissionMedianMs: quantile(paused.cpuMs, 0.5),
      cpuSubmissionP95Ms: quantile(paused.cpuMs, 0.95),
      frameIntervalMedianMs: quantile(paused.intervalsMs, 0.5),
      frameIntervalP95Ms: quantile(paused.intervalsMs, 0.95),
      drawCalls: paused.drawCalls,
      triangles: paused.triangles,
      geometries: paused.geometries,
      textures: paused.textures,
      dpr: paused.dpr,
      renderer: paused.renderer,
    },
    note: "CPU submission time is not measured GPU frame time; local machine was running concurrent agent/UI work.",
  };
  await writeFile(
    folder + "/3d-results.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
