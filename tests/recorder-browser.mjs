// Disposable Chromium regressions with a generated test microphone. These are
// browser lifecycle/error tests, not evidence of a physical phone microphone.
import assert from "node:assert/strict";
import { once } from "node:events";
import { chromium } from "playwright";
import { createApp } from "../server/index.mjs";

const runtime = await createApp({ database: ":memory:" });
const server = runtime.app.listen(0, "127.0.0.1");
await once(server, "listening");
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const errors = [];

async function phone() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["microphone"] });
  const created = await context.request.post(origin + "/api/sessions", { data: { title: "Recorder regression" } });
  assert.equal(created.status(), 201);
  const { id } = await created.json();
  const host = await (await context.request.get(origin + "/api/sessions/" + id)).json();
  const crew = await context.request.post(origin + "/api/join", { data: { code: host.code, name: "Test microphone" } });
  assert.equal(crew.status(), 200);
  // Use only the crew cookie on this phone, preserving the host cookie for tests.
  const cookie = (await context.cookies(origin + "/api/sessions/" + id)).filter((item) => item.name === "foley_crew");
  await context.clearCookies();
  await context.addCookies(cookie);
  await context.addInitScript(() => {
    const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    window.__micTest = { mode: "normal", streams: [], resolve: null };
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (window.__micTest.mode === "denied") throw new DOMException("Test denial", "NotAllowedError");
      if (window.__micTest.mode === "pending") await new Promise((resolve) => { window.__micTest.resolve = resolve; });
      const stream = await real(constraints);
      window.__micTest.streams.push(stream);
      return stream;
    };
    const RealRecorder = MediaRecorder;
    window.MediaRecorder = class extends RealRecorder {
      constructor(...args) { super(...args); window.__micTest.recorder = this; }
    };
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin + "/mic/" + id);
  await page.getByRole("button", { name: "Record a take", exact: true }).waitFor();
  return { context, page, id };
}

try {
  {
    const { context, page } = await phone();
    await page.evaluate(() => { window.__micTest.mode = "denied"; });
    await page.route("**/recording", (route) => JSON.parse(route.request().postData()).active === false
      ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Cleanup unavailable" }) }) : route.continue());
    await page.getByRole("button", { name: "Record a take", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Microphone permission was denied" }).waitFor({ timeout: 5000 });
    await page.unroute("**/recording");
    await page.evaluate(() => { window.__micTest.mode = "normal"; });
    await page.getByRole("button", { name: "Record a take", exact: true }).click();
    await page.getByRole("button", { name: "Stop recording", exact: true }).waitFor();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "Stop recording", exact: true }).click();
    await page.getByLabel("Name your sound").waitFor();
    await context.close();
    console.log("PASS permission denial survives a failed cleanup request and allows retry");
  }
  {
    const { context, page } = await phone();
    await page.getByRole("button", { name: "Record a take", exact: true }).click();
    await page.getByRole("button", { name: "Stop recording", exact: true }).waitFor();
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      // Real recorder error notification followed by its normal stop/data events.
      window.__micTest.recorder.dispatchEvent(new Event("error"));
      if (window.__micTest.recorder.state !== "inactive") window.__micTest.recorder.stop();
    });
    await page.getByRole("alert").filter({ hasText: "Recording was interrupted" }).waitFor({ timeout: 5000 });
    await page.waitForTimeout(200);
    assert.equal(await page.getByLabel("Name your sound").count(), 0, "Failed recorder must not offer a partial take");
    assert(await page.evaluate(() => window.__micTest.streams.every((stream) => stream.getTracks().every((track) => track.readyState === "ended"))));
    await page.getByRole("button", { name: "Record a take", exact: true }).click();
    await page.getByRole("button", { name: "Stop recording", exact: true }).waitFor();
    await page.waitForTimeout(450);
    await page.getByRole("button", { name: "Stop recording", exact: true }).click();
    await page.getByLabel("Name your sound").fill("Retry take");
    // Upload failure retains the locally recorded audio and name for retry.
    await page.route("**/clips", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Test upload interruption" }) }));
    await page.getByRole("button", { name: "Send to the picture" }).click();
    await page.getByRole("alert").filter({ hasText: "Test upload interruption" }).waitFor();
    assert.equal(await page.getByLabel("Name your sound").inputValue(), "Retry take");
    await page.unroute("**/clips");
    await page.getByRole("button", { name: "Send to the picture" }).click();
    await page.getByText("Retry take", { exact: true }).waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await context.close();
    console.log("PASS recorder errors discard partial audio; recording and failed uploads can be retried");
  }
  {
    const { context, page, id } = await phone();
    await page.evaluate(() => { window.__micTest.mode = "pending"; });
    await page.getByRole("button", { name: "Record a take", exact: true }).click();
    await page.waitForFunction(() => !!window.__micTest.resolve);
    await page.evaluate(() => {
      // Simulate page suspension while the browser's permission request is open.
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
      window.__micTest.resolve();
    });
    await page.waitForFunction(() => window.__micTest.streams.length === 1 && window.__micTest.streams[0].getTracks().every((track) => track.readyState === "ended"));
    assert.equal(await page.getByRole("button", { name: "Stop recording", exact: true }).count(), 0);
    await page.waitForFunction(() => !document.querySelector(".record-button").disabled);
    const snapshot = await (await context.request.get(origin + "/api/sessions/" + id)).json();
    assert.equal(snapshot.recording, null);
    await context.close();
    console.log("PASS late microphone permission after suspension immediately stops tracks and clears the recording lease");
  }
  assert.deepEqual(errors, []);
  console.log("Recorder browser regressions passed; no physical microphone claim.");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  runtime.close();
}
