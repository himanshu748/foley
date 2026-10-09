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
  CREATE TABLE IF NOT EXISTS cuts(id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, slot TEXT NOT NULL CHECK(slot IN ('A','B')), label TEXT NOT NULL, casts TEXT NOT NULL, source_revision INTEGER NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL, UNIQUE(session_id,slot));
  CREATE TABLE IF NOT EXISTS playback_leases(session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE, playback_id TEXT NOT NULL REFERENCES premieres(id) ON DELETE CASCADE);
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
  function transaction(fn) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      // SQLite can already have rolled back (for example RAISE(ROLLBACK)).
      // Preserve the original action error if cleanup itself fails.
      try {
        db.exec("ROLLBACK");
      } catch {}
      throw error;
    }
  }
  function slotName(slot) {
    if (slot !== "A" && slot !== "B") fail(400, "Choose Cut A or Cut B.");
  }
  function noRecording(s) {
    if (s.recording_until > clock())
      fail(409, "A microphone is rolling. Wait for that take to finish.");
  }
  function validateCasts(id, raw) {
    let casts;
    try {
      casts = JSON.parse(raw);
    } catch {
      fail(409, "This soundtrack is invalid. Save a new version.");
    }
    if (
      !casts ||
      typeof casts !== "object" ||
      Array.isArray(casts) ||
      Object.keys(casts).length !== 3 ||
      ROLES.some((role) => {
        const c = casts[role];
        return (
          !c ||
          typeof c.clipId !== "string" ||
          !Number.isFinite(c.volume) ||
          c.volume < 0 ||
          c.volume > 1
        );
      })
    )
      fail(409, "Cast all three sound roles before the premiere.");
    const missingClipIds = [
      ...new Set(ROLES.map((r) => casts[r].clipId)),
    ].filter(
      (cid) =>
        !db
          .prepare(
            "SELECT id FROM clips WHERE id=? AND session_id=? AND length(bytes)>0",
          )
          .get(cid, id),
    );
    return { casts, missingClipIds };
  }
  function presentCut(c) {
    let casts = {},
      missingClipIds = [],
      valid = false;
    try {
      ({ casts, missingClipIds } = validateCasts(c.session_id, c.casts));
      valid = !missingClipIds.length;
    } catch (error) {
      // A malformed snapshot remains visible and removable; storage failures
      // still propagate instead of being misreported as a damaged cut.
      if (error.status !== 409) throw error;
    }
    return {
      id: c.id,
      slot: c.slot,
      label: c.label,
      casts,
      sourceRevision: c.source_revision,
      created: c.created,
      updated: c.updated,
      valid,
      missingClipIds,
      roles: [...ROLES],
    };
  }
  function exactCut(id, slot, cutId) {
    slotName(slot);
    if (typeof cutId !== "string" || !cutId)
      fail(400, "Choose the saved cut to use.");
    const c = db
      .prepare("SELECT * FROM cuts WHERE session_id=? AND slot=?")
      .get(id, slot);
    if (!c || c.id !== cutId)
      fail(409, "This cut changed. Review the latest saved version.");
    return c;
  }
  function completeCasts(id, raw) {
    const result = validateCasts(id, raw);
    if (result.missingClipIds.length) {
      const error = new Error(
        "A take used in this cut was removed. Save a new version.",
      );
      error.status = 409;
      error.missingClipIds = result.missingClipIds;
      throw error;
    }
    return result.casts;
  }
  function claimPlayback(id, casts) {
    const playbackId = randomUUID();
    db.prepare("INSERT INTO premieres VALUES(?,?,?,?)").run(
      playbackId,
      id,
      JSON.stringify(casts),
      clock(),
    );
    db.prepare(
      "INSERT INTO playback_leases VALUES(?,?) ON CONFLICT(session_id) DO UPDATE SET playback_id=excluded.playback_id",
    ).run(id, playbackId);
    db.prepare(
      "UPDATE sessions SET playing_until=?,premieres=premieres+1 WHERE id=?",
    ).run(clock() + 22000, id);
    return playbackId;
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
    listCuts(id, tokens) {
      host(id, tokens);
      return db
        .prepare("SELECT * FROM cuts WHERE session_id=? ORDER BY slot")
        .all(id)
        .map(presentCut);
    },
    saveCut(id, tokens, slot, body) {
      return transaction(() => {
        host(id, tokens);
        slotName(slot);
        if (
          !body ||
          typeof body !== "object" ||
          Array.isArray(body) ||
          Object.keys(body).some(
            (k) => !["label", "expectedRevision", "expectedCutId"].includes(k),
          )
        )
          fail(
            400,
            "Save a label and the current studio and cut versions only.",
          );
        const label = text(body.label, 32, "Cut label");
        if (
          !Number.isInteger(body.expectedRevision) ||
          body.expectedRevision < 0 ||
          !(
            body.expectedCutId === null ||
            (typeof body.expectedCutId === "string" && body.expectedCutId)
          )
        )
          fail(400, "Review the current studio and saved cut before saving.");
        const s = get(id);
        idle(s);
        noRecording(s);
        if (s.revision !== body.expectedRevision)
          fail(
            409,
            "The studio changed. Review the latest cast before saving.",
          );
        const old = db
          .prepare("SELECT * FROM cuts WHERE session_id=? AND slot=?")
          .get(id, slot);
        if ((old?.id ?? null) !== body.expectedCutId)
          fail(409, "This cut changed. Review it before replacing it.");
        const casts = completeCasts(id, s.casts),
          now = clock(),
          cutId = randomUUID();
        db.prepare(
          "INSERT INTO cuts VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(session_id,slot) DO UPDATE SET id=excluded.id,label=excluded.label,casts=excluded.casts,source_revision=excluded.source_revision,updated=excluded.updated",
        ).run(
          cutId,
          id,
          slot,
          label,
          JSON.stringify(casts),
          s.revision,
          now,
          now,
        );
        return {
          cut: presentCut(
            db.prepare("SELECT * FROM cuts WHERE id=?").get(cutId),
          ),
          created: !old,
        };
      });
    },
    playCut(id, tokens, slot, cutId) {
      return transaction(() => {
        host(id, tokens);
        const s = get(id);
        idle(s);
        noRecording(s);
        const c = exactCut(id, slot, cutId),
          casts = completeCasts(id, c.casts);
        return {
          ok: true,
          cutId: c.id,
          durationMs: 20000,
          casts,
          playbackId: claimPlayback(id, casts),
        };
      });
    },
    deleteCut(id, tokens, slot, cutId) {
      return transaction(() => {
        host(id, tokens);
        idle(get(id));
        const c = exactCut(id, slot, cutId);
        db.prepare("DELETE FROM cuts WHERE id=?").run(c.id);
      });
    },
    play(id, tokens, revision) {
      return transaction(() => {
        host(id, tokens);
        const s = get(id);
        idle(s);
        noRecording(s);
        if (s.revision !== revision)
          fail(409, "The cast changed. Prepare the latest soundtrack again.");
        return claimPlayback(id, completeCasts(id, s.casts));
      });
    },
    stop(id, tokens, playbackId) {
      return transaction(() => {
        host(id, tokens);
        if (playbackId !== undefined) {
          if (typeof playbackId !== "string" || !playbackId)
            fail(400, "Choose the premiere to stop.");
          const lease = db
            .prepare(
              "SELECT playback_id FROM playback_leases WHERE session_id=?",
            )
            .get(id);
          if (lease?.playback_id !== playbackId) return;
        }
        db.prepare("UPDATE sessions SET playing_until=0 WHERE id=?").run(id);
        db.prepare("DELETE FROM playback_leases WHERE session_id=?").run(id);
      });
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
