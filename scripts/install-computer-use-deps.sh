#!/usr/bin/env bash

set -euo pipefail

readonly YDOTOOL_VERSION="1.0.4"
readonly YDOTOOL_ARCHIVE_SHA256="ba075a43aa6ead51940e892ecffa4d0b8b40c241e4e2bc4bd9bd26b61fde23bd"
readonly YDOTOOL_ARCHIVE_URL="https://github.com/ReimuNotMoe/ydotool/archive/refs/tags/v${YDOTOOL_VERSION}.tar.gz"

usage() {
  cat <<'EOF'
Usage: sudo scripts/install-computer-use-deps.sh [--user USER]

Install the Linux input dependencies used by the Computer Use backend.
The target desktop user defaults to SUDO_USER.
EOF
}

target_user="${SUDO_USER:-}"
while (($# > 0)); do
  case "$1" in
    --user)
      [[ $# -ge 2 ]] || { usage >&2; exit 2; }
      target_user="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ $EUID -ne 0 ]]; then
  printf 'Run this script with sudo so it can install packages and configure /dev/uinput.\n' >&2
  exit 1
fi

if [[ -z $target_user || $target_user == root ]] || ! id "$target_user" >/dev/null 2>&1; then
  printf 'Pass the non-root desktop user explicitly with --user USER.\n' >&2
  exit 1
fi

install_build_dependencies() {
  if command -v apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update
    apt-get install --yes \
      acl build-essential ca-certificates cmake curl libevdev-dev libudev-dev \
      pkg-config scdoc
    return
  fi

  if command -v dnf >/dev/null 2>&1; then
    dnf install --assumeyes \
      acl ca-certificates cmake curl gcc libevdev-devel make pkgconf-pkg-config \
      scdoc systemd-devel
    return
  fi

  printf 'Unsupported distribution: this installer currently requires apt-get or dnf.\n' >&2
  exit 1
}

has_modern_ydotool() {
  local executable
  executable="$(command -v ydotool 2>/dev/null)" || return 1
  grep --binary-files=text --quiet -- '--absolute' "$executable"
}

install_ydotool() {
  if has_modern_ydotool; then
    printf 'Compatible ydotool already available at %s.\n' "$(command -v ydotool)"
    return
  fi

  local build_root archive source_root
  build_root="$(mktemp -d /tmp/codex-computer-use.XXXXXX)"
  trap 'rm -rf -- "${build_root:-}"' RETURN
  archive="$build_root/ydotool.tar.gz"
  source_root="$build_root/ydotool-${YDOTOOL_VERSION}"

  curl --fail --location --silent --show-error \
    "$YDOTOOL_ARCHIVE_URL" --output "$archive"
  printf '%s  %s\n' "$YDOTOOL_ARCHIVE_SHA256" "$archive" | sha256sum --check --status
  tar --extract --gzip --file "$archive" --directory "$build_root"

  cmake -S "$source_root" -B "$build_root/build" -DCMAKE_BUILD_TYPE=Release
  cmake --build "$build_root/build" --parallel
  install -D -m 0755 "$build_root/build/ydotool" /usr/local/bin/ydotool
  install -D -m 0755 "$build_root/build/ydotoold" /usr/local/bin/ydotoold

  if ! grep --binary-files=text --quiet -- '--absolute' /usr/local/bin/ydotool; then
    printf 'The installed ydotool does not expose absolute mouse movement.\n' >&2
    exit 1
  fi
}

configure_uinput() {
  getent group input >/dev/null 2>&1 || groupadd --system input
  usermod --append --groups input "$target_user"

  install -d -m 0755 /etc/udev/rules.d
  printf '%s\n' 'KERNEL=="uinput", MODE="0660", GROUP="input", TAG+="uaccess"' \
    > /etc/udev/rules.d/99-codex-computer-use-uinput.rules
  udevadm control --reload-rules
  modprobe uinput
  udevadm trigger --name-match=uinput

  # Let the current login use the device immediately. Group membership becomes
  # sufficient after the user's next login.
  setfacl -m "u:${target_user}:rw" /dev/uinput
}

configure_user_service() {
  local target_uid runtime_dir
  target_uid="$(id -u "$target_user")"
  runtime_dir="/run/user/$target_uid"

  install -d -m 0755 /etc/systemd/user
  cat > /etc/systemd/user/ydotool.service <<'EOF'
[Unit]
Description=ydotool virtual input daemon for Codex Computer Use

[Service]
Type=simple
ExecStart=/usr/local/bin/ydotoold
Restart=on-failure

[Install]
WantedBy=default.target
EOF

  if [[ ! -d $runtime_dir ]]; then
    printf 'No active login session found for %s; log in and run:\n' "$target_user" >&2
    printf '  systemctl --user enable --now ydotool.service\n' >&2
    return
  fi

  runuser -u "$target_user" -- env \
    "XDG_RUNTIME_DIR=$runtime_dir" \
    "DBUS_SESSION_BUS_ADDRESS=unix:path=$runtime_dir/bus" \
    systemctl --user daemon-reload
  runuser -u "$target_user" -- env \
    "XDG_RUNTIME_DIR=$runtime_dir" \
    "DBUS_SESSION_BUS_ADDRESS=unix:path=$runtime_dir/bus" \
    systemctl --user enable --now ydotool.service
  runuser -u "$target_user" -- env \
    "XDG_RUNTIME_DIR=$runtime_dir" \
    "DBUS_SESSION_BUS_ADDRESS=unix:path=$runtime_dir/bus" \
    systemctl --user --quiet is-active ydotool.service
}

install_build_dependencies
install_ydotool
configure_uinput
configure_user_service

printf '\nComputer Use input dependencies are ready for %s.\n' "$target_user"
printf 'Restart Codex Desktop if its Computer Use backend was already running.\n'
