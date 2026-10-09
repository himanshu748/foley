# Saved A/B cuts

The director can keep two complete soundtracks for the same twenty-second film. Save copies the authoritative current three-role cast and levels. Playback uses the saved cast through the same Web Audio scheduler as the ordinary premiere; it never loads that cast into the active edit. Credits describe the replayed cut. Empty studios remain empty.

## Behavior

- Save A, change a role or level, then save B. Cards list takes/levels and identify changed roles. The UI uses automatic labels Soundtrack A/B; custom labels are supported by the API but label editing is intentionally outside this small comparison flow.
- Replace and Delete require an explicit confirmation; Keep is focused first and Back cancels. TV Play/Pause targets the focused saved card.
- Saving and playback wait for active recording or playback to finish. Deleting a snapshot is blocked during playback and never deletes the underlying recordings.
- Removing a take invalidates every referencing saved cut. Play is disabled with a recovery explanation. Cast replacements and explicitly save the cut again. No automatic substitution.
- Malformed stored snapshots remain listed as invalid so the director can delete or replace the affected slot. Slots are private to the director. They expire/end with the studio and survive process restart. Clips are referenced, not duplicated. Studio media limits and six-hour retention stay unchanged.

## Additive API

All routes use existing same-origin and studio-scoped cookie authorization and are host-only. Prefix: `/api/sessions/:id`.

| Route | Request | Result |
| --- | --- | --- |
| GET `/cuts` | — | `{cuts: SavedCut[]}` |
| PUT `/cuts/:slot` | `{label, expectedRevision, expectedCutId}` | 201 new / 200 overwrite, `{cut}` |
| POST `/cuts/:slot/play` | `{cutId}` | `{ok:true, cutId, durationMs:20000, casts, playbackId}` |
| DELETE `/cuts/:slot` | `{cutId}` | `{ok:true}` |

`slot` must be A/B. Labels contain 1–32 trimmed characters. `expectedRevision` must equal the current studio revision. `expectedCutId` is null for an empty slot or the exact current id for replacement. Unexpected snapshot fields are rejected. SavedCut includes `id`, `slot`, `label`, `casts`, `sourceRevision`, `created`, `updated`, `valid`, `missingClipIds` and `roles`.

Every overwrite creates a fresh immutable UUID, even if the source revision is unchanged. The client decodes the snapshot's private audio, then claims playback with that exact `cutId`. A replaced slot returns 409 before acquiring a lease or adding a receipt. The acknowledged cast is checked against the prepared audio before scheduling. Missing media returns 409 with only the explicitly allowed `missingClipIds` detail. Malformed slots return 400 when the studio is idle; an active playback or recording conflict may return 409 first.

The existing ordinary `/play` response adds `playbackId`. `/stop` accepts an optional `{playbackId}` to release only that exact lease; a mismatched id is a successful no-op. Legacy `{}` stop requests retain their original behavior. A canceled preparation makes no unscoped stop request; a late successful claim releases only its own receipt. Save and playback writes run in SQLite transactions. Additive `cuts` and `playback_leases` tables preserve existing session/member/clip/receipt rows and cascade when the session is deleted.

These immutable id preconditions and scoped cancellation are deliberate additions to the supplied v1.1 proposal: revision or timestamps alone cannot prevent another host tab replacing a slot during audio preparation.

## Verify and evidence bounds

`npm test` includes domain and HTTP tests for authority, input validation, stale overwrite/play/delete, deleted media, recording/playback exclusion, scoped late cancellation, transactional rollback, retention and legacy-schema reopen/backup restore. Existing audio API tests cover actual normalization; some cut authority tests explicitly use byte fixtures and do not claim audio decoding.

After `npm run build`, run `npm run test:cuts`; it starts and closes its own isolated in-memory server. Its browser journey uses labeled generated WAV fixtures and exercises the UI and real server. Existing `test:browser`, `test:recorder`, `test:tv` and `test:3d` remain regression checks; `test:tv` also invokes the saved-cut journey. Browser captures/results live under ignored `.impeccable/review/`. The existing Android TV workflow now has a separate bounded browser job that runs the combined TV/cuts suite and recorder recovery on main pushes and manual dispatches, with captures uploaded as `foley-browser-evidence`.

The extended Android TV instrumentation preserves the original two premieres and adds A/B save plus saved A and B replay while B remains active. A new native CI pass and public-origin captured-audio run remain release gates. Earlier emulator/public-video receipts do not establish saved-cut behavior. Synthetic fixtures are not a physical microphone, physical Fire TV or human group playtest.
