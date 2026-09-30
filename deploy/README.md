# Single-server HTTPS deployment

The public deployment is [https://foley.13.204.212.172.sslip.io](https://foley.13.204.212.172.sslip.io), with the TV route at [/tv](https://foley.13.204.212.172.sslip.io/tv). Amazon Lightsail hosts the Node.js service, ffmpeg processing and persistent SQLite storage. Docker Compose runs one app container behind Caddy. Caddy serves publicly trusted HTTPS; only ports 80 and 443 are exposed for application traffic. SSH is restricted to the administrator's IPv4 address. The app port is not published. Caddy replaces client-supplied forwarding headers; `TRUST_PROXY=1` must not be used if users can reach the app directly.

[Public 1:59 demo](https://www.youtube.com/watch?v=F-AeLUo3wQ4): Google Android TV API 34, labeled synthetic input, captured emulator audio, and English Deepgram narration/captions.

## Verified deployment (30 September 2026)

The host runs the independently reviewed application revision [`af1cf81318a33b713656e0e655b978f359762b6e`](https://github.com/himanshu748/foley/commit/af1cf81318a33b713656e0e655b978f359762b6e). Later native-CI changes are separate from this deployed application revision.

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

The public origin and exact installed APK passed [Judge APK run 36752896970](https://github.com/himanshu748/foley/actions/runs/36752896970). Its native WebM recording contains the generated 260 Hz fixture played by the app. The [judging release](https://github.com/himanshu748/foley/releases/tag/judge-2026-09-30) provides the tested APK, sanitized build metadata and checksum without requiring GitHub Actions authentication. For a rebuild, run the **Judge APK** workflow on the intended source revision and supply `https://foley.13.204.212.172.sslip.io` as the origin. The artifact contains `foley-tv.apk` plus the source commit, origin and SHA-256. It uses Android's debug signing key for sideloading, with system certificate trust and no CI certificate override. Each fresh runner generates a different debug key; uninstall any earlier Foley APK before installing a rebuilt one. This removes the TV's local pairing cookie, so start or pair a studio again afterward. Keep future release assets bound to their own tested source revision and checksum.

Install the resulting artifact on an Android TV emulator or Fire TV, then verify remote navigation, pairing, casting, premiere, credits and the actual captured output audio. A successful APK build alone is not runtime proof. Label API fixtures or uploaded test audio explicitly. Physical-phone microphone capture is an optional additional quality check, not a requirement of the accepted emulator route. The earlier emulator test used synthetic audio and a temporary runner origin; it does not establish this hosted build.

The 118.5-second demo retains the full premiere and its actual emulator output audio, without narration or added music during playback. The API crew uploads one generated tone used for all three roles; a separate contributor-browser sequence is labeled as another edited run. The browser test studio was deleted; native test studios expire after six hours. Physical Fire TV and phone microphone behavior remain unverified. See the [friction log](../docs/FRICTION-LOG.md) for the observed focus, recorder and bootstrap issues.

## Operating the server

Check `docker compose ps` and bounded logs with `docker compose logs --tail=100`. The Node and Caddy image tags can change; record their resolved image digests with each deployment and revalidate after pulling new images. HTTP/3 is not exposed; clients use HTTPS over TCP. Back up the SQLite database using its online backup API or stop the app before copying the database; do not copy only the main database file during writes. Keep backups private. Budget alerts are notifications, not a spending cap. Delete paid hosting only after judging is finished and necessary evidence is preserved.

References: [Lightsail pricing](https://aws.amazon.com/lightsail/pricing/), [Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [Express proxy trust](https://expressjs.com/en/guide/behind-proxies/).
