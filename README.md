# Foley

Your living room is the sound crew for an original twenty-second movie. Start a studio, pair a phone, record or upload short sounds, cast them as footsteps/weather/creature, premiere the synchronized film, and recast a role for another cut.

[Public 1:59 demo](https://www.youtube.com/watch?v=F-AeLUo3wQ4): Google Android TV API 34, labeled synthetic input, captured emulator audio, and English Deepgram narration/captions.

The [hosted TV interface](https://foley.13.204.212.172.sslip.io/tv) runs against a persistent backend on Amazon Lightsail. The app also runs locally without an AWS account or credentials. New studios start empty, with no generated demonstration recordings or prefilled cast.

The reviewed deployed application is [`af1cf813`](https://github.com/himanshu748/foley/commit/af1cf81318a33b713656e0e655b978f359762b6e), with 23 passing tests and independent Claude review. Public HTTPS, pairing, private audio processing, casting, persistence after replacing the app container, and deletion have passed deployment checks. See [deployment evidence and setup](deploy/README.md) and the [integration friction log](docs/FRICTION-LOG.md). The exact [judging APK](https://github.com/himanshu748/foley/releases/tag/judge-2026-09-30) passed its [public-origin Android TV run](https://github.com/himanshu748/foley/actions/runs/36752896970), including captured output audio from a labeled synthetic fixture. See [Android build and runtime evidence](android/BUILDING.md).

## Run

Requirements: Node 22.13+ (Node 22 prints its built-in SQLite experimental warning), npm, ffmpeg and ffprobe on PATH.

```sh
npm ci
npm run dev
```

Open [localhost:4331](http://localhost:4331). The development and production servers bind to `127.0.0.1` by default. Build and run the production bundle:

```sh
npm run build
npm start
```

The production server uses only runtime dependencies and `dist/`. It stores studios in `data/foley.sqlite`. Both development and production use the same default database; change `DATA_PATH` to isolate them. Shut the server down normally with Ctrl-C.

## Real phone use and deployment

Browsers require HTTPS for microphone access, except localhost on the same device. A QR code for `localhost` cannot connect a separate phone to your computer. For real phone recording, use the [hosted HTTPS origin](https://foley.13.204.212.172.sslip.io) or a trusted HTTPS deployment; every screen must use that same origin. File upload is available when the microphone is unavailable.

Set the canonical origin and persistent storage explicitly:

```sh
PUBLIC_URL=https://foley.example.com HOST=0.0.0.0 PORT=4331 DATA_PATH=/data/foley.sqlite npm start
```

Replace the example domain with the actual host. `PUBLIC_URL` sets exact-origin mutation checks and Secure cookies. A reverse proxy should terminate TLS, enforce a request-body maximum near 4 MB, route to the app, and restrict access to its backend port. Do not expose the app over plain HTTP for real participant recordings. The app does not load `.env` automatically; export variables or use the deployment platform's environment settings.

A Dockerfile is included:

```sh
docker build -t foley-studio .
docker run --rm -p 127.0.0.1:4331:4331 -v foley-data:/app/data -e PUBLIC_URL=https://foley.example.com foley-studio
```

Put the HTTPS proxy in front. Run one app instance per SQLite file, on local persistent storage. Horizontal replication, shared network volumes, managed backups and storage encryption are deployment decisions, not implemented claims. The database contains participant audio; configure retention for backups separately from the application's deletion policy. The container passed [acceptance on an ephemeral GitHub runner](https://github.com/himanshu748/foley/actions/runs/36594968131) and the separate live Lightsail checks documented in [deploy/README.md](deploy/README.md). Those runs used synthetic audio and do not establish a physical phone microphone or heard TV output.

## Product behavior

- A director creates a six-hour studio, with a cryptographically random secret held in an HttpOnly, SameSite=Strict cookie. Only its hash is stored. Private studio URLs alone grant no access.
- A phone enters the six-character pairing code and a contributor name. Codes expire after ten minutes; the director can rotate them without removing paired crew. The pairing code grants recording access, so share it with the intended room.
- A contributor explicitly enables the microphone, previews a local take, discards it or sends it to the studio. Streams stop after the take and on page exit. Recording is capped at eight seconds. The microphone stays off on page load.
- Audio uploads are capped at 4 MB. The server decodes audio using ffprobe/ffmpeg, accepts one audio track in supported containers, rejects video and overlong/corrupt inputs, normalizes loudness, and stores mono 48 kHz WAV. It computes real waveform peaks from PCM; no decorative waveform is presented as measured audio.
- A contributor can keep six takes; a studio holds up to eighteen. The host or original contributor can remove a take. Removal clears every role using that recording.
- The director casts each role and chooses soft/balanced/loud volume. Casting and premiere requests compare the current revision to prevent a stale UI from silently changing a new edit.
- A recording lease keeps microphones from rolling over each other. Premieres and uploads are mutually exclusive. Recordings are prepared before the premiere; all playback and animation are scheduled on one Web Audio clock.
- The original twenty-second film is a real Three.js miniature set: a clay-like mint creature walks past timber trees to a lit cabin, then opens a segmented umbrella. `src/film-three.ts` constructs the scene once and derives every pose from the same time supplied to the sound cues. Weather fills the scene, footsteps have six fixed cues and the creature has two. The film ends with credits derived from the actual cast. The same takes can be reassigned for another cut.
- Three.js is lazy-loaded only for a visible picture. Paused pictures do not keep rendering; offscreen/hidden scenes release their GPU resources. DPR is capped at 1.75 (1.5 on narrow screens), rain uses one instanced mesh, and only one light casts a 1024px shadow. Reduced motion removes lightning, falling rain, body bob and sway while retaining explicit playback of the story. The previous 2D film is retained for WebGL2 unavailability or context loss; its on-screen label identifies that fallback, and the soundtrack clock remains unchanged.
- Studios survive process restarts. They expire after six hours and delete related recordings, membership and premiere receipts. The director can end a studio early. SQLite secure deletion is enabled; filesystem and backup erasure remain infrastructure concerns.
- Losing both the browser cookie and the original session is intentionally not recoverable. There is no account-based recovery. Director and crew cookies are scoped to each studio's API path, so creating another studio does not replace access to an earlier one.

## Privacy and service boundaries

Recordings remain scoped to the paired studio. There is no public feed, export action, analytics SDK, AI inference, remote logging of audio or third-party asset request. The director and paired contributors can audition studio takes. Participants should record themselves and objects they are permitted to record.

The service provides rate limits for session creation, pairing and uploads, two concurrent media-processing slots, clip quotas, cookie authorization, origin checks, CSP and private API responses. It is a small single-instance product, not a claim of an external penetration test, internet-scale abuse protection or formal compliance.

## Verify

```sh
npm test
npm run build
npm audit --omit=dev
# With the server running in another terminal:
npm run test:browser
# Additional rendering/lifecycle verification with the same running server:
TEST_URL=http://localhost:4331 npm run test:3d
```

The browser test needs Playwright Chromium (`npx playwright install chromium` if not already installed). It uses two isolated contexts, a 1440px director and a 390px phone, and Chromium's synthetic microphone device. It exercises the real MediaRecorder → upload → ffmpeg → SQLite → casting → Web Audio path. That verifies browser-generated fixture input, not a physical phone microphone, human playtest or measured listening experience.

Domain/API tests cover authorization, pairing expiry, storage bounds, revision conflicts, recording/playback exclusion, real media rejection/normalization, deletion cascades and restart persistence. Browser screenshots and the outcome JSON are written to `.impeccable/review/` and are ignored by git.

The 3D check writes `3d-*` captures and `3d-results.json`: deterministic seek/pause checks, offscreen and simulated hidden-tab disposal, context loss, blocked WebGL2, reduced motion and a short renderer/CPU-submission sample. These are desktop Chromium measurements, with software rendering available; CPU submission is not measured GPU time or a Fire TV frame-rate guarantee. The final local SwiftShader software sample remained slow: 118 ms median frame interval (150.1 ms p95), despite reducing draw calls from 241 to 56. Hardware-accelerated browser and Fire TV performance remain unverified. The separate compressed scene chunk is approximately 141 KB and is not requested by the phone microphone route.

## Fire TV wrapper

Open `/tv` for the remote-oriented start screen, saved-studio resume and Pair → Cast → Premiere navigation. TV mode starts with the lightweight 2D picture; the explicit 3D choice is persistent and shares the same soundtrack. Back cancels the current action before leaving. Run `npm run test:tv` after building for the isolated TV-keyboard and full phone-recording regression. See [TV-DELIVERY.md](TV-DELIVERY.md) for the demo sequence, observed friction, current official-simulator route and exact evidence boundaries.

`android/` contains an Android/Fire OS WebView launcher with landscape orientation, no touchscreen requirement, same-host HTTPS navigation, remote back behavior and no microphone permission. It serves the TV screen; paired phones provide the microphone.

The launcher opens `/tv`, provides a native Retry screen after a main-frame connection error, delegates Back to the app's current playback/confirmation state, and requests audio suspension when the Activity pauses. The wrapper was compiled and exercised on Google’s Android TV API 34 emulator on 28 September 2026. Physical Fire OS behavior remains unverified.

Requirements: Android SDK 35, JDK 17 and Gradle 8.11.1 compatible with Android Gradle Plugin 8.9.2. The Gradle wrapper is included with a pinned distribution checksum. Release signing is not configured. See `android/BUILDING.md` for the verified local tool inventory and setup. Then:

```sh
cd android
./gradlew assembleDebug -PfoleyUrl=https://foley.13.204.212.172.sslip.io
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

`foleyUrl` must be an actual HTTPS deployment. The earlier Android TV emulator run completed the remote-to-premiere workflow with synthetic audio against a temporary CI origin. The [public-origin judge APK run](https://github.com/himanshu748/foley/actions/runs/36752896970) passed with its installed checksum verified and its generated 260 Hz tone present in the native WebM recording. Download the exact tested APK from the [judging release](https://github.com/himanshu748/foley/releases/tag/judge-2026-09-30). Physical-device audio quality and phone microphone capture remain unverified. The required original banner/icon are included; release signing and physical-device validation remain. A desktop browser preview is separate from the native emulator evidence. Vega is a separate native target and is not implemented by this wrapper.

## Remaining external validation

- Validate Activity suspend/resume on physical targets. The current native run covers D-pad, in-app Back/resume and captured synthetic-audio playback on Google Android TV API 34.
- Test physical mobile microphone/codec and TV combinations as additional quality checks. The accepted Android TV emulator path does not require physical hardware.
- Playtest with a real small group. Time-to-first-premiere and willingness to remix remain unmeasured.

Lightsail hosts the backend; Foley does not use an AWS SDK, Bedrock, Polly or AI inference. The deployed revision's `/api/health` response includes a hardcoded legacy `aws: false` field. That field does not detect the hosting provider; the actual hosting integration is documented in [deploy/README.md](deploy/README.md).

## Primary references

- [MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder) and [scheduled AudioBuffer playback](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/start).
- [Fire TV controller behavior](https://developer.amazon.com/docs/fire-tv/controller-behavior-guidelines.html).
- [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html) and [GPU resource disposal](https://threejs.org/manual/en/how-to-dispose-of-objects.html).
- [Amazon hackathon rules](https://amazonappdev2026.devpost.com/rules).
