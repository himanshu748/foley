# Foley: TV delivery and demo evidence

Updated 28 September 2026. This is a working delivery record, not a submitted entry or a claim of Fire TV compatibility.

## What the TV controls now do

Open `/tv` for the shared director surface. Start receives initial remote focus. Pair crew, Cast sounds and Premiere provide explicit stage jumps; their counts come from the current studio. Arrow keys move spatially, and Enter selects. Back first stops a premiere or preparation, cancels a pending studio-deletion confirmation, exits fullscreen, then returns to the TV start screen. Media Play/Pause uses the same playback action as the visible controls.

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

Final local run on 12 September: all 10 TV checks and the complete phone workflow passed with zero page JavaScript errors. The TV/phone screenshots were inspected at 1280×720 and 390px, with no horizontal overflow. All 19 domain/API tests and the TypeScript/production build passed; the Impeccable detector returned no findings. The runtime-audit refresh did not complete, so this update makes no fresh advisory-count claim. Dependencies were unchanged. All browser test resources closed on completion.

## Native and official simulator gate

The current native target is Android/Fire OS, documented in `android/BUILDING.md`. An APK was built and tested on Google’s Android TV API 34 emulator in GitHub Actions. The local SDK inventory remains incomplete; CI supplies the build tools and emulator.

A separate Vega target could reuse the web experience through Vega's WebView. Amazon's current comparison lists WebView support on Mac M-series virtual devices, while explicitly excluding simulator performance testing. The existing Android Activity is not a Vega `.vpkg`. [Amazon's runtime comparison](https://developer.amazon.com/docs/vega/0.24/run-apps-overview)

The documented Vega setup requires 20 GB available, native development utilities and a full SDK/virtual-device installation. Its standard installer also updates shell configuration. No Vega CLI or SDK was found in the checked local locations on 12 September, and no installer or license-acceptance command was executed. This is not currently a small, ready-to-run project-local dependency. [Vega installation guide](https://developer.amazon.com/docs/vega/0.24/install-vega-sdk)

Once a Vega app exists and the SDK is installed, the official flow uses `vega virtual-device start` and `vega run-app <package> <app-id> -d VirtualDevice`. Virtual-device account registration is optional unless testing Amazon services. Foley does not currently call those services. These are documented future steps, not commands verified for a Foley package. [Run an app on Vega Virtual Device](https://developer.amazon.com/docs/vega/0.24/run-apps)

## Proposed 2 minute 45 second demonstration

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

Do not call pre-recorded takes live capture. Do not call the current desktop browser a Fire TV simulator. The final video, public repository URL and licensed public source still require their own verified delivery receipts.

## Observed friction and product feedback

These are observations from development, not invented customer testimonials or device bugs. They have not been submitted for a hackathon bonus.

| Observation | Change or consequence | Evidence boundary |
| --- | --- | --- |
| Resume initially sat beside Start, so pressing Down missed it | Resume now occupies its own row; the keyboard regression checks Start → Down → Resume | Reproduced in desktop Chromium at TV size |
| Jumping to the transport could leave the actual film above the screen | Premiere brings the picture into view and focuses its playback action | Browser layout and navigation correction |
| Earlier SwiftShader run measured 118 ms median frame intervals despite batching to 56 draws | TV starts in 2D; 3D is optional and can be released immediately | Software-renderer measurement from 8 September, not TV performance |
| Android tooling exists but platform/build-tool packages do not | Native compilation remains an explicit gate; wrapper setup lists exact missing pieces | Local development-environment inventory |
| Amazon's remote guidance distinguishes Back, system Home and media controls | Implemented state-aware Back and suspend hooks without intercepting Home/Search/Volume | Documentation-informed implementation; native behavior unverified |

Specific feedback for the platform documentation: the remote behavior matrix made it possible to distinguish cancellation from leaving the app, and the Vega runtime comparison clearly identifies which WebView/simulator combinations are supported. A complete sample combining same-origin WebView navigation, remote Back, Web Audio suspension and a phone-paired experience would reduce integration uncertainty. That is a documentation-based request, not a report of an observed Fire OS defect. [Fire TV controller behavior](https://developer.amazon.com/docs/fire-tv/controller-behavior-guidelines.html)

Human playtesting, time-to-first-premiere, recognizable mix quality and willingness to remix remain unmeasured. AWS remains deferred.

## Verified Android TV run — 28 September

[Run 36393598341](https://github.com/himanshu748/foley/actions/runs/36393598341) passed on source commit `c9f7bff`. The instrumented test covers launch, remote selection, pairing, D-pad movement, Back and studio resume, synthetic WAV upload through the real normalization API, casting all three roles, full 20-second playback, credits and the server premiere count. The test also verifies that the film remains inside the viewport during playback and credits.

A prior run exposed a focus bug: disabling the Premiere button moved focus to navigation and scrolled the picture offscreen. Playback now transfers focus to the picture before preparation and to Stop after preparation. The successful native screenshots were inspected. The saved H.264 recording is 1920×1080 and 71.814 seconds, without an audio track. Input audio is a generated test fixture, not a phone recording.

The public MIT source is https://github.com/himanshu748/foley. The CI APK targets an ephemeral runner-only HTTPS server and is not a judge-ready deployment. Remaining release work: stable HTTPS hosting, a release-target APK, physical phone recording/audio verification, a public demo under three minutes and Devpost submission.
