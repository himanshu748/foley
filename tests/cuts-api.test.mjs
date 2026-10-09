import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/index.mjs";
import { ROLES } from "../server/store.mjs";
test("Cut HTTP contract: host-only snapshots, stale IDs, concurrent claims, missing media and scoped stop", async () => {
  const runtime = await createApp({ database: ":memory:" });
  const server = runtime.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, method = "GET", cookie = "", body) => {
    const res = await fetch(origin + "/api" + path, {
      method,
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: res.status,
      data: await res.json(),
      cookie: res.headers
        .getSetCookie()
        .map((s) => s.split(";")[0])
        .join("; "),
    };
  };
  try {
    const h = await call("/sessions", "POST", "", { title: "Cut API" }),
      id = h.data.id,
      base = "/sessions/" + id;
    const state = await call(base, "GET", h.cookie);
    const crew = await call("/join", "POST", "", {
      code: state.data.code,
      name: "Sam",
    });
    const other = await call("/sessions", "POST", "", { title: "Other" });
    // Cut tests use a labeled byte fixture; decoding/upload has independent existing API coverage.
    const cm = runtime.store.member(id, [crew.cookie.split("=")[1]]);
    const cid = runtime.store.addClip(
      id,
      cm,
      "Byte fixture",
      1,
      Buffer.alloc(100),
    );
    for (const [i, role] of ROLES.entries())
      assert.equal(
        (
          await call(base + "/cast", "POST", h.cookie, {
            role,
            clipId: cid,
            revision: i + 1,
            volume: 0.8,
          })
        ).status,
        200,
      );
    for (const [cookie, status] of [
      ["", 401],
      [crew.cookie, 403],
      [other.cookie, 401],
    ]) {
      for (const [suffix, method, body] of [
        ["/cuts", "GET"],
        ["/cuts/A", "PUT", {}],
        ["/cuts/A/play", "POST", { cutId: "guess" }],
        ["/cuts/A", "DELETE", { cutId: "guess" }],
      ])
        assert.equal(
          (await call(base + suffix, method, cookie, body)).status,
          status,
        );
    }
    assert.deepEqual((await call(base + "/cuts", "GET", h.cookie)).data, {
      cuts: [],
    });
    const saveBody = {
      label: "Cut A",
      expectedRevision: 4,
      expectedCutId: null,
    };
    for (const extra of [
      { casts: {} },
      { sourceRevision: 0 },
      { expectedRevision: undefined },
      { expectedCutId: undefined },
    ])
      assert.equal(
        (
          await call(base + "/cuts/A", "PUT", h.cookie, {
            ...saveBody,
            ...extra,
          })
        ).status,
        400,
      );
    assert.equal(
      (await call(base + "/cuts/C", "PUT", h.cookie, saveBody)).status,
      400,
    );
    const saved = await call(base + "/cuts/A", "PUT", h.cookie, saveBody);
    assert.equal(saved.status, 201);
    const oldId = saved.data.cut.id;
    const overwrite = await call(base + "/cuts/A", "PUT", h.cookie, {
      ...saveBody,
      expectedCutId: oldId,
    });
    assert.equal(overwrite.status, 200);
    const cut = overwrite.data.cut;
    assert.notEqual(cut.id, oldId);
    assert.equal(
      (await call(base + "/cuts/A/play", "POST", h.cookie, { cutId: oldId }))
        .status,
      409,
    );
    assert.equal(
      (await call(base + "/cuts/A", "DELETE", h.cookie, { cutId: oldId }))
        .status,
      409,
    );
    const before = (await call(base, "GET", h.cookie)).data;
    const claims = await Promise.all([
      call(base + "/cuts/A/play", "POST", h.cookie, { cutId: cut.id }),
      call(base + "/cuts/A/play", "POST", h.cookie, { cutId: cut.id }),
    ]);
    assert.deepEqual(claims.map((c) => c.status).sort(), [200, 409]);
    const claim = claims.find((c) => c.status === 200).data;
    assert.equal(claim.cutId, cut.id);
    assert.equal(claim.durationMs, 20000);
    assert.deepEqual(claim.casts, cut.casts);
    assert.equal(typeof claim.playbackId, "string");
    const after = (await call(base, "GET", h.cookie)).data;
    assert.deepEqual(after.casts, before.casts);
    assert.equal(after.revision, before.revision);
    assert.equal(after.premieres, 1);
    assert.equal(
      (await call(base + "/clips/" + cid, "DELETE", crew.cookie)).status,
      409,
    );
    assert.equal(
      (await call(base + "/cuts/A", "DELETE", h.cookie, { cutId: cut.id }))
        .status,
      409,
    );
    await call(base + "/stop", "POST", h.cookie, {
      playbackId: claim.playbackId,
    });
    const newer = await call(base + "/play", "POST", h.cookie, { revision: 4 });
    assert.equal(newer.status, 200);
    await call(base + "/stop", "POST", h.cookie, {
      playbackId: claim.playbackId,
    });
    assert((await call(base, "GET", h.cookie)).data.playingUntil > Date.now());
    await call(base + "/stop", "POST", h.cookie, {
      playbackId: newer.data.playbackId,
    });
    assert.equal(
      (await call(base + "/clips/" + cid, "DELETE", crew.cookie)).status,
      200,
    );
    const listed = (await call(base + "/cuts", "GET", h.cookie)).data.cuts[0];
    assert.equal(listed.valid, false);
    assert.deepEqual(listed.missingClipIds, [cid]);
    const missing = await call(base + "/cuts/A/play", "POST", h.cookie, {
      cutId: cut.id,
    });
    assert.equal(missing.status, 409);
    assert.deepEqual(missing.data.missingClipIds, [cid]);
    assert.match(missing.data.error, /removed/);
    assert.equal(
      (await call(base + "/cuts/A", "DELETE", h.cookie, { cutId: cut.id }))
        .status,
      200,
    );
    assert.equal((await call(base, "DELETE", h.cookie)).status, 200);
    assert.equal((await call(base + "/cuts", "GET", h.cookie)).status, 404);
  } finally {
    await new Promise((r) => server.close(r));
    runtime.close();
  }
});
