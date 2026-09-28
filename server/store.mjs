import { DatabaseSync } from "node:sqlite";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
export const ROLES = ["footsteps", "weather", "creature"];
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export const secret = () => randomBytes(32).toString("base64url");
export function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
export function text(value, max, label) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    fail(400, `${label} must be between 1 and ${max} characters.`);
  return value.trim();
}
export function createStore(path, clock = Date.now) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA secure_delete=ON;",
  );
  db.exec(`CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, title TEXT NOT NULL, code TEXT UNIQUE NOT NULL, code_until INTEGER NOT NULL, expires INTEGER NOT NULL, revision INTEGER NOT NULL DEFAULT 0, casts TEXT NOT NULL DEFAULT '{}', premieres INTEGER NOT NULL DEFAULT 0, recording_member TEXT, recording_until INTEGER DEFAULT 0, playing_until INTEGER DEFAULT 0, created INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS members(id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, name TEXT NOT NULL, token_hash TEXT UNIQUE NOT NULL, kind TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS clips(id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE, name TEXT NOT NULL, duration REAL NOT NULL, bytes BLOB NOT NULL, created INTEGER NOT NULL, peaks TEXT NOT NULL DEFAULT '[]');
  CREATE TABLE IF NOT EXISTS premieres(id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, casts TEXT NOT NULL, created INTEGER NOT NULL);`);
  if (
    !db
      .prepare("PRAGMA table_info(clips)")
      .all()
      .some((c) => c.name === "peaks")
  )
    db.exec("ALTER TABLE clips ADD COLUMN peaks TEXT NOT NULL DEFAULT '[]'");
  const code = () => randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
  const cleanup = () =>
    db.prepare("DELETE FROM sessions WHERE expires <= ?").run(clock());
  function get(id) {
    cleanup();
    const s = db.prepare("SELECT * FROM sessions WHERE id=?").get(id);
    if (!s) fail(404, "This studio has ended or expired. Start a new one.");
    return s;
  }
  function member(id, tokens) {
    get(id);
    for (const token of tokens.filter(Boolean)) {
      const m = db
        .prepare("SELECT * FROM members WHERE session_id=? AND token_hash=?")
        .get(id, hash(token));
      if (m) return m;
    }
    fail(
      401,
      "Pair your phone or return to the browser that started this studio.",
    );
  }
  function host(id, tokens) {
    const m = member(id, tokens);
    if (m.kind !== "host") fail(403, "Only the director can do that.");
    return m;
  }
  function idle(s) {
    if (s.playing_until > clock())
      fail(409, "The premiere is playing. Wait for it to finish.");
  }
  function snapshot(id, m) {
    const s = get(id);
    const clips = db
      .prepare(
        "SELECT c.id,c.name,c.duration,c.created,c.member_id,c.peaks,m.name AS contributor FROM clips c JOIN members m ON m.id=c.member_id WHERE c.session_id=? ORDER BY c.created",
      )
      .all(id)
      .map((c) => ({ ...c, peaks: JSON.parse(c.peaks) }));
    return {
      id: s.id,
      title: s.title,
      code: m.kind === "host" ? s.code : undefined,
      codeExpires: m.kind === "host" ? s.code_until : undefined,
      expires: s.expires,
      revision: s.revision,
      casts: JSON.parse(s.casts),
      premieres: s.premieres,
      role: m.kind,
      me: { id: m.id, name: m.name },
      clips,
      crew: db
        .prepare("SELECT id,name,kind FROM members WHERE session_id=?")
        .all(id),
      recording: s.recording_until > clock() ? s.recording_member : null,
      playingUntil: s.playing_until,
    };
  }
  return {
    db,
    clock,
    cleanup,
    get,
    member,
    host,
    snapshot,
    create(title) {
      cleanup();
      const id = randomUUID(),
        token = secret(),
        mid = randomUUID(),
        now = clock();
      db.prepare(
        "INSERT INTO sessions(id,title,code,code_until,expires,created) VALUES(?,?,?,?,?,?)",
      ).run(
        id,
        text(title, 60, "Film title"),
        code(),
        now + 600000,
        now + 21600000,
        now,
      );
      db.prepare("INSERT INTO members VALUES(?,?,?,?,?)").run(
        mid,
        id,
        "Director",
        hash(token),
        "host",
      );
      return { id, token };
    },
    join(pairCode, name) {
      cleanup();
      if (
        typeof pairCode !== "string" ||
        !/^[0-9A-F]{6}$/.test(pairCode.toUpperCase())
      )
        fail(400, "Enter the six-character code on the TV.");
      const s = db
        .prepare("SELECT * FROM sessions WHERE code=? AND code_until>?")
        .get(pairCode.toUpperCase(), clock());
      if (!s)
        fail(
          404,
          "That pairing code has expired or is not right. Ask the director for a new code.",
        );
      if (
        db
          .prepare("SELECT COUNT(*) AS n FROM members WHERE session_id=?")
          .get(s.id).n >= 12
      )
        fail(409, "This studio already has its full crew.");
      const token = secret();
      db.prepare("INSERT INTO members VALUES(?,?,?,?,?)").run(
        randomUUID(),
        s.id,
        text(name, 32, "Crew name"),
        hash(token),
        "crew",
      );
      return { id: s.id, token };
    },
    refresh(id, tokens) {
      host(id, tokens);
      db.prepare("UPDATE sessions SET code=?,code_until=? WHERE id=?").run(
        code(),
        clock() + 600000,
        id,
      );
    },
    addClip(id, m, name, duration, bytes, peaks = []) {
      const s = get(id);
      idle(s);
      if (s.recording_until > clock() && s.recording_member !== m.id)
        fail(409, "Another crew member is recording. Try again in a moment.");
      if (
        db.prepare("SELECT COUNT(*) AS n FROM clips WHERE session_id=?").get(id)
          .n >= 18
      )
        fail(
          409,
          "The studio has 18 takes. Remove a take before adding another.",
        );
      if (
        db
          .prepare(
            "SELECT COUNT(*) AS n FROM clips WHERE session_id=? AND member_id=?",
          )
          .get(id, m.id).n >= 6
      )
        fail(409, "You have six takes. Remove one before adding another.");
      const clipId = randomUUID();
      db.prepare("INSERT INTO clips VALUES(?,?,?,?,?,?,?,?)").run(
        clipId,
        id,
        m.id,
        text(name, 48, "Take name"),
        duration,
        bytes,
        clock(),
        JSON.stringify(peaks),
      );
      db.prepare(
        "UPDATE sessions SET revision=revision+1,recording_until=0 WHERE id=?",
      ).run(id);
      return clipId;
    },
    removeClip(id, m, cid) {
      const s = get(id);
      idle(s);
      const c = db
        .prepare("SELECT * FROM clips WHERE id=? AND session_id=?")
        .get(cid, id);
      if (!c) fail(404, "That take is no longer here.");
      if (m.kind !== "host" && c.member_id !== m.id)
        fail(403, "You can only remove your own takes.");
      const casts = JSON.parse(s.casts);
      for (const r of ROLES) if (casts[r]?.clipId === cid) delete casts[r];
      db.prepare("DELETE FROM clips WHERE id=?").run(cid);
      db.prepare(
        "UPDATE sessions SET casts=?,revision=revision+1 WHERE id=?",
      ).run(JSON.stringify(casts), id);
    },
    cast(id, tokens, role, clipId, revision, volume = 0.8) {
      host(id, tokens);
      const s = get(id);
      idle(s);
      if (s.revision !== revision)
        fail(
          409,
          "The studio changed. Review the latest takes and cast again.",
        );
      if (!ROLES.includes(role))
        fail(400, "Choose footsteps, weather or creature.");
      if (!Number.isFinite(volume) || volume < 0 || volume > 1)
        fail(400, "Volume must be between 0 and 1.");
      const casts = JSON.parse(s.casts);
      if (clipId === null) delete casts[role];
      else {
        if (
          !db
            .prepare("SELECT id FROM clips WHERE id=? AND session_id=?")
            .get(clipId, id)
        )
          fail(404, "Choose a take from this studio.");
        casts[role] = { clipId, volume };
      }
      db.prepare(
        "UPDATE sessions SET casts=?,revision=revision+1 WHERE id=?",
      ).run(JSON.stringify(casts), id);
    },
    recording(id, m, active) {
      const s = get(id);
      idle(s);
      if (active && s.recording_until > clock() && s.recording_member !== m.id)
        fail(409, "Another microphone is rolling. Wait a moment.");
      if (active)
        db.prepare(
          "UPDATE sessions SET recording_member=?,recording_until=? WHERE id=?",
        ).run(m.id, clock() + 15000, id);
      else if (s.recording_member === m.id)
        db.prepare("UPDATE sessions SET recording_until=0 WHERE id=?").run(id);
    },
    play(id, tokens, revision) {
      host(id, tokens);
      const s = get(id);
      idle(s);
      if (s.recording_until > clock())
        fail(409, "A microphone is rolling. Wait for that take to finish.");
      if (s.revision !== revision)
        fail(409, "The cast changed. Prepare the latest soundtrack again.");
      const casts = JSON.parse(s.casts);
      if (ROLES.some((r) => !casts[r]))
        fail(409, "Cast all three sound roles before the premiere.");
      db.prepare(
        "UPDATE sessions SET playing_until=?,premieres=premieres+1 WHERE id=?",
      ).run(clock() + 22000, id);
      db.prepare("INSERT INTO premieres VALUES(?,?,?,?)").run(
        randomUUID(),
        id,
        s.casts,
        clock(),
      );
    },
    stop(id, tokens) {
      host(id, tokens);
      db.prepare("UPDATE sessions SET playing_until=0 WHERE id=?").run(id);
    },
    clip(id, cid, tokens) {
      member(id, tokens);
      const c = db
        .prepare("SELECT bytes FROM clips WHERE id=? AND session_id=?")
        .get(cid, id);
      if (!c) fail(404, "That take is no longer here.");
      return c.bytes;
    },
    end(id, tokens) {
      host(id, tokens);
      db.prepare("DELETE FROM sessions WHERE id=?").run(id);
    },
    close() {
      db.close();
    },
  };
}
