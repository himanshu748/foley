import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../server/store.mjs";
function fixture() {
  let now = 1000000;
  const store = createStore(":memory:", () => now);
  const h = store.create("A visitor in the storm");
  const hm = store.member(h.id, [h.token]);
  const code = store.get(h.id).code;
  const p = store.join(code, "Sam");
  const pm = store.member(h.id, [p.token]);
  return { store, h, hm, p, pm, advance: (n) => (now += n) };
}
const withFixture = (fn) => () => {
  const f = fixture();
  try {
    fn(f);
  } finally {
    f.store.close();
  }
};
test(
  "Pairing returns a private member; studio JSON never contains raw tokens",
  withFixture(({ store, h, pm }) => {
    const s = store.snapshot(h.id, pm);
    assert.equal(s.role, "crew");
    assert.equal(s.code, undefined);
    assert(!JSON.stringify(s).includes("token"));
    assert.throws(() => store.member(h.id, ["wrong"]), { status: 401 });
  }),
);
test(
  "Only the host can cast a take",
  withFixture(({ store, h, p, pm }) => {
    const cid = store.addClip(h.id, pm, "Squeak", 1, Buffer.alloc(100));
    assert.throws(() => store.cast(h.id, [p.token], "creature", cid, 1), {
      status: 403,
    });
    store.cast(h.id, [h.token], "creature", cid, 1);
    assert.equal(JSON.parse(store.get(h.id).casts).creature.clipId, cid);
  }),
);
test(
  "Casting uses revision checks and cannot use another studio recording",
  withFixture(({ store, h, pm }) => {
    const cid = store.addClip(h.id, pm, "Squeak", 1, Buffer.alloc(100));
    assert.throws(() => store.cast(h.id, [h.token], "creature", cid, 0), {
      status: 409,
    });
    const other = store.create("Other");
    assert.throws(
      () => store.cast(other.id, [other.token], "creature", cid, 0),
      { status: 404 },
    );
  }),
);
test(
  "Only the original contributor or host may delete a recording",
  withFixture(({ store, h, pm }) => {
    const cid = store.addClip(h.id, pm, "Tap", 1, Buffer.alloc(100));
    const p2 = store.join(store.get(h.id).code, "Jo");
    assert.throws(
      () => store.removeClip(h.id, store.member(h.id, [p2.token]), cid),
      { status: 403 },
    );
    store.removeClip(h.id, pm, cid);
    assert.equal(store.snapshot(h.id, pm).clips.length, 0);
  }),
);
test(
  "Removing a take clears all roles that used it",
  withFixture(({ store, h, pm }) => {
    const cid = store.addClip(h.id, pm, "Tap", 1, Buffer.alloc(100));
    store.cast(h.id, [h.token], "footsteps", cid, 1);
    store.cast(h.id, [h.token], "weather", cid, 2);
    store.removeClip(h.id, pm, cid);
    assert.deepEqual(JSON.parse(store.get(h.id).casts), {});
  }),
);
test(
  "Premiere requires three assigned roles and excludes microphone turns",
  withFixture(({ store, h, pm, advance }) => {
    assert.throws(() => store.play(h.id, [h.token], 0), { status: 409 });
    const cid = store.addClip(h.id, pm, "Tap", 1, Buffer.alloc(100));
    for (const [i, r] of ["footsteps", "weather", "creature"].entries())
      store.cast(h.id, [h.token], r, cid, i + 1);
    store.recording(h.id, pm, true);
    assert.throws(() => store.play(h.id, [h.token], 4), { status: 409 });
    advance(16000);
    store.play(h.id, [h.token], 4);
    assert.throws(
      () => store.addClip(h.id, pm, "Another", 1, Buffer.alloc(100)),
      { status: 409 },
    );
    assert.equal(store.get(h.id).premieres, 1);
    store.stop(h.id, [h.token]);
    store.addClip(h.id, pm, "Another", 1, Buffer.alloc(100));
  }),
);
test(
  "Expired pairing codes can be renewed without invalidating paired crew",
  withFixture(({ store, h, pm, advance }) => {
    const old = store.get(h.id).code;
    advance(600001);
    assert.throws(() => store.join(old, "Late"), { status: 404 });
    store.refresh(h.id, [h.token]);
    assert.equal(store.snapshot(h.id, pm).me.name, "Sam");
    assert.ok(store.join(store.get(h.id).code, "Late"));
  }),
);
test(
  "Sessions expire and cascade-delete takes, crew and premiere receipts",
  withFixture(({ store, h, pm, advance }) => {
    store.addClip(h.id, pm, "Tap", 1, Buffer.alloc(100));
    advance(21600001);
    assert.throws(() => store.get(h.id), { status: 404 });
    for (const table of ["sessions", "clips", "members", "premieres"])
      assert.equal(
        store.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n,
        0,
      );
  }),
);
test(
  "Six-take quota enforces contributor storage bounds",
  withFixture(({ store, h, pm }) => {
    for (let i = 0; i < 6; i++)
      store.addClip(h.id, pm, "Tap " + i, 1, Buffer.alloc(100));
    assert.throws(
      () => store.addClip(h.id, pm, "Extra", 1, Buffer.alloc(100)),
      { status: 409 },
    );
  }),
);
test(
  "Invalid role, empty name and invalid volume are rejected",
  withFixture(({ store, h, pm }) => {
    assert.throws(() => store.join(store.get(h.id).code, " "), { status: 400 });
    const cid = store.addClip(h.id, pm, "Tap", 1, Buffer.alloc(100));
    assert.throws(() => store.cast(h.id, [h.token], "wrong", cid, 1), {
      status: 400,
    });
    assert.throws(() => store.cast(h.id, [h.token], "weather", cid, 1, 4), {
      status: 400,
    });
  }),
);
