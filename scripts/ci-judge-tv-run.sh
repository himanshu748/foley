#!/usr/bin/env bash
# Run the exported judge APK unchanged, using normal public certificate validation.
set -euo pipefail
: "${FOLEY_ORIGIN:?Set the same public HTTPS origin used to build the judge APK}"
evidence=judge-build/runtime
mkdir -p "$evidence"
recording_pid=''
audio_pid=''
console_recording=''
console_name="foley-judge-${GITHUB_RUN_ID:?Run this capture in GitHub Actions}-${GITHUB_RUN_ATTEMPT:-1}.webm"
console_roots=("$PWD" "${ANDROID_AVD_HOME:-$HOME/.android/avd}/test.avd")
console_actual_file=''
adb_cmd() { timeout 30 adb "$@"; }
locate_console_output() {
  local stage=$1 root candidate_file
  local -a matches=()
  console_actual_file=''
  candidate_file="$evidence/console-candidates-$stage.txt"
  : > "$candidate_file"
  for root in "${console_roots[@]}"; do
    printf '%s\n' "$root" >> "$evidence/console-output-roots.txt"
    if [ -d "$root" ]; then
      timeout 10 find "$root" -maxdepth 5 -type f -name "$console_name" >> "$candidate_file" 2>> "$evidence/console-location-errors.txt" || true
    fi
  done
  mapfile -t matches < <(sort -u "$candidate_file")
  if [ "${#matches[@]}" -eq 1 ]; then
    console_actual_file=${matches[0]}
    printf '%s\n' "$console_actual_file" > "$evidence/console-output-location.txt"
  fi
}
mark_capture_time() {
  python3 - "$1" <<'PY'
import json, pathlib, sys, time
path = pathlib.Path('judge-build/runtime/capture-starts.json')
data = json.loads(path.read_text()) if path.exists() else {}
data[sys.argv[1]] = time.time()
path.write_text(json.dumps(data, indent=2) + '\n')
PY
}
stop_capture() {
  if [ -n "$console_recording" ]; then
    mark_capture_time emulator_console_stop_requested_unix
    adb_cmd emu screenrecord stop > "$evidence/console-stop.txt" 2>&1 || true
    mark_capture_time emulator_console_stop_returned_unix
    console_recording=''
    locate_console_output stopped
    if [ -n "$console_actual_file" ] && [ -s "$console_actual_file" ]; then
      cp "$console_actual_file" "$evidence/emulator-av.webm"
    fi
  fi
  if [ -n "$recording_pid" ]; then
    mark_capture_time screenrecord_stop_requested_unix
    adb_cmd shell pkill -2 screenrecord || true
    for attempt in $(seq 1 10); do
      if ! kill -0 "$recording_pid" 2>/dev/null; then break; fi
      sleep 1
    done
    kill "$recording_pid" 2>/dev/null || true
    wait "$recording_pid" || true
    mark_capture_time screenrecord_process_ended_unix
    recording_pid=''
    adb_cmd pull /sdcard/foley-judge-runtime.mp4 "$evidence/silent-screenrecord.mp4" || true
  fi
  if [ -n "$audio_pid" ]; then
    mark_capture_time audio_stop_requested_unix
    kill -INT "$audio_pid" 2>/dev/null || true
    for attempt in $(seq 1 10); do
      if ! kill -0 "$audio_pid" 2>/dev/null; then break; fi
      sleep 1
    done
    kill "$audio_pid" 2>/dev/null || true
    wait "$audio_pid" || true
    mark_capture_time audio_process_ended_unix
    audio_pid=''
  fi
}
collect() {
  stop_capture
  adb_cmd pull /sdcard/Pictures/FoleyTest "$evidence/" || true
  adb_cmd logcat -d -t 1500 > "$evidence/logcat.txt" || true
  timeout 10 pactl list sink-inputs > "$evidence/pulse-sink-inputs.txt" || true
}
trap collect EXIT
test ! -d android/app/src/debug
test -s judge-build/foley-tv.apk
test -s android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
python3 - <<'PY'
import hashlib, json, os, pathlib
build = json.loads(pathlib.Path('judge-build/build.json').read_text())
assert build['origin'] == os.environ['FOLEY_ORIGIN'], 'Build origin differs from runtime origin'
assert build['apk_sha256'] == hashlib.sha256(pathlib.Path('judge-build/foley-tv.apk').read_bytes()).hexdigest(), 'Exported APK changed'
PY
adb_cmd shell getprop ro.build.fingerprint > "$evidence/device.txt"
adb_cmd shell pm list features >> "$evidence/device.txt"
adb_cmd shell getprop ro.build.version.sdk >> "$evidence/device.txt"
adb_cmd shell dumpsys webviewupdate > "$evidence/webview.txt"
# On a fresh Google TV image, GMS downloads modules after sys.boot_completed and
# restarts its FontsProvider. Android kills dependent WebViews during that restart.
# Wait for the first-boot services to settle; do not retry or relax the app test.
ready_deadline=$((SECONDS + 180))
stable_samples=0
last_gms_pid=''
while (( SECONDS < ready_deadline && stable_samples < 3 )); do
  gms_pid=$(adb_cmd shell pidof com.google.android.gms.persistent | tr -d '\r' || true)
  uptime_seconds=$(adb_cmd shell cat /proc/uptime | cut -d. -f1)
  if [[ "$gms_pid" =~ ^[0-9]+$ ]] && (( uptime_seconds >= 90 )); then
    if [ "$gms_pid" = "$last_gms_pid" ]; then
      stable_samples=$((stable_samples + 1))
    else
      stable_samples=0
    fi
  else
    stable_samples=0
  fi
  printf 'uptime_seconds=%s gms_pid=%s stable_samples=%s\n' "$uptime_seconds" "$gms_pid" "$stable_samples" >> "$evidence/boot-readiness.txt"
  last_gms_pid=$gms_pid
  if (( stable_samples < 3 )); then sleep 10; fi
