#!/usr/bin/env bash
# Disposable GitHub runner only. Keep Ubuntu signatures and TLS verification enabled.
set -euo pipefail
test "${GITHUB_ACTIONS:-}" = true
test "${RUNNER_OS:-}" = Linux
. /etc/os-release
test "$ID" = ubuntu
test "$VERSION_ID" = 24.04
test -f /usr/share/keyrings/ubuntu-archive-keyring.gpg
sudo tee /etc/apt/sources.list.d/ubuntu.sources >/dev/null <<'SOURCES'
Types: deb
URIs: https://archive.ubuntu.com/ubuntu/
Suites: noble noble-updates noble-backports
Components: main restricted universe multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg

Types: deb
URIs: https://security.ubuntu.com/ubuntu/
Suites: noble-security
Components: main restricted universe multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg
SOURCES
sudo tee /etc/apt/apt.conf.d/99lingvessa-network-timeouts >/dev/null <<'APT'
Acquire::Retries "1";
Acquire::http::Timeout "20";
Acquire::https::Timeout "20";
APT
