#!/usr/bin/env bash
#
# One-time setup of Warbler on the potato. Run from a checkout of the repository
# (for example ~/Warbler), as the user who will own the install (not as root;
# it uses sudo only to install the systemd units).
#
#   deploy/install.sh --login you@example.com --host potato.your-tailnet.ts.net
#   deploy/install.sh --dry-run
#
# It never overwrites an existing .env. Design: docs/update.md.
set -euo pipefail

INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
USER_NAME="$(id -un)"
LOGIN=""; HOST=""; PORT="8892"; DRY=0; START=1

while [ $# -gt 0 ]; do
	case "$1" in
	--login) LOGIN="$2"; shift 2 ;;
	--host) HOST="$2"; shift 2 ;;
	--port) PORT="$2"; shift 2 ;;
	--dry-run) DRY=1; shift ;;
	--no-start) START=0; shift ;;
	-h | --help) sed -n '2,10p' "$0"; exit 0 ;;
	*) echo "unknown option: $1" >&2; exit 2 ;;
	esac
done

run() { if [ "$DRY" -eq 1 ]; then echo "  would run: $*"; else "$@"; fi; }
say() { echo "==> $*"; }

if [ "$(id -u)" -eq 0 ]; then
	echo "Run this as your normal user, not root. It asks for sudo where it needs it." >&2
	exit 1
fi
command -v docker >/dev/null || { echo "docker is not installed" >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "the docker compose plugin is not installed" >&2; exit 1; }
command -v systemctl >/dev/null || { echo "systemd is required" >&2; exit 1; }
command -v flock >/dev/null || { echo "flock (util-linux) is required" >&2; exit 1; }
id -nG | tr ' ' '\n' | grep -qx docker || { echo "$USER_NAME is not in the docker group" >&2; exit 1; }

say "Folders"
run mkdir -p "$INSTALL_DIR/data" "$INSTALL_DIR/update-signal"

say "Settings (.env)"
if [ -f "$INSTALL_DIR/.env" ]; then
	echo "  .env already exists, leaving it alone"
else
	if [ "$DRY" -eq 1 ]; then
		echo "  would write .env with port $PORT, uid $(id -u), the lock in 'log' mode"
	else
		{
			echo "WARBLER_PORT=$PORT"
			echo "WARBLER_UID=$(id -u)"
			echo "WARBLER_GID=$(id -g)"
			echo "# 'log' records whether the Tailscale identity header arrives. Once it does"
			echo "# (see docs/phase-0.md), change this to 'enforce' and run: docker compose up -d"
			echo "WARBLER_LOCK=log"
			[ -n "$LOGIN" ] && echo "WARBLER_ALLOWED_LOGINS=$LOGIN"
			[ -n "$HOST" ] && echo "WARBLER_ALLOWED_HOSTS=$HOST"
		} >"$INSTALL_DIR/.env"
		chmod 600 "$INSTALL_DIR/.env"
		echo "  wrote .env"
	fi
fi

say "Update watcher (systemd units)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
for unit in warbler-update.path warbler-update.service warbler-tick.service warbler-tick.timer; do
	sed -e "s|@INSTALL_DIR@|$INSTALL_DIR|g" -e "s|@USER@|$USER_NAME|g" \
		"$INSTALL_DIR/deploy/watcher/$unit" >"$tmp/$unit"
	if command -v systemd-analyze >/dev/null; then
		systemd-analyze verify "$tmp/$unit" 2>&1 | grep -v "^$" || true
	fi
	run sudo install -m 644 "$tmp/$unit" "/etc/systemd/system/$unit"
done
run sudo systemctl daemon-reload
run sudo systemctl enable --now warbler-update.path warbler-tick.timer
run chmod +x "$INSTALL_DIR/deploy/watcher/update.sh"

if [ "$START" -eq 1 ]; then
	say "Starting Warbler"
	if [ "$DRY" -eq 1 ]; then
		echo "  would run: docker compose up -d (in $INSTALL_DIR)"
	else
		(cd "$INSTALL_DIR" && docker compose up -d) || {
			echo "Could not start Warbler. If the image could not be pulled, the GHCR package may be" >&2
			echo "private: make it public on GitHub (Packages, warbler, Package settings)." >&2
			exit 1
		}
	fi
fi

say "Checks"
if [ "$DRY" -eq 0 ]; then
	sleep 3
	printf '  %-34s' "warbler-update.path active:"; systemctl is-active warbler-update.path || true
	printf '  %-34s' "warbler-tick.timer active:"; systemctl is-active warbler-tick.timer || true
	printf '  %-34s' "healthz answers:"; curl -fsS --max-time 5 "http://127.0.0.1:$PORT/healthz" || echo "not yet (give it a few seconds)"
	echo
fi

cat <<NEXT

Next steps
  1. Make it reachable from your phone:
       tailscale serve --bg --https=$PORT http://127.0.0.1:$PORT
     (check 'tailscale serve --help': flags differ between versions)
  2. Open it on your phone, then Diagnostics, and check the identity header arrived.
  3. Set WARBLER_LOCK=enforce in $INSTALL_DIR/.env and run: docker compose up -d
  4. Optional: add Warbler to Meridian (see deploy/meridian/).
NEXT
