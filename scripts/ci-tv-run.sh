#!/usr/bin/env bash
set -euo pipefail
mkdir -p .ci/evidence
recording_pid=''
collect() {
  if [ -n "$recording_pid" ]; then
    adb shell pkill -2 screenrecord || true
    wait "$recording_pid" || true
    adb pull /sdcard/foley-runtime.mp4 .ci/evidence/ || true
  fi
  adb pull /sdcard/Pictures/FoleyTest .ci/evidence/ || true
  adb logcat -d -t 1500 > .ci/evidence/logcat.txt || true
}
trap collect EXIT
adb shell getprop ro.build.fingerprint > .ci/evidence/device.txt
adb shell pm list features >> .ci/evidence/device.txt
./android/gradlew -p android --no-daemon assembleDebug assembleDebugAndroidTest -PfoleyUrl=https://10.0.2.2:4443
adb shell screenrecord --bit-rate 6000000 --time-limit 180 /sdcard/foley-runtime.mp4 > .ci/evidence/screenrecord.log 2>&1 &
recording_pid=$!
./android/gradlew -p android --no-daemon connectedDebugAndroidTest -PfoleyUrl=https://10.0.2.2:4443
