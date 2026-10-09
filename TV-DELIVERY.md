# Foley: TV delivery and demo evidence

Updated 9 October 2026. Application [`68b235a`](https://github.com/himanshu748/foley/commit/68b235ab5dade3dfb67ad36ae5866f24a7c72cac) is deployed on [Amazon Lightsail](https://foley.13.204.212.172.sslip.io/tv). [Browser/native CI](https://github.com/himanshu748/foley/actions/runs/37896025801) and [public-origin Judge APK run 37896967098](https://github.com/himanshu748/foley/actions/runs/37896967098) passed. The exact tested APK is in the [9 October v1.1 judging prerelease](https://github.com/himanshu748/foley/releases/tag/judge-2026-10-09-v1-1). The native run covers four full premieres, saved A/B replay and unchanged current B editing state, with output audio captured from the emulator. Google Android TV API 34 evidence does not establish physical Fire TV performance or physical phone capture.

[Current 89-second public demo](https://www.youtube.com/watch?v=G_K0CaCEpnk): labeled original synthetic sounds, captured emulator audio and English Deepgram narration/captions. It predates saved A/B slots; no replacement public video is claimed here.

## What the TV controls now do

Open `/tv` for the shared director surface. Start receives initial remote focus. Pair crew, Cast sounds, Premiere and Compare cuts provide explicit stage jumps; their counts come from the current studio. Arrow keys move spatially, and Enter selects. Back first stops a premiere or preparation, cancels a pending cut or studio-deletion confirmation, exits fullscreen, then returns to the TV start screen. Media Play/Pause targets the focused saved cut; it does not start playback through an open confirmation. Save, Replace and Delete retain focus within their cut card.

The start screen can resume the most recently saved, unexpired studio. Browser storage holds its ID, title and expiry only; the server must still authorize the host cookie before Resume appears. Ending the studio clears the shortcut. This does not add recovery for a lost cookie.

TV mode defaults to **2D · light**, avoiding the Three.js download and GPU scene setup. **3D · cinema** remains an explicit, persistent choice. Switching picture styles keeps the same soundtrack clock and cast; choosing 2D disposes the Three.js scene. This choice responds to the previously measured slow software-rendering result, rather than claiming that 3D is fast on an untested TV.

The Android wrapper opens `/tv`, restricts navigation to its configured HTTPS origin, shows a native focused Retry action after a main-frame connection failure, delegates Back through the app's current state, and requests playback suspension when the Activity pauses. The wrapper now has compiled Android TV emulator evidence; Activity lifecycle suspension and physical Fire OS behavior still need verification.

## Reproduce the local checks

Prerequisites are Node 22.13+, installed project dependencies, ffmpeg/ffprobe and Playwright Chromium. First build the production frontend:

```sh
npm run build
npm run test:tv
```

`test:tv` owns an ephemeral loopback server with an in-memory SQLite database. It closes its server and browsers after the run. It checks the 1280×720 keyboard journey and a 390px phone layout, then runs the existing complete MediaRecorder-to-premiere regression against that same isolated backend. This compatibility run disables WebGL, verifies the honest fallback after an explicit 3D choice, and exercises real 2D playback. It does not repeat the earlier GPU measurements. Its upload fixture is an explicitly generated WAV; the existing phone regression uses Chromium's synthetic microphone. Neither input is a human recording or a physical phone test.

Results and captures go to `.impeccable/review/tv-*`; the existing phone regression writes its usual `browser-*` evidence. The result JSON is the source for pass/fail status. A partially executed test or a screenshot alone is not a complete pass.

Historical local run on 12 September: all 10 TV checks and the complete phone workflow passed with zero page JavaScript errors. The TV/phone screenshots were inspected at 1280×720 and 390px, with no horizontal overflow. All 19 domain/API tests and the TypeScript/production build passed; the Impeccable detector returned no findings. The runtime-audit refresh did not complete, so this update makes no fresh advisory-count claim. Dependencies were unchanged. All browser test resources closed on completion.

## Native and official simulator gate

The current native target is Android/Fire OS, documented in `android/BUILDING.md`. An APK was built and tested on Google’s Android TV API 34 emulator in GitHub Actions. The local SDK inventory remains incomplete; CI supplies the build tools and emulator.

A separate Vega target could reuse the web experience through Vega's WebView. Amazon's current comparison lists WebView support on Mac M-series virtual devices, while explicitly excluding simulator performance testing. The existing Android Activity is not a Vega `.vpkg`. [Amazon's runtime comparison](https://developer.amazon.com/docs/vega/0.24/run-apps-overview)

The documented Vega setup requires 20 GB available, native development utilities and a full SDK/virtual-device installation. Its standard installer also updates shell configuration. No Vega CLI or SDK was found in the checked local locations on 12 September, and no installer or license-acceptance command was executed. This is not currently a small, ready-to-run project-local dependency. [Vega installation guide](https://developer.amazon.com/docs/vega/0.24/install-vega-sdk)

Once a Vega app exists and the SDK is installed, the official flow uses `vega virtual-device start` and `vega run-app <package> <app-id> -d VirtualDevice`. Virtual-device account registration is optional unless testing Amazon services. Foley does not currently call those services. These are documented future steps, not commands verified for a Foley package. [Run an app on Vega Virtual Device](https://developer.amazon.com/docs/vega/0.24/run-apps)

## Future group walkthrough (proposed 2 minutes 45 seconds)

Capture the app on an actual Fire TV device or the FAQ-accepted Android TV emulator. Keep the TV/runtime identification visible at the beginning. Show the phone separately when it records.

| Time | Show | What it establishes |
| --- | --- | --- |
| 0:00–0:15 | Launch Foley with the remote, start an empty studio | A shared TV experience with a clear first action |
| 0:15–0:40 | Pair a phone using the code; record a fresh object sound | A participant contributes their own performance |
| 0:40–1:05 | Audition and cast three brief takes into footsteps, weather and creature | The group's choices determine the soundtrack |
| 1:05–1:30 | Run the complete 20-second premiere, then show contribution credits | Real synchronization and attribution |
| 1:30–2:00 | Swap the creature sound with a different take; replay the changed moment | Why the room wants another cut |
| 2:00–2:20 | Demonstrate remote Back, Resume and explicit picture quality | Practical TV behavior beyond a staged happy path |
| 2:20–2:45 | State the implemented architecture, original assets, measured limits and next playtest | An accurate scope and feedback summary |

The current submission video follows the native API-fixture test, with a separately labeled browser sequence. The group walkthrough above remains a future plan. Do not call pre-recorded takes live capture. Do not call the current desktop browser a Fire TV simulator. The public MIT repository and exact tested judging APK are available. The video follows the narrower observed test rather than the proposed group walkthrough.

## Observed friction and product feedback

These are observations from development, not invented customer testimonials or device bugs. The detailed [friction log](docs/FRICTION-LOG.md) is included with the submission materials.

| Observation | Change or consequence | Evidence boundary |
| --- | --- | --- |
| Resume initially sat beside Start, so pressing Down missed it | Resume now occupies its own row; the keyboard regression checks Start → Down → Resume | Reproduced in desktop Chromium at TV size |
| Jumping to the transport could leave the actual film above the screen | Premiere brings the picture into view and focuses its playback action | Browser layout and navigation correction |
| Earlier SwiftShader run measured 118 ms median frame intervals despite batching to 56 draws | TV starts in 2D; 3D is optional and can be released immediately | Software-renderer measurement from 8 September, not TV performance |
| Android tooling exists but platform/build-tool packages do not | CI supplies the missing local packages and builds the tested judging APK | Local development-environment inventory |
| Amazon's remote guidance distinguishes Back, system Home and media controls | Implemented state-aware Back and suspend hooks without intercepting Home/Search/Volume | D-pad and in-app Back/resume verified on Android TV; physical Fire OS and Activity suspension remain unverified |

Specific feedback for the platform documentation: the remote behavior matrix made it possible to distinguish cancellation from leaving the app, and the Vega runtime comparison clearly identifies which WebView/simulator combinations are supported. A complete sample combining same-origin WebView navigation, remote Back, Web Audio suspension and a phone-paired experience would reduce integration uncertainty. That is a documentation-based request, not a report of an observed Fire OS defect. [Fire TV controller behavior](https://developer.amazon.com/docs/fire-tv/controller-behavior-guidelines.html)

Human playtesting, time-to-first-premiere, recognizable mix quality and willingness to remix remain unmeasured. [AWS Lightsail hosting and public HTTPS have passed deployment checks](deploy/README.md).

## Historical Android TV run — 28 September

[Run 36393598341](https://github.com/himanshu748/foley/actions/runs/36393598341) passed on source commit `c9f7bff`. The instrumented test covers launch, remote selection, pairing, D-pad movement, Back and studio resume, synthetic WAV upload through the real normalization API, casting all three roles, full 20-second playback, credits and the server premiere count. The test also verifies that the film remains inside the viewport during playback and credits.

A prior run exposed a focus bug: disabling the Premiere button moved focus to navigation and scrolled the picture offscreen. Playback now transfers focus to the picture before preparation and to Stop after preparation. The successful native screenshots were inspected. The saved H.264 recording is 1920×1080 and 71.814 seconds, without an audio track. Input audio is a generated test fixture, not a phone recording.

The public MIT source is https://github.com/himanshu748/foley. That earlier CI APK targets an ephemeral runner-only HTTPS server. The later public Lightsail deployment has passed HTTPS, pairing, private audio, casting, persistence and deletion checks. The later [public-origin run](https://github.com/himanshu748/foley/actions/runs/36752896970) passed its native output-audio gate and is the source of the [judging APK release](https://github.com/himanshu748/foley/releases/tag/judge-2026-09-30). Physical phone recording and group playtesting remain additional quality checks; the [event FAQ](https://amazonappdev2026.devpost.com/details/faqs) permits an Android TV emulator submission.


## Verified v1.1 native run — 9 October

The instrumentation retains the original first 260 Hz tone premiere and second distinct-sound premiere. It then saves that distinct soundtrack as A, changes only Creature to the existing tone, saves B, and uses the native media key on A. It then replays B, checks both saved credits, the fourth receipt and unchanged current B cast/revision. Screenshots 09–13 cover cards, saved replay and credits. The ordinary CI capture budget is 180 seconds; that workflow uses `-noaudio` and establishes no new output-audio evidence. The separate public-origin judge workflow retains its captured-audio gate and 180-second recording limit. The full sequence passed [public-origin run 37896967098](https://github.com/himanshu748/foley/actions/runs/37896967098) against deployed application `68b235ab5dade3dfb67ad36ae5866f24a7c72cac`. Its 144.36-second native WebM audio stream passed generated-tone detection. This verifies captured synthetic emulator output, not physical speakers or a phone microphone. The separate [branch browser/native run](https://github.com/himanshu748/foley/actions/runs/37896025801) also passed; its `-noaudio` configuration supplies no output-audio proof.
