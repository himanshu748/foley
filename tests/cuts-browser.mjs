import { chromium } from "playwright";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { createApp } from "../server/index.mjs";
const runtime = await createApp({ database: ":memory:" });
const server = runtime.app.listen(0, "127.0.0.1");
await once(server, "listening");
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  args: ["--disable-webgl"],
});
const folder = ".impeccable/review";
await mkdir(folder, { recursive: true });
const checks = [],
  errors = [];
const wav = (frequency) => {
  const buffer = Buffer.alloc(44 + 48000);
  buffer.write("RIFF");
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(48000, 24);
  buffer.writeUInt32LE(96000, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(48000, 40);
  for (let i = 0; i < 24000; i++)
    buffer.writeInt16LE(
      Math.round(Math.sin((i * Math.PI * 2 * frequency) / 48000) * 8000),
      44 + i * 2,
    );
  return buffer;
};
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const close = AudioContext.prototype.close;
    AudioContext.prototype.close = function () {
      return close.call(this).then(() => {
        throw new Error("Injected audio-close rejection");
      });
    };
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin + "/tv");
  await page
    .getByRole("button", { name: "Start a studio", exact: true })
    .click();
  await page.waitForURL("**/studio/**?tv=1");
  const sid = new URL(page.url()).pathname.split("/")[2];
  const base = `/api/sessions/${sid}`;
  await page.getByRole("button", { name: /Compare cuts/ }).click();
  await page.waitForFunction(() => document.activeElement?.id === "cuts-panel");
  checks.push("Empty-cut navigation focuses the visible comparison panel");
  const api = async (path = "", method = "GET", data) => {
    const response = await context.request.fetch(origin + base + path, {
      method,
      data,
    });
    const result = await response.json();
    assert.ok(response.ok(), JSON.stringify(result));
    return result;
  };
  const crew = await browser.newContext();
  const room = await api();
  const paired = await crew.request.post(origin + "/api/join", {
    data: { code: room.code, name: "Fixture crew" },
  });
  assert.ok(paired.ok());
  for (const [name, hz] of [
    ["First tone", 260],
    ["Second tone", 520],
  ]) {
    const uploader = hz === 520 ? crew : context;
    const response = await uploader.request.post(origin + base + "/clips", {
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Take-Name": name,
      },
      data: wav(hz),
    });
    assert.ok(response.ok(), await response.text());
  }
  let state = await api();
  for (const role of ["footsteps", "weather", "creature"]) {
    await api("/cast", "POST", {
      role,
      clipId: state.clips[0].id,
      revision: state.revision,
    });
    state = await api();
  }
  await page.reload();
  const card = (slot) => page.locator(`[data-cut-slot="${slot}"]`);
  const remoteSelect = async (slot, action) => {
    await card(slot).locator(`[data-cut-action="${action}"]`).focus();
    await page.keyboard.press("Enter");
  };
  const expectCutFocus = async (slot) => {
    await page.waitForFunction((slot) => {
      const focused = document.activeElement;
      const card = focused?.closest("[data-cut-slot]");
      const bounds = focused?.getBoundingClientRect();
      return (
        card?.getAttribute("data-cut-slot") === slot &&
        !focused?.matches(":disabled") &&
        (focused === card
          ? bounds.y < innerHeight && bounds.bottom > 0
          : bounds.y >= 0 && bounds.bottom <= innerHeight)
      );
    }, slot);
  };
  await remoteSelect("A", "save");
  await card("A").getByText("Ready to replay", { exact: true }).waitFor();
  await expectCutFocus("A");
  const savedA = (await api("/cuts")).cuts[0];
  await api("/cast", "POST", {
    role: "creature",
    clipId: state.clips[1].id,
    volume: 0.4,
    revision: state.revision,
  });
  state = await api();
  let active = structuredClone(state);
  await page.reload();
  await remoteSelect("B", "save");
  await card("B").getByText("Different: Creature", { exact: true }).waitFor();
  await expectCutFocus("B");
  assert.deepEqual(
    (await api("/cuts")).cuts.find((c) => c.slot === "A").casts,
    savedA.casts,
  );
  checks.push(
    "A/B save copies current server cast; actual take and volume changes are identified",
  );
  await card("A").locator('[data-cut-action="save"]').click();
  const beforeConfirmationMedia = (await api()).premieres;
  await page.evaluate(() => window.FoleyTV.media());
  assert.equal((await api()).premieres, beforeConfirmationMedia);
  assert.ok(await card("A").locator('[data-cut-action="cancel"]').isVisible());
  await page.keyboard.press("Escape");
  checks.push("Play/Pause does not start a cut through an open confirmation");
  // A stale server revision must fail instead of capturing an unexpected edit.
  await card("A").locator('[data-cut-action="save"]').click();
  await api("/cast", "POST", {
    role: "weather",
    clipId: active.clips[0].id,
    volume: 0.4,
    revision: active.revision,
  });
  await page.waitForTimeout(2800); // allow session polling to observe the unseen cast edit
  await card("A").locator('[data-cut-action="confirm"]').click();
  await page.getByRole("alert").waitFor();
  assert.equal(
    (await api("/cuts")).cuts.find((c) => c.slot === "A").id,
    savedA.id,
  );
  await page.keyboard.press("Escape");
  active = await api();
  await api("/cast", "POST", {
    role: "weather",
    clipId: active.clips[0].id,
    volume: 0.8,
    revision: active.revision,
  });
  active = await api();
  await page.reload();
  checks.push(
    "Stale revision rejects saving and preserves the prior immutable cut",
  );
  await card("A").locator('[data-cut-action="play"]').focus();
  await page
    .locator("#cuts-panel")
    .screenshot({ path: folder + "/cuts-tv-compare.png" });
  // Native Play/Pause uses the cut under focus, then Back stops it safely.
  await card("A").locator('[data-cut-action="play"]').focus();
  await page.evaluate(() => window.FoleyTV.media());
  await page.getByText("Premiere in progress", { exact: true }).waitFor();
  assert.equal(
    await page.locator(".screen").getAttribute("data-playback-cut"),
    "A",
  );
  assert.deepEqual((await api()).casts, active.casts);
  assert.equal((await api()).revision, active.revision);
  const filmBox = await page.locator(".picture").boundingBox();
  assert.ok(
    filmBox.y >= 0 && filmBox.y + filmBox.height <= 720,
    "saved-cut film stays visible",
  );
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    async (base) =>
      (await fetch(base).then((r) => r.json())).playingUntil === 0,
    base,
  );
  checks.push(
    "Focused A Play/Pause plays saved A and Back releases its lease without editing current B",
  );
  await card("B").locator('[data-cut-action="play"]').click();
  await page.getByText("Premiere in progress", { exact: true }).waitFor();
  await page
    .getByText("Cut B · Soundtrack B · Sound by the people in this room.", {
      exact: true,
    })
    .waitFor({ timeout: 25000 });
  assert.deepEqual((await api()).casts, active.casts);
  await page
    .locator(".film-credits span")
    .filter({ hasText: "Creature" })
    .getByText("Fixture crew", { exact: false })
    .waitFor();
  await page.screenshot({ path: folder + "/cuts-tv-credits.png" });
  checks.push(
    "B completes on the shared audio clock and credits label the replayed saved cut",
  );
  await card("A").locator('[data-cut-action="save"]').click();
  assert.equal(
    await card("A")
      .locator('[data-cut-action="cancel"]')
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.keyboard.press("Escape");
  assert.equal(
    (await api("/cuts")).cuts.find((c) => c.slot === "A").id,
    savedA.id,
  );
  await card("A").locator('[data-cut-action="save"]').click();
  await remoteSelect("A", "confirm");
  await card("A")
    .getByText("Same takes and volumes — these cuts sound alike.", {
      exact: true,
    })
    .waitFor();
  await expectCutFocus("A");
  const overwrittenA = (await api("/cuts")).cuts.find((c) => c.slot === "A");
  assert.notEqual(overwrittenA.id, savedA.id);
  checks.push(
    "Replace requires explicit confirmation; Back preserves A; replacement gets a new immutable ID",
  );
  // Hold the media fetch, replace the slot from another host tab, then release.
  let releaseAudio;
  const audioGate = new Promise((resolve) => {
    releaseAudio = resolve;
  });
  let sawAudio;
  const audioSeen = new Promise((resolve) => {
    sawAudio = resolve;
  });
  await page.route("**/clips/*/audio", async (route) => {
    sawAudio();
    await audioGate;
    await route.continue();
  });
  const premieresBeforeRace = (await api()).premieres;
  await card("A").locator('[data-cut-action="play"]').click();
  await audioSeen;
  await api("/cuts/A", "PUT", {
    label: "Concurrent replacement",
    expectedRevision: active.revision,
    expectedCutId: overwrittenA.id,
  });
  releaseAudio();
  await page.getByRole("alert").waitFor();
  assert.equal((await api()).premieres, premieresBeforeRace);
  assert.equal((await api()).playingUntil, 0);
  await page.unroute("**/clips/*/audio");
  checks.push(
    "Slot overwrite during decoding rejects stale A without sound, receipt, or playback lease",
  );
  await page.reload();
  // Hold the claim response after the server acquired its lease, cancel locally,
  // start a newer claim, and verify late cleanup cannot release that newer ID.
  let releaseClaim;
  const claimGate = new Promise((resolve) => {
    releaseClaim = resolve;
  });
  let sawClaim;
  const claimSeen = new Promise((resolve) => {
    sawClaim = resolve;
  });
  let oldClaim;
  await page.route("**/cuts/A/play", async (route) => {
    const response = await route.fetch();
    oldClaim = await response.json();
    sawClaim();
    await claimGate;
    await route.fulfill({ response });
  });
  await card("A").locator('[data-cut-action="play"]').click();
  await claimSeen;
  await page.keyboard.press("Escape");
  await api("/stop", "POST", { playbackId: oldClaim.playbackId });
  const nextClaim = await api("/play", "POST", { revision: active.revision });
  const cleanupResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/stop") &&
      response.request().postDataJSON()?.playbackId === oldClaim.playbackId,
  );
  releaseClaim();
  await cleanupResponse;
  assert.ok((await api()).playingUntil > Date.now());
  await api("/stop", "POST", { playbackId: nextClaim.playbackId });
  await page.unroute("**/cuts/A/play");
  checks.push(
    "Cancel before acknowledged claim stays local; late response releases only its own playback ID",
  );
  await page.reload();
  // A post-claim snapshot failure must stop the locally scheduled soundtrack.
  let failSnapshot = false;
  await page.route("**/cuts/B/play", async (route) => {
    const response = await route.fetch();
    failSnapshot = true;
    await route.fulfill({ response });
  });
  await page.route("**/api/sessions/*", async (route) => {
    if (failSnapshot && route.request().method() === "GET")
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Snapshot refresh failed after claim." }),
      });
    else await route.continue();
  });
  const failedPlayCleanup = page.waitForResponse(
    (response) =>
      response.url().endsWith("/stop") &&
      response.request().postDataJSON()?.playbackId,
  );
  await card("B").locator('[data-cut-action="play"]').click();
  await failedPlayCleanup;
  await page
    .getByRole("alert")
    .getByText("Snapshot refresh failed after claim.", { exact: true })
    .waitFor();
  await page.waitForFunction(
    async (base) =>
      (await fetch(base + "/cuts").then((r) => r.json())).cuts.length === 2,
    base,
  );
  assert.equal((await api()).playingUntil, 0);
  assert.equal(
    await page.getByText("Premiere in progress", { exact: true }).count(),
    0,
  );
  await page.unroute("**/cuts/B/play");
  await page.unroute("**/api/sessions/*");
  checks.push(
    "Post-claim refresh failure preserves the original error and clears local audio/frame/lease",
  );
  await page.reload();
  await api("/clips/" + active.clips[1].id, "DELETE");
  await page.reload();
  await card("B")
    .getByText("A saved take was removed.", { exact: false })
    .waitFor();
  assert.ok(await card("B").locator('[data-cut-action="play"]').isDisabled());
  await card("B").locator('[data-cut-action="delete"]').click();
  await remoteSelect("B", "confirm");
  await card("B").getByText("Empty slot", { exact: true }).waitFor();
  await expectCutFocus("B");
  checks.push(
    "Select saves, replaces and deletes without focus leaving the visible cut card",
  );
  assert.equal(
    (await api("/cuts")).cuts.some((c) => c.slot === "B"),
    false,
  );
  checks.push(
    "Deleted media invalidates saved playback explicitly; deleting a cut requires confirmation",
  );
  await page.screenshot({
    path: folder + "/cuts-tv-invalid.png",
    fullPage: true,
  });
  const phoneContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await phoneContext.addCookies(await context.cookies());
  const phone = await phoneContext.newPage();
  phone.on("pageerror", (error) => errors.push(error.message));
  await phone.goto(origin + `/studio/${sid}`);
  await phone.getByRole("button", { name: "2D · light", exact: true }).click();
  await phone.locator("input[type=file]").setInputFiles({
    name: "Local audition.wav",
    mimeType: "audio/wav",
    buffer: wav(780),
  });
  await phone.getByLabel("Audition selected audio file").waitFor();
  assert.ok(
    await phone.getByLabel("Audition selected audio file").getAttribute("src"),
  );
  assert.equal(await phone.evaluate(() => innerWidth), 390);
  assert.ok(
    await phone.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  const shortTargets = await phone
    .locator("button:visible")
    .evaluateAll((nodes) =>
      nodes
        .filter((n) => {
          const bounds = n.getBoundingClientRect();
          return bounds.height < 44 || bounds.width < 44;
        })
        .map((n) => n.textContent),
    );
  assert.deepEqual(shortTargets, []);
  const stages = await phone
    .locator(".studio-route button")
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return { x: rect.x, y: rect.y };
      }),
    );
  assert.equal(stages[0].y, stages[1].y);
  assert.equal(stages[2].y, stages[3].y);
  assert.ok(stages[2].y > stages[0].y);
  assert.equal(stages[0].x, stages[2].x);
  await phone.screenshot({
    path: folder + "/cuts-phone-audition.png",
    fullPage: true,
  });
  await phone.goto(origin);
  const roundTarget = await phone.locator(".round-button").boundingBox();
  assert.ok(roundTarget.width >= 44 && roundTarget.height >= 44);
  checks.push(
    "390px layout has no overflow, 44px button targets and local selected-file audition before upload",
  );
  assert.deepEqual(errors, []);
  checks.push(
    "Rejected AudioContext.close during stop, cancel and cleanup produces no page errors",
  );
  await writeFile(
    folder + "/cuts-results.json",
    JSON.stringify(
      {
        ok: true,
        date: new Date().toISOString(),
        checks,
        fixture:
          "Generated PCM tones; desktop Chromium, no physical microphone or TV hardware claim",
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
  console.log("Saved cut browser checks passed:", checks.length);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  runtime.close();
}
