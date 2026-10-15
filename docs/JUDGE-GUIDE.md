> 15 October correction: Google Android TV emulator footage is historical engineering evidence and does not satisfy the requested Fire TV judging gate. Use the [physical Fire TV capture guide](FIRE-TV-CAPTURE.md). Vega is not implemented; physical Fire TV verification remains pending.

# Try Foley

Foley gives a living-room group a shared creative task: make the soundtrack for the same twenty-second picture, then change its mood by recasting a sound. The TV directs the room; paired phones contribute takes.

1. Open the [hosted TV screen](https://foley.13.204.212.172.sslip.io/tv), or sideload the [11 October tested Android TV APK](https://github.com/himanshu748/foley/releases/tag/judge-2026-10-11-polish). Select **Start a studio**.
2. Open the same HTTPS origin on a phone. Enter the pairing code and a contributor name. Enable the microphone explicitly, or upload a short audio file you may use.
3. Record three different sounds, such as taps, paper rustling and a squeak. Preview each before sending it. Cast takes as Footsteps, Weather and Creature.
4. Select **Premiere** and play the complete movie. Credits use the actual contributors. Open **Compare cuts** and save the complete soundtrack as A.
5. Change only Creature, save B, then play A and B. The cards identify the changed role and level; each replay keeps the current edit intact. Replacing an existing slot requires confirmation.
6. End the studio when finished; this removes its active recordings and access.

The [current 138-second public video](https://www.youtube.com/watch?v=8bk0C7nP4Wk) shows the 11 October Google Android TV API 34 build against the public HTTPS server. It includes both complete saved A and B premieres, with only Creature changed in B and captured native emulator output audio. The original test inputs are labeled synthetic; the contributor-browser segment is labeled as edited actual app states. Deepgram narration and timed English captions explain the flow. This Google emulator run does not satisfy the requested Fire TV judging gate.

The deployed application is [`2f180109c103f32fb5f47ac8e2bddc597bb32be8`](https://github.com/himanshu748/foley/commit/2f180109c103f32fb5f47ac8e2bddc597bb32be8). The [11 October browser/native CI run](https://github.com/himanshu748/foley/actions/runs/38103195945) and [public-origin Judge APK run](https://github.com/himanshu748/foley/actions/runs/38103332355) passed on that source. The latter installed the exported APK, verified its checksum, played all four premieres, replayed saved A and B without changing the active B edit, and detected the generated diagnostic tone in recorded native output audio. The deployed browser bundle matched the reviewed source and passed 14 hosted acceptance checks; see [deployment evidence](../deploy/README.md).

Download the exact [11 October judging prerelease](https://github.com/himanshu748/foley/releases/tag/judge-2026-10-11-polish). APK SHA-256: `4bffdc992224101195e69a5733252c9876559c484173b45ef3bd08908627511b`. Its build metadata, checksum and audio-verification receipt bind the tested artifact to the source and public origin. The APK is debug-signed for sideloading; uninstall a differently signed earlier test build before installation, then pair again.

On 11 October, the user reported successful microphone recording and playback in Android Chrome through the live join flow. That physical-phone result was not independently captured or latency-measured, and no device model was supplied. Physical Fire TV behavior and group playtesting remain unverified.

Historical evidence: the [9 October v1.1 release](https://github.com/himanshu748/foley/releases/tag/judge-2026-10-09-v1-1) and [public-origin run](https://github.com/himanshu748/foley/actions/runs/37896967098) established saved A/B replay on earlier application source `68b235a`, using synthetic inputs. The earlier [89-second video](https://www.youtube.com/watch?v=G_K0CaCEpnk) predates the public saved-cut demo. The [30 September release](https://github.com/himanshu748/foley/releases/tag/judge-2026-09-30) is also retained for its own historical receipt. Use the 11 October release above for the current judging APK.

Lightsail supplies the persistent HTTPS backend. The Foley app uses no generative AI or AWS model API; Deepgram narration belongs to the demo video. See [Android runtime evidence](../android/BUILDING.md), [saved-cut behavior](SAVED-CUTS.md) and [observed integration friction](FRICTION-LOG.md).
