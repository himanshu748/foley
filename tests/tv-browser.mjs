import { chromium } from "playwright";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { createApp } from "../server/index.mjs";
const runtime = await createApp({ database: ":memory:" });
const server = runtime.app.listen(0, "127.0.0.1");
await once(server, "listening");
const url = `http://127.0.0.1:${server.address().port}`;
const folder = ".impeccable/review";
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--disable-webgl"],
});
const checks = [],
  errors = [],
  requests = [];
let page;
let tvPassed = false;
try {
  page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => requests.push(r.url()));
  await page.goto(url + "/tv");
  await page.waitForFunction(() =>
    document.activeElement?.textContent.includes("Start a studio"),
  );
  await page.locator('[data-renderer="2d-selected"]').waitFor();
  assert.equal(
    requests.some((u) => u.includes("film-three-")),
    false,
  );
  checks.push(
    "TV cold start focuses Start a studio and does not request Three.js",
  );
  await page.screenshot({ path: folder + "/tv-home.png", fullPage: true });
  await page.keyboard.press("Enter");
  await page.waitForURL("**/studio/**?tv=1");
  await page.getByRole("navigation", { name: "Direct your picture" }).waitFor();
  const studio = page.url();
  const sid = new URL(studio).pathname.split("/")[2];
  await page.waitForFunction(() =>
    document.activeElement?.textContent.includes("Pair crew"),
  );
  await page.keyboard.press("ArrowRight");
  assert.ok(
    await page.evaluate(() =>
      document.activeElement.textContent.includes("Cast sounds"),
    ),
  );
  await page.keyboard.press("ArrowLeft");
  assert.ok(
    await page.evaluate(() =>
      document.activeElement.textContent.includes("Pair crew"),
    ),
  );
  checks.push("D-pad moves between director stages; Select opens the studio");
  await page.screenshot({ path: folder + "/tv-studio.png", fullPage: true });
  assert.ok(
    (await page.locator(".pair-code").boundingBox()).y < 720,
    "pairing code remains on first TV screen",
  );
  await page.keyboard.press("Escape");
  await page.waitForURL(url + "/tv");
  await page.getByRole("link", { name: "Resume your studio" }).waitFor();
  await page
    .getByRole("button", { name: "Start a studio", exact: true })
    .focus();
  await page.keyboard.press("ArrowDown");
  assert.ok(
    await page.evaluate(() =>
      document.activeElement.textContent.includes("Resume your studio"),
    ),
  );
  await page.keyboard.press("Enter");
  await page.waitForURL(studio);
  checks.push(
    "Back preserves studio and D-pad resume reauthorizes the same private studio",
  );
  await page.getByRole("button", { name: "3D · cinema", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.locator(".film-frame").evaluate((node) => node.scrollIntoView({ block: "center", behavior: "instant" }));
  await page.locator('[data-renderer="2d-fallback"]').waitFor();
  await page.getByRole("button", { name: "2D · light", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.locator('[data-renderer="2d-selected"]').waitFor();
  await page.reload();
  await page.locator('[data-renderer="2d-selected"]').waitFor();
  checks.push(
    "WebGL-unavailable selection falls back honestly; explicit 2D preference persists",
  );
  const samples = 24000;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write("RIFF");
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(48000, 24);
  wav.writeUInt32LE(96000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++)
    wav.writeInt16LE(
      Math.round(Math.sin((i * 2 * Math.PI * 260) / 48000) * 5000),
      44 + i * 2,
    );
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "TV keyboard test.wav",
      mimeType: "audio/wav",
      buffer: wav,
    });
  await page.getByRole("button", { name: "Send take", exact: true }).click();
  await page.getByText("TV keyboard test", { exact: true }).waitFor();
  for (const role of ["Footsteps", "Weather", "Creature"]) {
    await page.getByRole("tab", { name: new RegExp(role) }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Cast take", exact: true }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Cast", exact: true }).waitFor();
  }
  checks.push(
    "Real normalized WAV fixture is cast into all three roles using Select",
  );
  await page
    .getByRole("navigation", { name: "Direct your picture" })
    .getByRole("button", { name: /Premiere/ })
    .click();
  assert.ok(
    await page.evaluate(() =>
      document.activeElement.textContent.includes("Premiere your film"),
    ),
  );
  await page.keyboard.press("Enter");
  await page.getByText("Premiere in progress", { exact: true }).waitFor();
  await page.getByRole("button", { name: "3D · cinema", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.locator(".film-frame").evaluate((node) => node.scrollIntoView({ block: "center", behavior: "instant" }));
  await page.locator('[data-renderer="2d-fallback"]').waitFor();
  const receipt = await page.evaluate(
    async (id) => fetch("/api/sessions/" + id).then((r) => r.json()),
    sid,
  );
  assert.ok(receipt.playingUntil > Date.now());
  assert.equal(receipt.premieres, 1);
  await page.getByRole("button", { name: "2D · light", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Play the next cut", exact: true })
    .waitFor();
  await page.waitForFunction(
    async (id) =>
      (await fetch("/api/sessions/" + id).then((r) => r.json()))
        .playingUntil === 0,
    sid,
  );
  checks.push(
    "Picture switching preserves the premiere; Back stops audio and releases the playback lease",
  );
  await page
    .getByRole("button", { name: "Play the next cut", exact: true })
    .click();
  await page.getByText("Premiere in progress", { exact: true }).waitFor();
  await page.evaluate(() => window.FoleyTV.suspend());
  await page
    .getByRole("button", { name: "Play the next cut", exact: true })
    .waitFor();
  await page.waitForFunction(
    async (id) =>
      (await fetch("/api/sessions/" + id).then((r) => r.json()))
        .playingUntil === 0,
    sid,
  );
  checks.push("Native suspend bridge stops playback and releases the lease");
  await page.getByRole("button", { name: "End studio", exact: false }).click();
  await page
    .getByText("End this studio and permanently delete every recording?")
    .waitFor();
  await page.keyboard.press("Escape");
  assert.equal(
    await page
      .getByText("End this studio and permanently delete every recording?")
      .count(),
    0,
  );
  assert.equal(page.url(), studio);
  checks.push("Back cancels the destructive confirmation before leaving");
  await page.screenshot({ path: folder + "/tv-ready.png", fullPage: true });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.getByRole("button", { name: "End studio", exact: false }).click();
  await page
    .getByRole("button", { name: "Delete studio & takes", exact: true })
    .click();
  await page.waitForURL(url + "/tv");
  assert.equal(
    await page.getByRole("link", { name: "Resume your studio" }).count(),
    0,
  );
  checks.push("Ending a studio clears saved resume");
  const phone = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  phone.on("pageerror", (e) => errors.push(e.message));
  await phone.goto(url);
  await phone.getByRole("button", { name: "2D · light", exact: true }).click();
  await phone.screenshot({
    path: folder + "/tv-upgrade-mobile.png",
    fullPage: true,
  });
  assert.ok(
    await phone.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  checks.push("390px browser layout retains touch controls without overflow");
  assert.deepEqual(errors, []);
  tvPassed = true;
  await writeFile(
    folder + "/tv-results.json",
    JSON.stringify(
      {
        ok: true,
        date: "2026-09-12",
        viewport: "1280x720 browser keyboard with WebGL disabled; not Fire OS device evidence",
        checks,
        pageErrors: errors,
        fixture:
          "One generated PCM sine-wave upload; phone MediaRecorder tested separately.",
      },
      null,
      2,
    ),
  );
  console.log("TV checks passed:", checks.length);
} finally {
  await browser.close();
  // Preserve the existing actual MediaRecorder/phone/premiere regression under the same isolated backend.
  try {
    if (tvPassed) {
      process.env.TEST_URL = url;
      process.env.TEST_WEBGL_DISABLED = "1";
      await import("./browser.mjs");
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    runtime.close();
  }
}
