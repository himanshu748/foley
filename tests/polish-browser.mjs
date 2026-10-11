// Isolated regressions for TV focus ownership and responsive control sizes.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/index.mjs";
const runtime = await createApp({ database: ":memory:" });
const server = runtime.app.listen(0, "127.0.0.1");
await once(server, "listening");
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, args: ["--disable-webgl"] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const errors = [], checks = [];
page.on("pageerror", e => errors.push(e.message));
try {
  await page.goto(origin + "/tv");
  await page.getByRole("button", { name: "Start a studio", exact: true }).click();
  await page.waitForURL("**/studio/**?tv=1");
  const studio = page.url().split("?")[0];
  const base = "/api/sessions/" + new URL(studio).pathname.split("/")[2];
  const api = async (path = "", method = "GET", data) => {
    const res = await context.request.fetch(origin + base + path, { method, data });
    assert.ok(res.ok(), await res.text());
    return res.json();
  };
  const heights = async (selector, minimum) => {
    const dimensions = await page.locator(selector).evaluateAll(els => els.map(el => el.getBoundingClientRect().height));
    assert.ok(dimensions.length, selector + " is present");
    assert.ok(dimensions.every(h => h >= minimum), `${selector}: ${dimensions}, expected >= ${minimum}`);
  };
  await heights(".transport .button", 52);
  checks.push("TV transport controls retain their 52px minimum");
  const wav = Buffer.alloc(44 + 48000);
  wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(48000, 24); wav.writeUInt32LE(96000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write("data", 36); wav.writeUInt32LE(48000, 40);
  for (let i = 0; i < 24000; i++) wav.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 230 / 48000) * 5000), 44 + i * 2);
  await page.locator('.upload-take input[type="file"]').setInputFiles({ name: "Synthetic focus fixture.wav", mimeType: "audio/wav", buffer: wav });
  await heights(".upload-take .button", 52);
  checks.push("TV selected-upload controls retain their 52px minimum");
  const upload = await context.request.post(origin + base + "/clips", {
    headers: { "Content-Type": "application/octet-stream", "X-Take-Name": "Synthetic focus fixture" }, data: wav,
  });
  assert.ok(upload.ok(), await upload.text());
  let state = await api();
  for (const role of ["footsteps", "weather", "creature"]) {
    await api("/cast", "POST", { role, clipId: state.clips[0].id, revision: state.revision });
    state = await api();
  }
  await page.reload();
  const card = page.locator('[data-cut-slot="A"]');
  const delayedAction = async (action, confirm = false) => {
    let release, arrived;
    const gate = new Promise(r => release = r), seen = new Promise(r => arrived = r);
    await page.route("**/cuts/A", async route => {
      if (route.request().method() !== (action === "delete" ? "DELETE" : "PUT")) return route.continue();
      arrived(); await gate; await route.continue();
    });
    await card.locator(`[data-cut-action="${action}"]`).click();
    if (confirm) await card.locator('[data-cut-action="confirm"]').click();
    await seen;
    await page.getByRole("button", { name: /Pair crew/ }).focus();
    release();
    await page.waitForFunction(deleting => {
      const save = document.querySelector('[data-cut-slot="A"] [data-cut-action="save"]');
      const saved = !!document.querySelector('[data-cut-slot="A"]').dataset.cutId;
      return save && !save.disabled && saved === !deleting;
    }, action === "delete", { timeout: 12000 });
    // Allow React's passive focus effect to flush after the enabling commit.
    await page.waitForTimeout(100);
    assert.equal(await page.getByRole("button", { name: /Pair crew/ }).evaluate(el => el === document.activeElement), true, "completion preserves focus on the exact Pair crew button");
    await page.unroute("**/cuts/A");
  };
  await delayedAction("save");
  await delayedAction("save", true);
  await delayedAction("delete", true);
  checks.push("Delayed Save, Replace and Delete preserve deliberate navigation after passive effects settle");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(studio);
  await page.waitForFunction(() => document.documentElement.dataset.display === "browser");
  await heights(".transport .button", 57);
  checks.push("Large browser transport retains its 57px minimum");
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.locator('.upload-take input[type="file"]').setInputFiles({ name: "Synthetic tablet fixture.wav", mimeType: "audio/wav", buffer: wav });
  await heights(".small-button", 44);
  await heights(".fullscreen-button", 44);
  await heights(".upload-take .button", 44);
  await page.route("**/cast", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Synthetic tablet sizing error" }) }));
  await page.getByRole("button", { name: "Clear role", exact: true }).click();
  await page.getByRole("button", { name: "Dismiss error", exact: true }).waitFor();
  await heights(".alert button", 44);
  await page.getByRole("button", { name: "Dismiss error", exact: true }).click();
  await page.unroute("**/cast");
  checks.push("1024px browser small, alert, fullscreen and selected-upload buttons retain global 44px floors");
  await page.setViewportSize({ width: 390, height: 844 });
  await heights(".transport .button", 44);
  await heights(".small-button", 44);
  await heights(".fullscreen-button", 44);
  await page.route("**/cast", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Synthetic phone sizing error" }) }));
  await page.getByRole("button", { name: "Clear role", exact: true }).click();
  await page.getByRole("button", { name: "Dismiss error", exact: true }).waitFor();
  await heights(".alert button", 44);
  await page.getByRole("button", { name: "Dismiss error", exact: true }).click();
  await page.unroute("**/cast");
  await page.locator('.upload-take input[type="file"]').setInputFiles({ name: "Synthetic phone fixture.wav", mimeType: "audio/wav", buffer: wav });
  await heights(".upload-take .button", 44);
  await page.getByRole("button", { name: /End studio/ }).click();
  await heights(".end-confirm .button", 44);
  checks.push("Phone transport, small, fullscreen, alert, upload and studio-deletion confirmation meet 44px minimum");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, checks, fixture: "Synthetic PCM only; desktop Chromium, no native/device evidence" }));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
  runtime.close();
}
