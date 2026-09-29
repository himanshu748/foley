#!/usr/bin/env bash
set -euo pipefail

# This runner owns an isolated, disposable Compose project. Never run cleanup
# against the deployment's default project or retain its database/certificates.
test "${GITHUB_ACTIONS:-}" = true
[[ "${GITHUB_RUN_ID:-}" =~ ^[0-9]+$ ]]
[[ "${GITHUB_RUN_ATTEMPT:-}" =~ ^[0-9]+$ ]]
export COMPOSE_PROJECT_NAME="foley-acceptance-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
export FOLEY_HOST=localhost
mkdir -p .ci
trap 'docker compose down --volumes --remove-orphans' EXIT

docker compose config --quiet
docker compose up -d --build --wait --wait-timeout 180

# Caddy automatically uses its local CA for localhost. The production Caddyfile
# and Compose file are unchanged; no public DNS or ACME certificate is claimed.
for attempt in $(seq 1 30); do
  if docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt .ci/container-ca.crt 2>/dev/null; then
    break
  fi
  sleep 1
done
test -s .ci/container-ca.crt
curl --retry 10 --retry-connrefused --retry-delay 1 --fail --silent --show-error \
  --cacert .ci/container-ca.crt https://localhost/api/health > /dev/null
NODE_EXTRA_CA_CERTS="$PWD/.ci/container-ca.crt" node scripts/ci-container-check.mjs
