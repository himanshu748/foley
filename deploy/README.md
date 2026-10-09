# Single-server HTTPS deployment

The public deployment is [https://foley.13.204.212.172.sslip.io](https://foley.13.204.212.172.sslip.io), with the TV route at [/tv](https://foley.13.204.212.172.sslip.io/tv). Amazon Lightsail hosts the Node.js service, ffmpeg processing and persistent SQLite storage. Docker Compose runs one app container behind Caddy. Caddy serves publicly trusted HTTPS; only ports 80 and 443 are exposed for application traffic. SSH is restricted to the administrator's IPv4 address. The app port is not published. Caddy replaces client-supplied forwarding headers; `TRUST_PROXY=1` must not be used if users can reach the app directly.

[Current 89-second demo](https://www.youtube.com/watch?v=G_K0CaCEpnk): Google Android TV API 34, labeled synthetic input, captured emulator audio, and English Deepgram narration/captions.

## Verified v1.1 deployment (9 October 2026)

Application source: [`68b235ab5dade3dfb67ad36ae5866f24a7c72cac`](https://github.com/himanshu748/foley/commit/68b235ab5dade3dfb67ad36ae5866f24a7c72cac). Deployed app image: `sha256:b0e849d68120e4892075916978b3df9b35b9577ab8fc5634972817c64638de54`. The application is healthy, runs as user `node`, exposes no app port and retains the `foley_foley-data` volume. Caddy remains pinned to `sha256:6aeddd44c3078b0f9a35206472a11420648a79c184603ef95957d0a20044cb2b`.

The private online SQLite backup passed integrity checks. A restored copy migrated with its original rows intact, and the previous application image reopened that migrated copy. Public HTML, JavaScript and CSS matched the exact reviewed production build. All 14 hosted acceptance checks passed: normalized synthetic WAVs, host-only cut authority, immutable overwrite rejection, Creature take/level changes for B, exact saved A playback while preserving current B casts/revision, scoped late-stop protection, JSON DELETE through Caddy, and cleanup of both disposable acceptance studios.

[Browser/native CI](https://github.com/himanshu748/foley/actions/runs/37896025801) and the subsequent [public-origin Judge APK run](https://github.com/himanshu748/foley/actions/runs/37896967098) passed on the application commit above. The [v1.1 judging prerelease](https://github.com/himanshu748/foley/releases/tag/judge-2026-10-09-v1-1) binds the APK to its build metadata and checksum. Later documentation commits do not change this tested application identity. This verifies synthetic-input API and emulator behavior; the physical Android-phone microphone check, Fire TV hardware and group playtest remain pending.

## Historical hosted acceptance (4 October 2026)

The hosted source at that checkpoint was [`3c59fb9e6d6aeefe1268cf6c8f6c71a99bdd087b`](https://github.com/himanshu748/foley/commit/3c59fb9e6d6aeefe1268cf6c8f6c71a99bdd087b), with app image `sha256:a96eb4db3a3f2c8bdaf82d631470a9256b60059cf774b0773f5713624507c667`; host readback was rechecked on 9 October. HTTPS health, exact browser bundle, private/non-root container, persistent volume, pairing-code rotation with member/take preservation, anonymous rejection and disposable-studio cleanup passed. This receipt predates v1.1 saved cuts. Bind each subsequent deployment and APK to its own source, image digest, acceptance results and [versioned release metadata](https://github.com/himanshu748/foley/releases); source changes alone are not deployment evidence.

## Historical deployment receipt (30 September 2026)

At that checkpoint, the host ran the independently reviewed application revision [`af1cf81318a33b713656e0e655b978f359762b6e`](https://github.com/himanshu748/foley/commit/af1cf81318a33b713656e0e655b978f359762b6e). This historical source/image receipt is retained separately from the later hosted acceptance above.

The live acceptance checks passed:

- Public certificate trust, HTTP-to-HTTPS redirect, health, production HTML/bundle and security policy.
- A healthy non-root application container with a named data volume and no published app port.
- Scoped secure cookies, anonymous access rejection and cross-origin mutation rejection.
- Pairing, ffmpeg normalization, private audio retrieval and casting all three roles.
- Resistance to join-rate-limit bypass through forged forwarding headers.
- Authorization, studio, cast and identical normalized audio preserved after replacing the app container.
- Audio removal after ending the studio.

Input was a synthetic one-second WAV. These checks establish the public backend behavior, not physical-phone recording, audible hardware output or the final judge APK. The earlier [container acceptance run](https://github.com/himanshu748/foley/actions/runs/36594968131) used a local Caddy CA on a GitHub runner; it is separate from the public-certificate check.

Recorded deployment images:

```text
application: sha256:461f92bc1d6c239fd893d44858264d6573159f5f38ca91950b807d623c5fc1d3
caddy: sha256:6aeddd44c3078b0f9a35206472a11420648a79c184603ef95957d0a20044cb2b
```

This AWS integration is Lightsail hosting. No AWS SDK, Bedrock, Polly or AI inference is used. The application's `/api/health` response contains a hardcoded legacy `aws: false` value; it does not inspect infrastructure or indicate whether the process runs on Lightsail.

## Host setup

Use a Linux server with Docker Engine and the Compose plugin, at least 2 GB memory and a public IPv4 address. Point a DNS A record at that address. Permit inbound TCP 80/443, and restrict SSH to the administrator's IP. Leave IPv6 disabled and do not add an AAAA record: the current limiter does not aggregate IPv6 address prefixes. Compose publishes IPv4 TCP ports only. Do not expose TCP 4331. Do not place another CDN/proxy before Caddy without revisiting client-IP trust.

The current deployment uses one Amazon Lightsail `small_3_1` Linux instance in Mumbai with an attached static IPv4. The bundle supplies 2 GB RAM, 60 GB disk and 1,536 GB monthly transfer at $12/month. Taxes and transfer overages are additional; no free-tier credit is assumed. The demo hostname uses sslip.io, and no domain, load balancer, snapshot or backup add-on was purchased for this deployment. Keep the instance and attached IP available through judging, currently ending 20 November. These are the deployed resource choices; this repository does not create AWS resources automatically.

From a reviewed checkout on the host:

```sh
printf 'FOLEY_HOST=your-public-hostname.example\n' > .env
docker compose config --quiet
docker compose up -d --build --wait
curl --fail https://your-public-hostname.example/api/health
```

Replace the example hostname with the actual DNS hostname. Never put bearer tokens or session URLs in `.env`. Named volumes retain the database and TLS state across container restarts. `docker compose down` preserves them; do not use `down -v` unless intentionally deleting all studios and certificates. This single-server configuration is not a high-availability deployment.

## Judge APK and validation

Run Judge APK on v1.1 source only after its image is deployed and passes hosted acceptance. The shared instrumentation now requires saved-cut endpoints; an older public deployment cannot pass the comparison steps.

The manual **Container acceptance** workflow first checks the Docker image and
the existing Compose/Caddy configuration on a disposable GitHub runner. It uses
`localhost` and [Caddy's local CA](https://caddyserver.com/docs/automatic-https#local-https),
not a public certificate. Its checks cover HTTPS, the built browser bundle,
unpublished app ports, secure cookies, cross-origin rejection, forged forwarding
headers, ffmpeg normalization and preservation of the SQLite studio and audio
after replacing the app container. Only the summary JSON is uploaded; the
temporary database, cookies and CA keys are removed with the isolated volumes.
That CI result is separate from the completed public-host checks above. Physical-phone behavior remains a separate quality check.

Recorder error and retry regressions run locally with `npm run build` followed by
`npm run test:recorder` (requires Playwright Chromium). They use a generated test
microphone to exercise permission denial, a failed cleanup request, recorder
interruption, upload retry and a permission grant that arrives after suspension.
They do not establish physical-phone microphone capture or audible playback.

The v1.1 public origin and exact installed APK passed [Judge APK run 37896967098](https://github.com/himanshu748/foley/actions/runs/37896967098), including four premieres and saved A/B replay with the active B edit preserved. Its native WebM recording contains the generated 260 Hz fixture played by the app. The [v1.1 judging prerelease](https://github.com/himanshu748/foley/releases/tag/judge-2026-10-09-v1-1) provides the tested APK, sanitized build metadata and checksum without requiring GitHub Actions authentication. For a rebuild, run the **Judge APK** workflow on the intended source revision and supply `https://foley.13.204.212.172.sslip.io` as the origin. The artifact contains `foley-tv.apk` plus the source commit, origin and SHA-256. It uses Android's debug signing key for sideloading, with system certificate trust and no CI certificate override. Each fresh runner generates a different debug key; uninstall any earlier Foley APK before installing a rebuilt one. This removes the TV's local pairing cookie, so start or pair a studio again afterward. Keep future release assets bound to their own tested source revision and checksum.

Install the resulting artifact on an Android TV emulator or Fire TV, then verify remote navigation, pairing, casting, premiere, credits and the actual captured output audio. A successful APK build alone is not runtime proof. Label API fixtures or uploaded test audio explicitly. Physical-phone microphone capture is an optional additional quality check, not a requirement of the accepted emulator route. The earlier emulator test used synthetic audio and a temporary runner origin; it does not establish this hosted build.

The current 89-second demo retains the distinct-sound premiere and its actual emulator output audio. Its three sound fixtures are labeled original synthetic inputs; the separate contributor-browser scene is labeled as edited stills. It predates saved A/B slots. The earlier 118.5-second tone demo remains historical evidence rather than the current submission video. The browser test studio was deleted; native test studios expire after six hours. Physical Fire TV and phone microphone behavior remain unverified. See the [friction log](../docs/FRICTION-LOG.md) for the observed focus, recorder and bootstrap issues.

## Operating the server

Check `docker compose ps` and bounded logs with `docker compose logs --tail=100`. The Node and Caddy image tags can change; record their resolved image digests with each deployment and revalidate after pulling new images. HTTP/3 is not exposed; clients use HTTPS over TCP. Back up the SQLite database using its online backup API or stop the app before copying the database; do not copy only the main database file during writes. Keep backups private. Budget alerts are notifications, not a spending cap. Delete paid hosting only after judging is finished and necessary evidence is preserved.

References: [Lightsail pricing](https://aws.amazon.com/lightsail/pricing/), [Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [Express proxy trust](https://expressjs.com/en/guide/behind-proxies/).
