import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore, ROLES } from "../server/store.mjs";
function fixture(fn) {
  let now = 1000000;
  const store = createStore(":memory:", () => now);
  const h = store.create("Cuts");
  const hm = store.member(h.id, [h.token]);
  const crew = store.join(store.get(h.id).code, "Sam");
  const cm = store.member(h.id, [crew.token]);
  const cid = store.addClip(h.id, cm, "Tap", 1, Buffer.alloc(100));
  for (const role of ROLES)
    store.cast(h.id, [h.token], role, cid, store.get(h.id).revision);
  const save = (slot = "A", expectedCutId = null, extra = {}) =>
    store.saveCut(h.id, [h.token], slot, {
      label: "First",
      expectedRevision: store.get(h.id).revision,
      expectedCutId,
      ...extra,
    }).cut;
  try {
    fn({ store, h, hm, crew, cm, cid, save, advance: (n) => (now += n) });
  } finally {
    store.close();
  }
}
test("Two immutable cut slots preserve server casts, revision and overwrite preconditions", () =>
  fixture(({ store, h, save, advance }) => {
    const before = store.get(h.id),
      a = save(),
      b = save("B");
    assert.deepEqual(a.casts, JSON.parse(before.casts));
    assert.equal(a.sourceRevision, before.revision);
    assert.equal(a.valid, true);
    advance(10);
    const replacement = save("A", a.id);
    assert.notEqual(replacement.id, a.id);
    assert.equal(replacement.created, a.created);
    assert(replacement.updated > a.updated);
    assert.equal(store.listCuts(h.id, [h.token]).length, 2);
    assert.throws(() => save("A", a.id), { status: 409 });
    assert.throws(() => save("C"), { status: 400 });
    assert.throws(() => save("B", b.id, { expectedRevision: 0 }), {
      status: 409,
    });
    for (const extra of [
      { casts: {} },
      { sourceRevision: 0 },
      { clipId: "forged" },
      { expectedCutId: undefined },
      { expectedRevision: undefined },
      { label: " " },
    ])
      assert.throws(() => save("A", replacement.id, extra), { status: 400 });
    assert.equal(store.get(h.id).casts, before.casts);
    assert.equal(store.get(h.id).revision, before.revision);
  }));
test("Cuts reject contributors, anonymous callers and other studio hosts", () =>
  fixture(({ store, h, crew, save }) => {
    const a = save(),
      other = store.create("Other");
    for (const [tokens, status] of [
      [[crew.token], 403],
      [[], 401],
      [[other.token], 401],
    ]) {
      for (const action of [
        () => store.listCuts(h.id, tokens),
        () => store.saveCut(h.id, tokens, "A", {}),
        () => store.playCut(h.id, tokens, "A", a.id),
        () => store.deleteCut(h.id, tokens, "A", a.id),
      ])
        assert.throws(action, { status });
    }
  }));
test("Replay uses saved cast, excludes competing activity and scoped late stops preserve a newer lease", () =>
  fixture(({ store, h, cm, cid, save, advance }) => {
    const a = save();
    store.cast(h.id, [h.token], "weather", cid, store.get(h.id).revision, 0.3);
    const before = store.get(h.id);
    store.recording(h.id, cm, true);
    assert.throws(() => save("B"), { status: 409 });
    assert.throws(() => store.playCut(h.id, [h.token], "A", a.id), {
      status: 409,
    });
    advance(15001);
    const first = store.playCut(h.id, [h.token], "A", a.id);
    assert.deepEqual(first.casts, a.casts);
    assert.equal(
      JSON.parse(
        store.db
          .prepare("SELECT casts FROM premieres WHERE id=?")
          .get(first.playbackId).casts,
      ).weather.volume,
      0.8,
    );
    for (const action of [
      () => store.playCut(h.id, [h.token], "A", a.id),
      () => store.play(h.id, [h.token], before.revision),
      () => save("B"),
      () => store.deleteCut(h.id, [h.token], "A", a.id),
      () => store.removeClip(h.id, cm, cid),
    ])
      assert.throws(action, { status: 409 });
    assert.equal(store.get(h.id).premieres, 1);
    assert.equal(store.get(h.id).casts, before.casts);
    assert.equal(store.get(h.id).revision, before.revision);
    advance(22001);
    const second = store.play(h.id, [h.token], before.revision);
    store.stop(h.id, [h.token], first.playbackId);
    assert(store.get(h.id).playing_until > store.clock());
    store.stop(h.id, [h.token], second);
    assert.equal(store.get(h.id).playing_until, 0);
    store.playCut(h.id, [h.token], "A", a.id);
    store.stop(h.id, [h.token]);
    assert.equal(store.get(h.id).playing_until, 0);
  }));
