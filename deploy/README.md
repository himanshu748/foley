# Single-server HTTPS deployment

This is prepared configuration, not proof of a deployed service. Foley needs Node 22, ffmpeg and a persistent local SQLite file. The Compose configuration runs one app container behind Caddy, which obtains and renews HTTPS certificates. Only ports 80 and 443 are published. Caddy replaces client-supplied forwarding headers; `TRUST_PROXY=1` must not be used if users can reach the app directly.

## Host setup

Use a Linux server with Docker Engine and the Compose plugin, at least 2 GB memory and a public IPv4 address. Point a DNS A record at that address. Permit inbound TCP 80/443, and restrict SSH to the administrator's IP. Leave IPv6 disabled and do not add an AAAA record: the current limiter does not aggregate IPv6 address prefixes. Compose publishes IPv4 TCP ports only. Do not expose TCP 4331. Do not place another CDN/proxy before Caddy without revisiting client-IP trust.

An Amazon Lightsail `small_3_1` instance in Mumbai supplies 2 GB RAM, 60 GB disk and 1,536 GB monthly transfer for $12/month as checked on 28 September 2026. Taxes and transfer overages are additional. No free-tier credit is assumed. Keep an attached static IP and retain the service through judging, currently ending 20 November. Resource creation needs the account owner's cost approval; this repository creates no AWS resources automatically.

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
A passing run still requires separate public-host and physical-phone checks.

Recorder error and retry regressions run locally with `npm run build` followed by
`npm run test:recorder` (requires Playwright Chromium). They use a generated test
microphone to exercise permission denial, a failed cleanup request, recorder
interruption, upload retry and a permission grant that arrives after suspension.
They do not establish physical-phone microphone capture or audible playback.

After HTTPS is verified, run the **Judge APK** GitHub Actions workflow on the reviewed source revision and supply that same origin. The artifact contains `foley-tv.apk` plus the source commit, origin and SHA-256. It uses Android's debug signing key for sideloading, with system certificate trust and no CI certificate override. Each fresh runner generates a different debug key; uninstall any earlier Foley APK before installing a rebuilt one. This removes the TV's local pairing cookie, so start or pair a studio again afterward. Publish this artifact as a release asset for access without GitHub Actions authentication.

Install on an Android TV emulator or Fire TV, then verify remote navigation, pairing, actual phone microphone capture, casting all three roles, audible premiere and credits. A successful APK build alone is not runtime proof. The existing emulator test uses synthetic audio and a temporary runner origin; it does not establish phone recording or this hosted build.

For the final demo, record the TV and paired phone flow in under three minutes. Use a non-sensitive sound, delete the studio afterward, and retain the exact source/APK hashes alongside the video. Do not claim AWS deployment or physical Fire TV use before those actions actually succeed.

## Operating the server

Check `docker compose ps` and bounded logs with `docker compose logs --tail=100`. The Node and Caddy image tags can change; record their resolved image digests with each deployment and revalidate after pulling new images. HTTP/3 is not exposed; clients use HTTPS over TCP. Back up the SQLite database using its online backup API or stop the app before copying the database; do not copy only the main database file during writes. Keep backups private. Budget alerts are notifications, not a spending cap. Delete paid hosting only after judging is finished and necessary evidence is preserved.

References: [Lightsail pricing](https://aws.amazon.com/lightsail/pricing/), [Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [Express proxy trust](https://expressjs.com/en/guide/behind-proxies/).
