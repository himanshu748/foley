# Physical Fire TV demo and signed sideload APK

Use an Amazon Fire TV **running Fire OS** (API 25+); the APK is not a Vega package. The TV client loads the existing Lightsail HTTPS `/tv` interface. A phone on that same public origin supplies human microphone input. Device runtime, codec/audio quality and Activity suspend/resume remain unverified until this walkthrough is performed.

## Get the signed APK

The [Fire OS sideload APK workflow](https://github.com/himanshu748/foley/actions/workflows/fireos-apk.yml) builds on launcher/script changes or manual dispatch. Download its successful `foley-fireos-sideload` artifact, containing `foley-fireos.apk`, `SHA256SUMS`, `signature.txt` and `build.json`. Check the source SHA and checksum. It is **debug-signed for sideloading**, with no Appstore/release-signing claim; each runner may use a different key. An install certificate mismatch requires your deliberate uninstall of the old `studio.foley.tv` app (loses local studio cookies), then a new install. The script will not uninstall automatically.

```sh
cd /path/to/extracted/artifact
shasum -a 256 -c SHA256SUMS
```

No Google services are imported. The Android WebView API loads the TV surface at runtime; the manifest requests internet only. Native CI remains Google Android TV regression evidence, separate from a physical Fire TV result.

## Sideload — about 10 minutes

1. Follow Amazon's [ADB connection guide](https://developer.amazon.com/docs/fire-tv/connecting-adb-to-device.html). On Fire TV, open Settings → My Fire TV/Device & Software → About; select the device name seven times if Developer Options is hidden. Enable ADB Debugging in Developer Options. Find the TV's LAN IP in About → Network.
2. Install Android Platform Tools on the Mac; put `adb` on PATH. Keep Mac and TV on the same trusted LAN. Connect and approve the debugging prompt on the physical TV. Follow Amazon's [installation guide](https://developer.amazon.com/docs/fire-tv/installing-and-running-your-app.html).

```sh
export FIRE_TV_SERIAL=192.168.1.50:5555
adb connect "$FIRE_TV_SERIAL"
# Replace this sample LAN address with your actual TV address.
bash scripts/fire-tv-install.sh /path/to/extracted/artifact/foley-fireos.apk
```

The script rejects non-Amazon devices and Android emulators; it checks properties reported by the device, not independent hardware authenticity. Confirm the actual model/settings on camera. D-pad, Back and movie audio must work before recording the final take. Turn off ADB Debugging when finished.

## Record — about 10–20 minutes including rehearsal

```sh
export FIRE_TV_SERIAL=192.168.1.50:5555
bash scripts/fire-tv-capture.sh work/fire-tv-capture
```

Use the actual IP. This captures up to 175 seconds and saves a UTC device receipt and raw MP4. Android `screenrecord` does **not** capture audio. Record the physical TV with a camera or HDMI capture device plus audio; show the actual phone during recording. If screenrecord is unsupported, use that camera recording for the entire flow. Never substitute fixture sounds for recorded TV output. Keep private pairing codes in the intended session and end the studio afterward.

## Shot list — 2:45

| Time | Live action | Narration cue |
| --- | --- | --- |
| 0:00–0:12 | Show Fire TV model/settings and remote; launch installed Foley | Identify the actual Fire OS device and the Lightsail backend. |
| 0:12–0:25 | Start an empty studio using the remote | The living room makes a soundtrack together. |
| 0:25–0:45 | Pair the phone using the real code | Phones join the same studio over HTTPS. |
| 0:45–1:10 | Record and send three short object sounds on camera | Show microphone permission, a real take and its preview; no generated substitutes. |
| 1:10–1:30 | Cast Footsteps, Weather and Creature on the TV | Crew attribution and roles use the actual takes. |
| 1:30–1:55 | Play the complete 20-second premiere with TV audio | Leave playback uninterrupted through credits. |
| 1:55–2:15 | Save A; recast Creature with a different human take; save B | One role changes the mood. |
| 2:15–2:40 | Play complete B with audible output and credits | Demonstrate the changed soundtrack, then the saved A/B comparison. |
| 2:40–2:45 | Show the running app and state scope | Fire OS client, phone recorder, Lightsail hosting; no AWS model API. |

Record genuine runtime footage. Cuts may shorten navigation but must not substitute screenshots, relabel a runtime, hide a failure or replace actual audio. Inspect the raw recording and receipt; a created file alone is not a successful workflow. Upload and submission are owner actions.