test("Replaced, deleted or corrupt cuts cannot acquire receipts and failures roll back every write", () =>
  fixture(({ store, h, cm, cid, save }) => {
    const a = save(),
      newer = save("A", a.id);
    assert.throws(() => store.playCut(h.id, [h.token], "A", a.id), {
      status: 409,
    });
    assert.throws(() => store.deleteCut(h.id, [h.token], "A", a.id), {
      status: 409,
    });
    store.db.exec(
      "CREATE TRIGGER fail_save BEFORE UPDATE ON cuts BEGIN SELECT RAISE(ABORT,'save failure'); END",
    );
    assert.throws(() => save("A", newer.id), /save failure/);
    store.db.exec("DROP TRIGGER fail_save");
    assert.equal(store.listCuts(h.id, [h.token])[0].id, newer.id);
    // SQLite rolls back itself: the redundant cleanup must not mask this error.
    // The earlier save trigger also verifies rollback of an ordinary ABORT.
    store.db.exec(
      "CREATE TRIGGER fail_claim BEFORE UPDATE OF playing_until ON sessions BEGIN SELECT RAISE(ROLLBACK,'claim failure'); END",
    );
    assert.throws(
      () => store.playCut(h.id, [h.token], "A", newer.id),
      /claim failure/,
    );
    store.db.exec("DROP TRIGGER fail_claim");
    assert.equal(store.get(h.id).premieres, 0);
    for (const table of ["premieres", "playback_leases"])
      assert.equal(
        store.db.prepare(`SELECT count(*) n FROM ${table}`).get().n,
        0,
      );
    store.removeClip(h.id, cm, cid);
    const invalid = store.listCuts(h.id, [h.token])[0];
    assert.equal(invalid.valid, false);
    assert.deepEqual(invalid.missingClipIds, [cid]);
    assert.throws(
      () => store.playCut(h.id, [h.token], "A", newer.id),
      (error) => error.status === 409 && error.missingClipIds[0] === cid,
    );
    store.db
      .prepare("UPDATE cuts SET casts=? WHERE id=?")
      .run("{broken", newer.id);
    assert.throws(() => store.playCut(h.id, [h.token], "A", newer.id), {
      status: 409,
    });
    store.deleteCut(h.id, [h.token], "A", newer.id);
  }));
test("End and expiration cascade saved cuts and lease rows", () =>
  fixture(({ store, h, save, advance }) => {
    const a = save();
    store.playCut(h.id, [h.token], "A", a.id);
    advance(21600001);
    store.cleanup();
    for (const table of [
      "sessions",
      "members",
      "clips",
      "cuts",
      "premieres",
      "playback_leases",
    ])
      assert.equal(
        store.db.prepare(`SELECT count(*) n FROM ${table}`).get().n,
        0,
      );
    const fresh = store.create("End");
    const hm = store.member(fresh.id, [fresh.token]);
    const c = store.addClip(fresh.id, hm, "Tap", 1, Buffer.alloc(100));
    for (const role of ROLES)
      store.cast(
        fresh.id,
        [fresh.token],
        role,
        c,
        store.get(fresh.id).revision,
      );
    store.saveCut(fresh.id, [fresh.token], "B", {
      label: "End",
      expectedRevision: 4,
      expectedCutId: null,
    });
    store.end(fresh.id, [fresh.token]);
    assert.equal(store.db.prepare("SELECT count(*) n FROM cuts").get().n, 0);
  }));
test("Legacy database migration, reopen and restored baseline preserve authentication, casts and receipts", () => {
  const dir = mkdtempSync(join(tmpdir(), "foley-migration-")),
    path = join(dir, "legacy.sqlite"),
    backup = join(dir, "backup.sqlite");
  let store;
  try {
    store = createStore(path);
    const h = store.create("Legacy"),
      hm = store.member(h.id, [h.token]);
    const c = store.addClip(h.id, hm, "Legacy take", 1, Buffer.alloc(100));
    for (const role of ROLES)
      store.cast(h.id, [h.token], role, c, store.get(h.id).revision);
    store.play(h.id, [h.token], 4);
    store.stop(h.id, [h.token]);
    const before = store.get(h.id);
    // Remove additive v1.1 tables to reproduce exactly the baseline schema.
    store.db.exec("DROP TABLE playback_leases; DROP TABLE cuts");
    store.close();
    store = null;
    copyFileSync(path, backup);
    store = createStore(path);
    assert.equal(
      store.snapshot(h.id, store.member(h.id, [h.token])).premieres,
      1,
    );
    assert.equal(store.get(h.id).casts, before.casts);
    const a = store.saveCut(h.id, [h.token], "A", {
      label: "Persistent",
      expectedRevision: 4,
      expectedCutId: null,
    }).cut;
    const played = store.playCut(h.id, [h.token], "A", a.id);
    store.close();
    store = createStore(path);
    assert.equal(store.listCuts(h.id, [h.token])[0].id, a.id);
    store.stop(h.id, [h.token], played.playbackId);
    assert.equal(store.get(h.id).playing_until, 0);
    store.end(h.id, [h.token]);
    assert.equal(store.db.prepare("SELECT count(*) n FROM cuts").get().n, 0);
    store.close();
    store = createStore(backup);
    assert.equal(store.get(h.id).casts, before.casts);
    assert.equal(store.listCuts(h.id, [h.token]).length, 0);
    assert.equal(store.get(h.id).premieres, 1);
  } finally {
    store?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Malformed cut rows stay invalid and deletable without hiding a valid second slot", () =>
  fixture(({ store, h, save }) => {
    const a = save(),
      b = save("B");
    for (const raw of [
      "{broken",
      "null",
      "[]",
      '{"footsteps":{"clipId":"missing","volume":2}}',
    ]) {
      store.db.prepare("UPDATE cuts SET casts=? WHERE id=?").run(raw, a.id);
      const listed = store.listCuts(h.id, [h.token]);
      assert.equal(listed.length, 2);
      assert.equal(listed[0].id, a.id);
      assert.equal(listed[0].slot, "A");
      assert.equal(listed[0].valid, false);
      assert.deepEqual(listed[0].casts, {});
      assert.deepEqual(listed[0].missingClipIds, []);
      assert.equal(listed[1].id, b.id);
      assert.equal(listed[1].valid, true);
      assert.throws(() => store.playCut(h.id, [h.token], "A", a.id), {
        status: 409,
      });
    }
    store.deleteCut(h.id, [h.token], "A", a.id);
    assert.deepEqual(
      store.listCuts(h.id, [h.token]).map((cut) => cut.id),
      [b.id],
    );
  }));