done
if (( stable_samples < 3 )); then
  echo 'Google TV first-boot services did not stabilize within 180 seconds' >&2
  exit 1
fi
adb_cmd install -r judge-build/foley-tv.apk
adb_cmd install -r android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
installed_apk=$(adb_cmd shell pm path studio.foley.tv | tr -d '\r' | sed -n 's/^package://p')
[[ "$installed_apk" == /data/app/*/base.apk && "$installed_apk" != *$'\n'* ]]
adb_cmd pull "$installed_apk" "$evidence/installed-base.apk"
cmp judge-build/foley-tv.apk "$evidence/installed-base.apk"
sha256sum "$evidence/installed-base.apk" > "$evidence/installed-apk.sha256"
# The APK remains in judge-build; no need to upload a duplicate binary.
rm "$evidence/installed-base.apk"
timeout 10 "$ANDROID_HOME/emulator/emulator" -help-audio > "$evidence/emulator-audio-help.txt" 2>&1 || true
adb_cmd shell settings put system sound_effects_enabled 0
# TV images need not use the phone's 0..15 music-volume range.
# Query the actual platform range; never compensate by replacing captured audio.
adb_cmd shell cmd media_session volume --stream 3 --get > "$evidence/media-volume.txt"
media_max=$(python3 - "$evidence/media-volume.txt" <<'PY_VOLUME'
import pathlib,re,sys
text=pathlib.Path(sys.argv[1]).read_text()
match=re.search(r'volume is (\d+) in range \[(\d+)\.\.(\d+)\]',text)
assert match, 'Android did not report its media-volume range'
maximum=int(match[3]);assert 1 <= maximum <= 200
print(maximum)
PY_VOLUME
)
# On this API 34 image the media_session setter reports success but AppOps
# rejects its com.android.server.media package under shell UID. Use real volume
# keys through the system input path, then verify the observable music level.
for attempt in $(seq 1 "$media_max"); do
  adb_cmd shell input keyevent KEYCODE_VOLUME_UP
  sleep 0.1
done
sleep 2
adb_cmd shell cmd media_session volume --stream 3 --get >> "$evidence/media-volume.txt"
python3 - "$evidence/media-volume.txt" <<'PY_VOLUME'
import pathlib,re,sys
matches=re.findall(r'volume is (\d+) in range \[(\d+)\.\.(\d+)\]',pathlib.Path(sys.argv[1]).read_text())
assert len(matches)>=2 and matches[-1][0]==matches[-1][2], 'Media volume did not reach maximum'
PY_VOLUME
adb_cmd logcat -c
timeout 10 pactl list sources > "$evidence/pulse-sources.txt"
cat > "$evidence/README.txt" <<'TEXT'
This run installs the exact foley-tv.apk from this artifact and verifies its installed hash.
Runtime: Google Android TV API 34 emulator, public HTTPS with normal TLS validation.
TvRuntimeTest uses real D-pad events and an API fixture crew with a generated 260 Hz WAV.
The fixture is not a phone microphone recording. This is not physical Fire TV evidence.
emulator-av.webm is the Android Emulator console's native video/audio recording.
native-emulator-audio.wav is decoded from that WebM's actual audio stream, not a replacement.
console-help.txt records the installed emulator's command capabilities. Official docs:
https://developer.android.com/studio/run/emulator-record-screen
https://developer.android.com/studio/run/emulator-console
silent-screenrecord.mp4 is separate Android shell screenrecord output with no audio.
emulator-output.wav is a diagnostic PulseAudio monitor capture; it may be silent and is
not the audio verification source. Do not substitute it for verified native WebM audio.
The recordings start independently. capture-starts.json records host launch, stop and
instrumentation times. Android screenrecord has a 180-second limit; longer test runs may
be truncated. Exact sample/frame synchronization has not been measured. Do not describe
them as synced footage.
TEXT
# The emulator console recorder includes audio; adb shell screenrecord does not.
# SDK versions resolve console output in the process cwd or AVD console_out.
# Inspect only the actual emulator process cwd plus the documented directories.
for emulator_pid in $(pgrep -u "$(id -u)" -f '/emulator/(emulator|qemu/)' || true); do
  emulator_exe=$(readlink -f "/proc/$emulator_pid/exe" || true)
  case "$emulator_exe" in
    */emulator|*/qemu-system-*)
      emulator_cwd=$(readlink -f "/proc/$emulator_pid/cwd" || true)
      printf 'pid=%s exe=%s cwd=%s\n' "$emulator_pid" "$emulator_exe" "$emulator_cwd" >> "$evidence/emulator-process.txt"
      if [ -n "$emulator_cwd" ] && [ "$emulator_cwd" != / ]; then console_roots+=("$emulator_cwd"); fi
      ;;
  esac
done
# Audio capture needs the normal engine; the headless executable stubs PA.
if grep -q 'exe=.*-headless' "$evidence/emulator-process.txt"; then
  echo 'Headless emulator engine cannot establish PulseAudio output' >&2
  exit 1
fi
adb_cmd emu help screenrecord > "$evidence/console-help.txt"
adb_cmd emu help screenrecord start >> "$evidence/console-help.txt"
mark_capture_time emulator_console_launch_unix
adb_cmd emu screenrecord start --time-limit 180 "$console_name" > "$evidence/console-start.txt"
grep -q '^OK' "$evidence/console-start.txt"
console_recording=1
locate_console_output started
mark_capture_time audio_launch_unix
ffmpeg -nostdin -hide_banner -loglevel warning -y -f pulse -sample_rate 48000 -channels 2 \
  -i foley_tv.monitor -t 480 -c:a pcm_s16le "$evidence/emulator-output.wav" > "$evidence/audio-capture.log" 2>&1 &
audio_pid=$!
sleep 1
kill -0 "$audio_pid"
mark_capture_time screenrecord_launch_unix
timeout 190 adb shell screenrecord --bit-rate 6000000 --time-limit 180 /sdcard/foley-judge-runtime.mp4 > "$evidence/screenrecord.log" 2>&1 &
recording_pid=$!
sleep 1
kill -0 "$recording_pid"
# Do not invoke Gradle here: it could rebuild the APK being offered to judges.
mark_capture_time instrumentation_started_unix
set +e
timeout 420 adb shell am instrument -w -r \
  -e class studio.foley.tv.TvRuntimeTest \
  studio.foley.tv.test/androidx.test.runner.AndroidJUnitRunner \
  > "$evidence/instrumentation.txt" 2>&1
instrumentation_status=$?
set -e
mark_capture_time instrumentation_ended_unix
# Give the recorder time to flush the last premiere frames before stopping it.
# This is post-test footage, not an artificial extension of the film or credits.
sleep 3
stop_capture
export FOLEY_INSTRUMENTATION_STATUS="$instrumentation_status"
python3 - <<'PY'
import json, os, pathlib, re, xml.etree.ElementTree as ET
root = pathlib.Path('judge-build/runtime')
output = (root / 'instrumentation.txt').read_text()
passed = (os.environ['FOLEY_INSTRUMENTATION_STATUS'] == '0'
          and re.search(r'^OK \(1 test\)\s*$', output, re.M)
          and re.search(r'^INSTRUMENTATION_CODE: -1\s*$', output, re.M)
          and not re.search(r'FAILURES!!!|INSTRUMENTATION_FAILED|Process crashed', output))
suite = ET.Element('testsuite', name='Public HTTPS judge APK', tests='1', failures='0' if passed else '1')
case = ET.SubElement(suite, 'testcase', classname='studio.foley.tv.TvRuntimeTest', name='tvLaunchRemotePairResumeAndPremiere')
if not passed:
    ET.SubElement(case, 'failure', message='Instrumentation did not report exactly one successful test').text = output
ET.SubElement(suite, 'system-out').text = output
ET.ElementTree(suite).write(root / 'junit.xml', encoding='utf-8', xml_declaration=True)
path = pathlib.Path('judge-build/build.json')
build = json.loads(path.read_text())
build.update(runtime_tested=True, runtime_passed=bool(passed), installed_apk_hash_verified=True,
             runtime='Google Android TV API 34 emulator', physical_device_tested=False,
             audio_input='Synthetic 260 Hz WAV supplied by TvRuntimeTest API fixture')
path.write_text(json.dumps(build, indent=2) + '\n')
if not passed:
    raise SystemExit('Judge APK instrumentation failed; see runtime/instrumentation.txt and junit.xml')
PY
test -s "$evidence/emulator-av.webm"
timeout 30 ffprobe -v error -show_streams -show_format -of json "$evidence/emulator-av.webm" > "$evidence/emulator-av-probe.json"
python3 - <<'PY'
import json, pathlib
probe = json.loads(pathlib.Path('judge-build/runtime/emulator-av-probe.json').read_text())
assert {'video', 'audio'} <= {s['codec_type'] for s in probe['streams']}, 'Native WebM must contain both video and audio'
assert float(probe['format']['duration']) >= 20, 'Native recording is shorter than the premiere'
PY
timeout 60 ffmpeg -nostdin -hide_banner -loglevel error -y -i "$evidence/emulator-av.webm" \
  -map 0:a:0 -ar 48000 -ac 2 -c:a pcm_s16le "$evidence/native-emulator-audio.wav"
test -s "$evidence/silent-screenrecord.mp4"
timeout 30 ffprobe -v error -show_streams -show_format -of json "$evidence/silent-screenrecord.mp4" > "$evidence/screenrecord-probe.json"
python3 - <<'PY'
import json, pathlib
probe = json.loads(pathlib.Path('judge-build/runtime/screenrecord-probe.json').read_text())
assert any(s['codec_type'] == 'video' for s in probe['streams']), 'No native video stream captured'
assert float(probe['format']['duration']) > 1, 'Native recording is empty'
PY
# A silent capture is not audio proof. Check for the fixture's tone in the
# actual captured PCM rather than treating successful video playback as audibility.
python3 - <<'PY'
import array, hashlib, json, math, pathlib, sys, wave
root = pathlib.Path('judge-build/runtime')
path = root / 'native-emulator-audio.wav'
matches = []
peak = 0
with wave.open(str(path), 'rb') as audio:
    assert audio.getsampwidth() == 2 and audio.getframerate() == 48000, 'Unexpected captured PCM format'
    channels = audio.getnchannels()
    duration = audio.getnframes() / audio.getframerate()
    window = 0
    # One channel, decimated to 12 kHz; each analysis window covers 100 ms.
    weights = [(math.cos(2*math.pi*260*i/12000), math.sin(2*math.pi*260*i/12000)) for i in range(1200)]
    while raw := audio.readframes(4800):
        samples = array.array('h', raw)
        if sys.byteorder != 'little':
            samples.byteswap()
        values = samples[::channels*4]
        peak = max(peak, max((abs(x) for x in values), default=0))
        energy = sum(x*x for x in values)
        if len(values) == 1200 and energy / len(values) > 100**2:
            real = sum(x*w[0] for x, w in zip(values, weights))
            imag = sum(x*w[1] for x, w in zip(values, weights))
            fraction = 2*(real*real+imag*imag)/(len(values)*energy)
            if fraction > 0.5:
                matches.append(round(window*0.1, 1))
        window += 1
detected = len(matches) >= 3
result = {'capture_source': 'Android Emulator console WebM audio stream', 'duration_seconds': duration,
          'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'peak_pcm16': peak,
          'synthetic_fixture_hz': 260, 'matching_100ms_windows': matches,
          'synthetic_tone_detected': detected, 'physical_speaker_or_microphone_verified': False}
(root / 'audio-verification.json').write_text(json.dumps(result, indent=2) + '\n')
build_path = pathlib.Path('judge-build/build.json')
build = json.loads(build_path.read_text())
build['emulator_output_audio_verified'] = detected
build_path.write_text(json.dumps(build, indent=2) + '\n')
if not detected:
    raise SystemExit('No sustained 260 Hz fixture tone detected in emulator output; audio remains unverified')
PY
