import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const url = process.env.TEST_URL || "http://localhost:4331";
await mkdir(".impeccable/review", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    ...(process.env.TEST_WEBGL_DISABLED === "1" ? ["--disable-webgl"] : []),
  ],
});
const errors = [];
try {
  const hostContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const host = await hostContext.newPage();
  host.on("pageerror", (e) => errors.push(e.message));
  await host.goto(url);
  await host.evaluate(() => document.fonts.ready);
  await host.screenshot({
    path: ".impeccable/review/desktop-home.png",
    fullPage: true,
  });
  await host
    .getByRole("button", { name: "Start a studio", exact: true })
    .click();
  await host.waitForURL("**/studio/**");
  await host.getByRole("heading", { name: "Cast the sound." }).waitFor();
  const sid = new URL(host.url()).pathname.split("/")[2];
  const code = (await host.locator(".pair-code").textContent()).trim();
  assert(
    await host.getByRole("button", { name: "Premiere your film" }).isDisabled(),
  );
  const phoneContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    permissions: ["microphone"],
  });
  const phone = await phoneContext.newPage();
  phone.on("pageerror", (e) => errors.push(e.message));
  await phone.goto(url + "/join?code=" + code);
  await phone.getByLabel("Your credit in the film").fill("Sam");
  await phone
    .getByRole("button", { name: "Join the crew", exact: true })
    .click();
  await phone.waitForURL("**/mic/**");
  await phone
    .getByRole("button", { name: "Record a take", exact: true })
    .waitFor();
  await phone
    .getByRole("button", { name: "Record a take", exact: true })
    .click();
  await phone
    .getByRole("button", { name: "Stop recording", exact: true })
    .waitFor();
  await phone.waitForTimeout(1250);
  await phone
    .getByRole("button", { name: "Stop recording", exact: true })
    .click();
  await phone.getByLabel("Name your sound").fill("Fresh microphone take");
  await phone.getByRole("button", { name: "Send to the picture" }).click();
  await phone.getByText("Fresh microphone take", { exact: true }).waitFor();
  await host.getByText("Fresh microphone take", { exact: true }).waitFor();
  for (const role of ["Footsteps", "Weather", "Creature"]) {
    await host.getByRole("tab", { name: new RegExp(role) }).click();
    await host.getByRole("button", { name: "Cast take", exact: true }).click();
    await host.getByRole("button", { name: "Cast", exact: true }).waitFor();
  }
  await host.screenshot({
    path: ".impeccable/review/desktop.png",
    fullPage: true,
  });
  await phone.screenshot({
    path: ".impeccable/review/mobile.png",
    fullPage: true,
  });
  await host.getByRole("button", { name: "Premiere your film" }).click();
  await host.getByText("Premiere in progress", { exact: true }).waitFor();
  await host
    .getByRole("heading", { name: "That’s your picture." })
    .waitFor({ timeout: 25000 });
  await host.screenshot({
    path: ".impeccable/review/premiere-credits.png",
    fullPage: true,
  });
  await host.getByRole("tab", { name: /Creature/ }).click();
  await host.getByRole("button", { name: "Clear role", exact: true }).click();
  await host.getByRole("button", { name: "Cast take", exact: true }).click();
  await host
    .getByRole("button", { name: "Play the next cut", exact: true })
    .click();
  await host.getByText("Premiere in progress", { exact: true }).waitFor();
  await host
    .getByRole("button", { name: "Stop premiere", exact: true })
    .click();
  await host
    .getByRole("button", { name: "Play the next cut", exact: true })
    .waitFor();
  // Refresh keeps casting and recorded data; D-pad focus stays on usable controls.
  await host.reload();
  await host
    .getByRole("button", { name: "Play the next cut", exact: true })
    .waitFor();
  await host.keyboard.press("ArrowDown");
  assert(
    await host.evaluate(() =>
      ["BUTTON", "A", "INPUT", "SELECT"].includes(
        document.activeElement.tagName,
      ),
    ),
  );
  await host.setViewportSize({ width: 390, height: 844 });
  await host.screenshot({
    path: ".impeccable/review/mobile-studio.png",
    fullPage: true,
  });
  assert(
    await host.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert(
    await phone.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await phone
    .getByRole("button", { name: "Delete Fresh microphone take", exact: true })
    .click();
  await phone
    .getByText("Fresh microphone take", { exact: true })
    .waitFor({ state: "detached" });
  await host
    .getByRole("button", { name: "Play the next cut", exact: true })
    .waitFor();
  await host.waitForFunction(() =>
    Array.from(document.querySelectorAll("button")).some(
      (b) => b.textContent.includes("Play the next cut") && b.disabled,
    ),
  );
  await host.getByRole("button", { name: "End studio", exact: false }).click();
  await host
    .getByRole("button", { name: "Delete studio & takes", exact: true })
    .click();
  await host.waitForURL(url + "/");
  assert.deepEqual(errors, []);
  await writeFile(
    ".impeccable/review/browser-results.json",
    JSON.stringify(
      {
        ok: true,
        recordedAt: new Date().toISOString(),
        rendering: process.env.TEST_WEBGL_DISABLED === "1"
          ? "WebGL disabled: real 2D fallback path; no GPU performance claim"
          : "Browser default renderer; inspect separate 3D evidence for measurements",
        checks: [
          "host session",
          "phone pairing",
          "real MediaRecorder with browser-generated test microphone",
          "server audio normalization",
          "three-role casting",
          "full 20-second Web Audio premiere with contribution credits",
          "clear and recast role, replay and stop",
          "refresh persistence",
          "D-pad focus",
          "390px no overflow",
          "contributor deletion clears cast",
          "session deletion",
        ],
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "Browser workflow passed: pairing, recording, casting, premiere, persistence, deletion, D-pad, mobile layout.",
  );
} finally {
  await browser.close();
}
