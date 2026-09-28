#!/usr/bin/env bash
set -euo pipefail
mkdir -p .ci android/app/src/debug/res/raw android/app/src/debug/res/xml
openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 1 \
  -keyout .ci/server.key -out .ci/server.crt -subj '/CN=Foley ephemeral CI' \
  -addext 'subjectAltName=IP:10.0.2.2,DNS:localhost' \
  -addext 'basicConstraints=critical,CA:TRUE'
cp .ci/server.crt android/app/src/debug/res/raw/ci_ca.pem
cat > android/app/src/debug/res/xml/ci_network_security.xml <<'XML'
<network-security-config>
  <domain-config cleartextTrafficPermitted="false">
    <domain>10.0.2.2</domain>
    <trust-anchors><certificates src="@raw/ci_ca"/></trust-anchors>
  </domain-config>
</network-security-config>
XML
cat > android/app/src/debug/AndroidManifest.xml <<'XML'
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application android:networkSecurityConfig="@xml/ci_network_security"/>
</manifest>
XML
