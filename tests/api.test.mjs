import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server/index.mjs";
export function wav(seconds = 1) {
  const count = 48000 * seconds,
    b = Buffer.alloc(44 + count * 2);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(48000, 24);
  b.writeUInt32LE(96000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++)
    b.writeInt16LE(
      Math.sin((i / 48000) * 440 * Math.PI * 2) * 10000,
      44 + i * 2,
    );
  return b;
}
test("Real API: cookies, pairing, decoding, casting, playback, deletion, isolation and persistence", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "foley-test-"));
  let runtime = await createApp({ database: join(dir, "db.sqlite") });
  let server = runtime.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  let origin = `http://127.0.0.1:${server.address().port}`;
  const call = async (
    path,
    { method = "GET", cookie, body, raw, originHeader } = {},
  ) => {
    const res = await fetch(origin + "/api" + path, {
      method,
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(raw
          ? {
              "Content-Type": "application/octet-stream",
              "X-Take-Name": "Fresh%20tone",
            }
          : {}),
        ...(originHeader ? { Origin: originHeader } : {}),
      },
      body: raw || (body ? JSON.stringify(body) : undefined),
    });
    return {
      res,
      data: res.headers.get("content-type")?.includes("json")
        ? await res.json()
        : await res.arrayBuffer(),
      cookie: res.headers
        .getSetCookie()
        .map((x) => x.split(";")[0])
        .join("; "),
    };
  };
  try {
    const created = await call("/sessions", {
      method: "POST",
      body: { title: "Test picture" },
    });
    assert.equal(created.res.status, 201);
    assert(created.res.headers.get("set-cookie").includes("HttpOnly"));
    assert(created.res.headers.get("set-cookie").includes("SameSite=Strict"));
    const id = created.data.id,
      host = created.cookie,
      base = "/sessions/" + id;
    let state = await call(base, { cookie: host });
    const pair = await call("/join", {
      method: "POST",
      body: { code: state.data.code, name: "Sam" },
    });
    const crew = pair.cookie;
    await t.test(
      "Anonymous users cannot read session or recordings",
      async () => {
        assert.equal((await call(base)).res.status, 401);
      },
    );
    await t.test("Cross-origin mutations are rejected", async () => {
      assert.equal(
        (
          await call(base + "/code", {
            method: "POST",
            cookie: host,
            originHeader: "https://elsewhere.example",
          })
        ).res.status,
        403,
      );
    });
    await t.test(
      "Corrupt and overlong audio fail server validation",
      async () => {
        assert.equal(
          (
            await call(base + "/clips", {
              method: "POST",
              cookie: crew,
              raw: Buffer.alloc(100),
            })
          ).res.status,
          400,
        );
        assert.equal(
          (
            await call(base + "/clips", {
              method: "POST",
              cookie: crew,
              raw: wav(9),
            })
          ).res.status,
          400,
        );
      },
    );
    const uploaded = await call(base + "/clips", {
      method: "POST",
      cookie: crew,
      raw: wav(),
    });
    assert.equal(uploaded.res.status, 201);
    const cid = uploaded.data.id;
    await t.test("Valid audio becomes playable normalized WAV", async () => {
      const audio = await call(base + "/clips/" + cid + "/audio", {
        cookie: host,
      });
      assert.equal(audio.res.status, 200);
      assert.equal(audio.res.headers.get("content-type"), "audio/wav");
      assert.equal(Buffer.from(audio.data).toString("utf8", 0, 4), "RIFF");
      state = await call(base, { cookie: host });
      assert(state.data.clips[0].duration >= 0.99);
    });
    await t.test("Crew cannot direct or close studio", async () => {
      assert.equal(
        (
          await call(base + "/cast", {
            method: "POST",
            cookie: crew,
            body: { role: "weather", clipId: cid, revision: 1 },
          })
        ).res.status,
        403,
      );
      assert.equal(
        (await call(base, { method: "DELETE", cookie: crew })).res.status,
        403,
      );
    });
    for (const [i, role] of ["footsteps", "weather", "creature"].entries())
      assert.equal(
        (
          await call(base + "/cast", {
            method: "POST",
            cookie: host,
            body: { role, clipId: cid, revision: i + 1, volume: 0.8 },
          })
        ).res.status,
        200,
      );
    await t.test("Stale premiere and upload while playing fail", async () => {
      assert.equal(
        (
          await call(base + "/play", {
            method: "POST",
            cookie: host,
            body: { revision: 0 },
          })
        ).res.status,
        409,
      );
      assert.equal(
        (
          await call(base + "/play", {
            method: "POST",
            cookie: host,
            body: { revision: 4 },
          })
        ).res.status,
        200,
      );
      assert.equal(
        (
          await call(base + "/clips", {
            method: "POST",
            cookie: crew,
            raw: wav(),
          })
        ).res.status,
        409,
      );
      await call(base + "/stop", { method: "POST", cookie: host });
    });
    await t.test(
      "Session survives server restart with unchanged auth cookie",
      async () => {
        await new Promise((r) => server.close(r));
        runtime.close();
        runtime = await createApp({ database: join(dir, "db.sqlite") });
        server = runtime.app.listen(0, "127.0.0.1");
        await new Promise((r) => server.once("listening", r));
        origin = `http://127.0.0.1:${server.address().port}`;
        state = await call(base, { cookie: host });
        assert.equal(state.data.clips.length, 1);
        assert.equal(state.data.premieres, 1);
      },
    );
    await t.test(
      "End studio destroys all recordings and authorization",
      async () => {
        assert.equal(
          (await call(base, { method: "DELETE", cookie: host })).res.status,
          200,
        );
        assert.equal(
          (await call(base + "/clips/" + cid + "/audio", { cookie: crew })).res
            .status,
          404,
        );
      },
    );
  } finally {
    await new Promise((r) => server.close(r));
    runtime.close();
    await rm(dir, { recursive: true, force: true });
  }
});
