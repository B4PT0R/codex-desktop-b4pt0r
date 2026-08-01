#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 || ! -f $1 || ! -f $2 ]]; then
  echo "Usage: $0 /path/to/codex-desktop-linux.rpm /path/to/codex-desktop-linux.AppImage" >&2
  exit 2
fi

rpm_path=$(realpath "$1")
appimage_path=$(realpath "$2")
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
  --env "CODEX_DESKTOP_SMOKE_RUNTIME=$container_runtime" \
  --volume "$rpm_path:/tmp/codex-desktop.rpm:ro" \
  --volume "$appimage_path:/tmp/codex-desktop.AppImage:ro" \
  docker.io/library/fedora:latest \
  bash -euo pipefail -c '
    if ! dnf install --assumeyes /tmp/codex-desktop.rpm \
      xorg-x11-server-Xvfb dbus-daemon \
      >/tmp/dnf-install.log 2>&1; then
      cat /tmp/dnf-install.log >&2
      exit 1
    fi

    rpm --query codex-desktop-linux
    test -x "/opt/Codex Desktop/codex-desktop"
    test -f /usr/share/applications/codex-desktop.desktop
    test -f "/opt/Codex Desktop/resources/skills/use-shared-browser/SKILL.md"
    test -x /tmp/codex-desktop.AppImage
    grep --quiet "^Exec=\"/opt/Codex Desktop/codex-desktop\" %U$" \
      /usr/share/applications/codex-desktop.desktop
    if ldd "/opt/Codex Desktop/codex-desktop" | grep --quiet "not found"; then
      echo "Packaged executable has unresolved shared libraries." >&2
      exit 1
    fi

    dbus-uuidgen --ensure
    mkdir -p /run/dbus
    dbus-daemon --system --fork
    useradd --create-home smoke
    Xvfb :99 -screen 0 1164x860x24 >/tmp/xvfb.log 2>&1 &
    xvfb_pid=$!
    trap "kill $xvfb_pid >/dev/null 2>&1 || true" EXIT
    sleep 1

    smoke_launch() {
      local label=$1
      local log_path=$2
      shift 2

      local smoke_args=(--disable-gpu)
      # Docker's default seccomp profile blocks Chromium's nested sandbox.
      # Podman exercises the packaged sandbox normally on the local path.
      if [[ $CODEX_DESKTOP_SMOKE_RUNTIME == docker ]]; then
        smoke_args+=(--no-sandbox)
      fi

      set +e
      runuser -u smoke -- env DISPLAY=:99 HOME=/home/smoke \
        dbus-run-session -- timeout 8s "$@" "${smoke_args[@]}" \
        >"$log_path" 2>&1
      local app_status=$?
      set -e

      if [[ $app_status -ne 124 ]]; then
        cat "$log_path" >&2
        echo "$label exited early with status $app_status." >&2
        exit 1
      fi
    }

    smoke_launch "RPM application" /tmp/rpm-app.log \
      "/opt/Codex Desktop/codex-desktop"
    smoke_launch "AppImage application" /tmp/appimage-app.log \
      env APPIMAGE_EXTRACT_AND_RUN=1 /tmp/codex-desktop.AppImage

    echo "Fedora RPM install and RPM/AppImage headless launch smoke tests passed."
  '
