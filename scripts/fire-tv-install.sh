#!/usr/bin/env bash
set -euo pipefail
: "${FIRE_TV_SERIAL:?Set FIRE_TV_SERIAL to the Fire TV IP:5555}"
apk=${1:?Usage: FIRE_TV_SERIAL=IP:5555 bash scripts/fire-tv-install.sh /path/to/foley-fireos.apk}
command -v adb >/dev/null
[[ -f "$apk" ]] || { echo 'APK not found' >&2; exit 1; }
adb connect "$FIRE_TV_SERIAL"
manufacturer=$(adb -s "$FIRE_TV_SERIAL" shell getprop ro.product.manufacturer | tr -d '\r')
virtual=$(adb -s "$FIRE_TV_SERIAL" shell getprop ro.kernel.qemu | tr -d '\r')
case "$manufacturer" in Amazon|amazon|Amazon.com) ;; *) echo 'Select a physical Amazon Fire OS TV device.' >&2; exit 1;; esac
[[ "$virtual" != 1 ]] || { echo 'An emulator cannot supply physical Fire TV proof.' >&2; exit 1; }
adb -s "$FIRE_TV_SERIAL" install -r "$apk"
adb -s "$FIRE_TV_SERIAL" shell am start -n studio.foley.tv/.MainActivity
