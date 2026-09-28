#!/usr/bin/env bash
set -euo pipefail
mkdir -p .ci/evidence
collect() {
  adb pull /sdcard/Pictures/FoleyTest .ci/evidence/ || true
  adb logcat -d -t 1500 > .ci/evidence/logcat.txt || true
}
trap collect EXIT
adb shell getprop ro.build.fingerprint > .ci/evidence/device.txt
adb shell pm list features >> .ci/evidence/device.txt
./android/gradlew -p android --no-daemon connectedDebugAndroidTest -PfoleyUrl=https://10.0.2.2:4443
