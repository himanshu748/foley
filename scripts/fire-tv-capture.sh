#!/usr/bin/env bash
set -euo pipefail
: "${FIRE_TV_SERIAL:?Set FIRE_TV_SERIAL to the connected Fire TV IP:5555}"
command -v adb >/dev/null
out=${1:-work/fire-tv-capture}
mkdir -p "$out"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
manufacturer=$(adb -s "$FIRE_TV_SERIAL" shell getprop ro.product.manufacturer | tr -d '\r')
virtual=$(adb -s "$FIRE_TV_SERIAL" shell getprop ro.kernel.qemu | tr -d '\r')
case "$manufacturer" in Amazon|amazon|Amazon.com) ;; *) echo 'Select a physical Amazon Fire OS TV device.' >&2; exit 1;; esac
[[ "$virtual" != 1 ]] || { echo 'Emulator selected; capture stopped.' >&2; exit 1; }
receipt="$out/$stamp-device.txt"
{
  echo "capture_started_utc=$stamp"
  echo "manufacturer=$manufacturer"
  echo "model=$(adb -s "$FIRE_TV_SERIAL" shell getprop ro.product.model | tr -d '\r')"
  echo "build=$(adb -s "$FIRE_TV_SERIAL" shell getprop ro.build.fingerprint | tr -d '\r')"
  echo 'input=human phone recording required; this script does not create sounds or drive the app'
  echo 'screenrecord_audio=not captured; record room/TV audio with a camera or capture device'
  echo 'flow_verified=not assessed by this script'
} > "$receipt"
remote="/sdcard/foley-$stamp.mp4"
echo 'Recording 175 seconds. Perform the shot list now; record TV audio and the phone separately.'
if ! adb -s "$FIRE_TV_SERIAL" shell screenrecord --time-limit 175 --bit-rate 8000000 "$remote"; then
  echo 'Native recording failed. Use a camera showing the physical TV, remote and audible output.' >&2
  exit 1
fi
adb -s "$FIRE_TV_SERIAL" pull "$remote" "$out/$stamp-fire-tv.mp4"
adb -s "$FIRE_TV_SERIAL" shell rm "$remote"
echo "Raw capture saved in $out; inspect it before claiming a successful flow."
