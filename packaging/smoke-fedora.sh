#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || ! -f $1 ]]; then
  echo "Usage: $0 /absolute/path/to/codex-desktop-linux.rpm" >&2
  exit 2
fi

rpm_path=$(realpath "$1")
container_runtime=${CONTAINER_RUNTIME:-}

if [[ -z $container_runtime ]]; then
  if command -v podman >/dev/null 2>&1; then
    container_runtime=podman
  elif command -v docker >/dev/null 2>&1; then
    container_runtime=docker
  else
    echo "Fedora smoke test requires Podman or Docker." >&2
    exit 2
  fi
fi

if ! command -v "$container_runtime" >/dev/null 2>&1; then
  echo "Container runtime not found: $container_runtime" >&2
  exit 2
fi

"$container_runtime" run --rm \
  --volume "$rpm_path:/tmp/codex-desktop.rpm:ro" \
  docker.io/library/fedora:latest \
  bash -euo pipefail -c '
    if ! dnf install --assumeyes /tmp/codex-desktop.rpm xorg-x11-server-Xvfb \
      >/tmp/dnf-install.log 2>&1; then
      cat /tmp/dnf-install.log >&2
      exit 1
    fi

    rpm --query codex-desktop-linux
    test -x "/opt/Codex Desktop/codex-desktop"
    test -f /usr/share/applications/codex-desktop.desktop
    test -f "/opt/Codex Desktop/resources/skills/use-shared-browser/SKILL.md"
    grep --quiet "^Exec=\"/opt/Codex Desktop/codex-desktop\" %U$" \
      /usr/share/applications/codex-desktop.desktop
    if ldd "/opt/Codex Desktop/codex-desktop" | grep --quiet "not found"; then
      echo "Packaged executable has unresolved shared libraries." >&2
      exit 1
    fi

    useradd --create-home smoke
    Xvfb :99 -screen 0 1164x860x24 >/tmp/xvfb.log 2>&1 &
    xvfb_pid=$!
    trap "kill $xvfb_pid >/dev/null 2>&1 || true" EXIT
    sleep 1

    set +e
    runuser -u smoke -- env DISPLAY=:99 HOME=/home/smoke \
      timeout 8s "/opt/Codex Desktop/codex-desktop" --disable-gpu \
      >/tmp/codex-desktop.log 2>&1
    app_status=$?
    set -e

    if [[ $app_status -ne 124 ]]; then
      cat /tmp/codex-desktop.log >&2
      echo "Packaged application exited early with status $app_status." >&2
      exit 1
    fi

    echo "Fedora package install and headless launch smoke test passed."
  '
