# Building the Fire OS launcher

This is a small Android WebView launcher for the TV surface. The backend is deployed at [https://foley.13.204.212.172.sslip.io](https://foley.13.204.212.172.sslip.io) on Amazon Lightsail, using reviewed application revision [`af1cf813`](https://github.com/himanshu748/foley/commit/af1cf81318a33b713656e0e655b978f359762b6e). The paired contributor browser supplies recordings or uploads; the launcher requests only internet access.

[Current 89-second demo](https://www.youtube.com/watch?v=G_K0CaCEpnk): Google Android TV API 34, three labeled original synthetic sounds, captured emulator audio and English Deepgram narration/captions. It combines the original remote-navigation recording with the additional 3 October run's full movie. The earlier [30 September tone demonstration](https://www.youtube.com/watch?v=F-AeLUo3wQ4) remains available as historical evidence for the released APK below.

## Verified judge build (30 September 2026)

Download the [judging APK release](https://github.com/himanshu748/foley/releases/tag/judge-2026-09-30). The exact exported APK passed [run 36752896970](https://github.com/himanshu748/foley/actions/runs/36752896970) on Google Android TV API 34 against the public HTTPS origin, with its installed SHA-256 verified. D-pad navigation, Back/resume, pairing, synthetic upload/casting, the full movie and contributor credits passed. The emulator console's actual WebM audio contains the generated 260 Hz fixture tone.

APK source: `dd586e075dc69e6174cb7fe481cd3a9caeb5f9dc`. APK SHA-256: `6a86e6e77231aa7c4a376e700c48a7dcbd8d3cf68d50bf6bcbaa6289da59de0e`. The release's `build.json` identifies the configured origin and runtime. This is a debug-signed sideload build; uninstall an earlier Foley test APK before installing a build signed by another CI key.

Input came from an API test crew using one synthetic take in all three roles. Physical phone recording, Fire TV hardware and group playtesting remain separate quality checks. Google's Android TV emulator is accepted by the [event FAQ](https://amazonappdev2026.devpost.com/details/faqs).

## Verified local tool inventory — 8 September 2026

- Homebrew OpenJDK **17.0.18** works at `/opt/homebrew/opt/openjdk@17/bin/java`.
- macOS `/usr/libexec/java_home` does not discover this installation. Set `JAVA_HOME` explicitly as shown below.
- Android command-line tools exist at `/opt/homebrew/share/android-commandlinetools/cmdline-tools/latest`. `sdkmanager --list_installed` reports no installed packages. There is no `platforms/android-35/android.jar`, build-tools 35.0.0 or platform-tools/adb under that SDK root, and `~/Library/Android/sdk` is absent.
- Gradle 9.3.1 is present in a local wrapper cache. It was used only to generate this project's wrapper; it is not the selected Android build runtime.
- The committed wrapper selects **Gradle 8.11.1**, matching Android Gradle Plugin **8.9.2**, SDK 35 and JDK 17. The distribution SHA-256 is pinned. Its generated wrapper JAR matches the official Gradle 9.3.1 wrapper checksum.
- No APK could be compiled: Android platform/build-tools are absent. No SDK packages were downloaded, no licenses were accepted, no external account was created, and no device run occurred.
- Docker CLI/Desktop is absent at the normal PATH, Homebrew, `/usr/local/bin`, `~/.docker/bin`, and `/Applications/Docker.app` locations. The Dockerfile was reviewed, not built or run.

## Set up and build

Rechecked 12 September 2026: the JDK and Android command-line tools are still present, but the checked SDK root contains no Android platform JAR, `aapt2`, `adb` or accepted-license directory. `~/Library/Android/sdk` remains absent. The installed `sdkmanager --list_installed` now emits an Android CLI deprecation notice and provides no installed-package inventory. No SDK package was added and no license was accepted. At that local check, the updated wrapper was still uncompiled. The later GitHub Actions build and emulator result are recorded below.

The launcher now enters `/tv`, displays a focused native Retry screen for a main-frame connection failure, asks the web UI to resolve Back against its current state, and requests playback suspension before pausing WebView processing. Test these interactions on the selected native runtime; source inspection alone does not establish them.

Install Android SDK Platform 35, Build-Tools 35.0.0 and Platform-Tools using Android Studio or the Android command-line tools. Review and accept any required SDK licenses yourself. No emulator image is needed merely to compile the APK; an actual device or appropriate simulator is needed to validate the Fire TV experience.

On this Homebrew macOS installation:

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export PATH="$JAVA_HOME/bin:$PATH"
```

Set `ANDROID_HOME` to the directory where you installed the platform and build tools. For a standard Android Studio installation:

```sh
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
```

From this `android/` directory, run:

```sh
./gradlew --version
./gradlew assembleDebug -PfoleyUrl=https://foley.13.204.212.172.sslip.io
```

The first wrapper run downloads the pinned Gradle distribution if it is not already cached. Android Gradle dependencies may also need downloading. `foleyUrl` must be an HTTPS origin, without a path, credentials, query or fragment. Release signing is not configured. The debug APK will be at `app/build/outputs/apk/debug/app-debug.apk`.

With a permitted Fire OS test device connected and debugging enabled:

```sh
adb devices
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n studio.foley.tv/.MainActivity
```

Check the actual device's WebView compatibility, D-pad focus, remote back, pairing, phone codec, Web Audio output, full film playback and suspend/resume behavior. The wrapper pauses/resumes WebView processing with its activity, but device audio behavior is not established until this run.

## Structure and assets checked locally

The manifest includes launcher and leanback categories, no touchscreen requirement, landscape orientation, icon and English TV banner. Cleartext traffic and WebView file/content access are disabled. Navigation is constrained to the configured HTTPS host and effective port. Banner dimensions are 320×180; icon dimensions are 512×512. XML, referenced resources, wrapper entry point/checksum and shell syntax were checked. This structural validation is not an Android compile or device result.

- [Android Gradle Plugin 8.9 compatibility](https://developer.android.com/build/releases/agp-8-9-0-release-notes)
- [TV manifest and launcher asset guidance](https://developer.android.com/training/tv/get-started/create)
- [Gradle wrapper integrity](https://docs.gradle.org/current/userguide/gradle_wrapper.html)

## Android TV CI verification

The `Android TV runtime` GitHub Actions workflow builds the web app and installs the debug APK on Google's Android TV API 34 x86 image. Its instrumentation test checks launch, D-pad Select, a six-character pairing code, horizontal navigation, Back and studio resume. Native screenshots, the device fingerprint, test reports and APKs are saved as one artifact. A successful run is emulator evidence only; it does not establish physical Fire TV performance or a real phone microphone recording.

The earlier `Android TV runtime` workflow uses an in-memory studio server and a one-day certificate for `https://10.0.2.2:4443`. Its certificate trust configuration is generated only in the ignored debug source set. The release app retains normal HTTPS validation. The artifact APK points to the temporary runner and is a test artifact, not a hosted judge demo. Build a separate APK with the actual hosted origin before distributing it.

### Verified CI result — 28 September 2026

The local September inventory above is historical. [Run 36393598341](https://github.com/himanshu748/foley/actions/runs/36393598341) successfully compiled and installed the APK on the Android TV API 34 emulator. The test includes real API upload/normalization of generated audio, three cast roles, a complete 20-second premiere, credits, viewport visibility and one persisted premiere. Screenshots and a silent native screen recording were inspected. That native run does not establish physical Fire TV performance, real microphone capture or operation of the later public-origin judge APK. The later public-origin APK passed its own runtime and recorded-audio check on 30 September, as documented above.
