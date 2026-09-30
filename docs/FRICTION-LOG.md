# Foley integration friction log

Observed while building and testing Foley during September 2026. These entries identify app, tooling and configuration problems encountered in this project. They are not claims of a Fire OS or AWS platform defect. Native checks used Google's Android TV API 34 emulator, and test audio was synthetic unless explicitly stated otherwise.

## 1. Premiere focus moved the film out of view

**Task:** Start the film using D-pad controls in the Android TV wrapper.

**Steps:** Opened the native app, started a studio, prepared a synthetic cast, navigated to Premiere with the D-pad, and selected the playback action.

**Expected:** The movie would remain visible while playback prepared and ran.

**Actual:** Disabling Premiere moved focus to navigation and scrolled the picture out of the viewport. The first native check exposed a gap in the earlier browser tests.

**Severity:** Critical for watching the movie on the TV interface.

**Workaround:** Move focus to the picture before preparation, then to Stop when preparation finishes. The passing native test checks that the picture stays in the viewport during playback and credits.

**Suggestion:** Add a TV WebView example showing how to retain a visible playback surface while the focused action changes or becomes disabled. Test focus and viewport position together.

## 2. Recorder cleanup obscured the original permission error

**Task:** Recover when microphone permission is denied and the recording lease also fails to release.

**Steps:** Used a controlled browser test to deny permission and return an error from the cleanup request, then tried to record again.

**Expected:** The contributor would see the microphone-permission problem and could retry without losing the original explanation.

**Actual:** The cleanup failure replaced the permission-denied message. Further tests covered interrupted recordings and a permission grant arriving after the contributor left the screen.

**Severity:** Important. It made a failed recording harder to understand and recover from.

**Workaround:** Preserve the initiating error, release the active lease without replacing that message, discard partial/empty takes, and stop late microphone streams. The browser regressions and lifecycle tests pass after the fixes.

**Suggestion:** In MediaRecorder examples, include permission denial, cleanup failure, asynchronous recorder errors, page suspension and delayed permission grants as separate cases. The tests here use controlled or synthetic browser input; they do not establish physical-phone behavior.

## 3. Local software rendering was too slow for the default TV picture

**Task:** Keep the optional Three.js movie usable across limited graphics environments.

**Steps:** Ran the scene in local Chromium with SwiftShader software rendering, reduced the scene's draw calls, and measured frame intervals again.

**Expected:** Scene batching would make the default picture practical in that environment.

**Actual:** The measured software-renderer sample remained slow, with a median frame interval of 118 ms despite reducing draw calls from 241 to 56. This is a local software result, not a hardware Fire TV benchmark.

**Severity:** Important for choosing a reliable default.

**Workaround:** Start TV mode in the lighter 2D picture. Keep 3D as an explicit choice, dispose its resources when it is not visible, and retain the same soundtrack clock in both modes.

**Suggestion:** Provide a TV WebView performance example that separates CPU submission, software rendering and hardware frame rate, and shows an explicit lower-cost picture mode. Simulator performance should not be presented as a hardware guarantee.

## 4. The Lightsail bootstrap assumed a different shell

**Task:** Start the reviewed Docker/Caddy deployment on the Lightsail instance.

**Steps:** Created the Linux instance and supplied a bootstrap containing Bash's `pipefail` option through user-data.

**Expected:** The bootstrap would install the runtime and start the service.

**Actual:** User-data executed under `/bin/sh`, which rejected `pipefail` and stopped setup. This was a portability mistake in my bootstrap.

**Severity:** Important. It blocked the first deployment attempt.

**Workaround:** Run the prepared bootstrap explicitly with Bash over SSH on the same instance. The resulting public HTTPS deployment passed pairing, audio processing, casting, persistence and deletion checks.

**Suggestion:** Make the shell requirement explicit in bootstrap entrypoints and validate the script under the shell that will execute it. A short Lightsail example showing interpreter selection and where to inspect user-data failures would help catch this error earlier.

## 5. The headless emulator supplied pictures but no output audio

**Task:** Record the exact public-origin APK's twenty-second premiere with its actual emulator audio.

**Steps:** Started Google's Android TV API 34 image with `-no-window`, installed the exported APK, and recorded the native emulator console WebM. The test supplied a generated 260 Hz tone, cast it, and completed the premiere and credits.

**Expected:** The captured audio would contain the test tone played by the app.

**Actual:** Native controls and server assertions passed, but the captured stream was nearly silent. The emulator reported that its PulseAudio driver could not initialize. Checking the official source showed that `-no-window` selects the headless executable, whose PulseAudio functions are stubs. Changing the server endpoint did not resolve this; an ALSA attempt also reported an unsupported driver in this SDK build. The normal engine initialized PulseAudio and produced the test tone, but its recorded level was too quiet for the verification threshold. The test's media-session command had requested index 15, but a readback remained at 3 in the reported range 0..15. Android's log showed AppOps rejecting the command's `com.android.server.media` identity under shell UID 2000. The follow-up uses actual Volume Up key events, then verifies the music-volume level before recording.

**Severity:** Important for demonstrating a sound-making product. A video stream and a successful playback assertion do not establish audio output.

**Workaround:** Run the normal emulator engine on a virtual X display, connect PulseAudio to a null sink, query and verify the native media-volume maximum, and retain a gate that detects the fixture tone in the console recorder's actual WebM audio. [Run 36752896970](https://github.com/himanshu748/foley/actions/runs/36752896970) passed the exact installed-APK test and detected the fixture in actual native WebM audio. The level readback changed from 3 to 15 in the reported 0..15 range. No fixture WAV was substituted into the captured output.

**Suggestion:** The console-recording documentation could distinguish the normal and headless Linux engines and explain whether each supplies output audio. Capture validation should inspect the resulting audio, rather than only check that an audio track exists.

Official source: [launcher selection](https://android.googlesource.com/platform/external/qemu/+/emu-master-dev/android/emulator/main-emulator.cpp), [headless PulseAudio implementation](https://android.googlesource.com/platform/external/qemu/+/refs/heads/emu-master-dev/audio/paaudio-headless-impl.c).

## Reproduction and source

Source and local checks: https://github.com/himanshu748/foley

Native test and evidence: https://github.com/himanshu748/foley/blob/main/TV-DELIVERY.md

Deployment configuration: https://github.com/himanshu748/foley/tree/main/deploy

This log contains no credentials, participant recordings, private session links or AWS account identifiers. Public deployment verification does not establish a physical-phone recording or audible hardware playback.
