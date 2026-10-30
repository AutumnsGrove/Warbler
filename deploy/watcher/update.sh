#!/usr/bin/env bash
#
# Warbler update watcher. Runs on the potato itself (never inside a container),
# as the deploy user, as a systemd oneshot. Design: docs/update.md.
#
# It is started in three ways, and all three end up here:
#   1. warbler-update.path, the moment the app writes update-signal/check or
#      update-signal/requested (the Settings buttons);
#   2. Meridian, or you, running `systemctl start warbler-update.service` with
#      no signal file at all. That means "update to the newest image";
#   3. warbler-tick.timer, which runs `update.sh --tick`: refresh the
#      heartbeat, and act only if a signal file is waiting.
#
# Safety rules, all enforced below:
#   - The app cannot name an image. The only repository this script will ever
#     pull is the one written in REPO, and only by digest.
#   - One run at a time (flock). Every outside command has a timeout.
#   - A result file is written on every exit path.
#   - If the new container is not healthy within 120 seconds, the previous
#     image goes back and the database snapshot taken before the update is
#     restored.
set -euo pipefail

REPO="ghcr.io/autumnsgrove/warbler"
REPO_PATH="${REPO#ghcr.io/}"
SERVICE="warbler"
# The tag to follow. Normally "latest". The operator can set WARBLER_UPDATE_TAG
# in .env to follow another tag from the same repository (the rollback test
# uses "broken-test"). Only the host's .env decides this; the app cannot.
DEFAULT_TAG="latest"

# This script lives at <install dir>/deploy/watcher/update.sh.
INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$INSTALL_DIR/.env"
SIGNAL_DIR="$INSTALL_DIR/update-signal"
DATA_DIR="$INSTALL_DIR/data"
LOCK_FILE="$INSTALL_DIR/.update-watcher.lock"
CHECK_FILE="$SIGNAL_DIR/check"
REQUESTED_FILE="$SIGNAL_DIR/requested"
AVAILABLE_FILE="$SIGNAL_DIR/available.json"
RESULT_FILE="$SIGNAL_DIR/result"
HEARTBEAT_FILE="$SIGNAL_DIR/heartbeat"
CMD_LOG="$SIGNAL_DIR/.last-command.log"
SNAPSHOT_FILE="$DATA_DIR/backups/pre-update.db"

BUSY_WAIT_MAX=60
HEALTH_POLLS=40   # x 3 seconds = 120 seconds

MODE="signals"
[ "${1:-}" = "--tick" ] && MODE="tick"

mkdir -p "$SIGNAL_DIR"
cd "$INSTALL_DIR"

# ---------------------------------------------------------------------------
# helpers

now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

# Write a file atomically: the app and this script both react to files
# appearing, so nobody may ever see half of one.
atomic_write() { # <path> <content>
	printf '%s\n' "$2" >"$1.tmp"
	mv "$1.tmp" "$1"
}

json_escape() {
	printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr -d '\n'
}

truncate_detail() {
	local text="$1" max=400
	if [ "${#text}" -gt "$max" ]; then
		printf '...%s' "${text: -$max}"
	else
		printf '%s' "$text"
	fi
}

TARGET_IMAGE=""
write_result() { # <ok|failed|skipped> <detail>
	printf '{"status":"%s","detail":"%s","target":"%s","finished_at":"%s"}\n' \
		"$(json_escape "$1")" "$(json_escape "$2")" "$(json_escape "$TARGET_IMAGE")" "$(now)" \
		>"$RESULT_FILE.tmp"
	mv "$RESULT_FILE.tmp" "$RESULT_FILE"
}

env_get() { # <NAME> <default>
	local v
	v="$(grep "^$1=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- || true)"
	printf '%s' "${v:-$2}"
}

TAG="$(env_get WARBLER_UPDATE_TAG "$DEFAULT_TAG")"

set_pinned_image() {
	local value="$1"
	if grep -q '^WARBLER_IMAGE=' "$ENV_FILE" 2>/dev/null; then
		sed -i.bak "s|^WARBLER_IMAGE=.*|WARBLER_IMAGE=$value|" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
	else
		printf 'WARBLER_IMAGE=%s\n' "$value" >>"$ENV_FILE"
	fi
}

unpin_image() {
	if grep -q '^WARBLER_IMAGE=' "$ENV_FILE" 2>/dev/null; then
		sed -i.bak '/^WARBLER_IMAGE=/d' "$ENV_FILE" && rm -f "$ENV_FILE.bak"
	fi
}

# Put .env back the way it was before this run touched it. An empty previous
# value means nothing was pinned, so go back to nothing.
restore_pin() {
	if [ -n "$PREVIOUS_IMAGE" ]; then set_pinned_image "$PREVIOUS_IMAGE"; else unpin_image; fi
}

# Only this exact shape is ever accepted as an image reference.
valid_target() {
	[[ "$1" =~ ^ghcr\.io/autumnsgrove/warbler@sha256:[0-9a-f]{64}$ ]]
}

short() { # sha256:abcdef... -> abcdef123456
	local d="${1#sha256:}"
	printf '%s' "${d:0:12}"
}

# Ask GHCR (anonymously) which digest :latest points to. Two small requests.
resolve_latest_digest() {
	local token headers digest
	token="$(curl -fsS --max-time 15 \
		"https://ghcr.io/token?service=ghcr.io&scope=repository:${REPO_PATH}:pull" 2>>"$CMD_LOG" |
		sed -n 's/.*"token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')" || true
	[ -n "$token" ] || return 1
	headers="$(curl -fsSI --max-time 15 \
		-H "Authorization: Bearer $token" \
		-H "Accept: application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json" \
		"https://ghcr.io/v2/${REPO_PATH}/manifests/${TAG}" 2>>"$CMD_LOG")" || return 1
	digest="$(printf '%s\n' "$headers" | tr -d '\r' | sed -n 's/^[Dd]ocker-[Cc]ontent-[Dd]igest:[[:space:]]*//p' | head -1)"
	[[ "$digest" =~ ^sha256:[0-9a-f]{64}$ ]] || return 1
	printf '%s' "$digest"
}

# The digest this install is running now, from the pin in .env, or from the
# running container if nothing is pinned yet. "unknown" if neither works.
current_digest() {
	local pinned id
	pinned="$(env_get WARBLER_IMAGE "")"
	if [[ "$pinned" == *@sha256:* ]]; then
		printf 'sha256:%s' "${pinned##*@sha256:}"
		return
	fi
	id="$(docker compose ps -q "$SERVICE" 2>/dev/null | head -1 || true)"
	if [ -n "$id" ]; then
		docker inspect --format '{{index .RepoDigests 0}}' "$(docker inspect --format '{{.Image}}' "$id")" 2>/dev/null |
			sed -n 's/.*@\(sha256:[0-9a-f]\{64\}\)$/\1/p' | head -1 | grep . || printf 'unknown'
		return
	fi
	printf 'unknown'
}

write_available() { # <current digest> <latest digest>
	local cur="$1" latest="$2" avail="true"
	[ "$cur" = "$latest" ] && avail="false"
	printf '{"current":"%s","latest":"%s","latest_digest":"%s","checked_at":"%s","update_available":%s}\n' \
		"$(short "$cur")" "$(short "$latest")" "$latest" "$(now)" "$avail" >"$AVAILABLE_FILE.tmp"
	mv "$AVAILABLE_FILE.tmp" "$AVAILABLE_FILE"
}

# Wait (briefly) for an upload in progress. A failing or missing answer counts
# as "not busy": a stuck endpoint must never block an update.
wait_for_idle() {
	local port waited=0 reply
	port="$(env_get WARBLER_PORT 8892)"
	while true; do
		reply="$(curl -s --max-time 5 "http://127.0.0.1:${port}/api/busy" 2>/dev/null || true)"
		case "$reply" in *'"busy":true'*) ;; *) return 0 ;; esac
		if [ "$waited" -ge "$BUSY_WAIT_MAX" ]; then
			echo "an upload is still in progress after ${BUSY_WAIT_MAX}s, updating anyway" >&2
			return 0
		fi
		echo "an upload is in progress, waiting (${waited}s/${BUSY_WAIT_MAX}s)"
		sleep 5
		waited=$((waited + 5))
	done
}

service_running() {
	local id
	id="$(docker compose ps -q "$SERVICE" 2>/dev/null | head -1 || true)"
	[ -n "$id" ] && [ "$(docker inspect --format '{{.State.Running}}' "$id" 2>/dev/null || echo false)" = "true" ]
}

# Put the previous image back, and the database snapshot with it. Returns
# non-zero if the rollback itself failed.
rollback_container() {
	restore_pin
	if [ "$SNAPSHOT_TAKEN" = "yes" ] && [ -f "$SNAPSHOT_FILE" ] && [ -f "$DATA_DIR/warbler.db" ]; then
		timeout 60 docker compose stop "$SERVICE" 2>&1 | tee "$CMD_LOG" || true
		cp "$SNAPSHOT_FILE" "$DATA_DIR/warbler.db"
		rm -f "$DATA_DIR/warbler.db-wal" "$DATA_DIR/warbler.db-shm"
		echo "restored the database snapshot taken before this update"
	fi
	if timeout 60 docker compose up -d --force-recreate --no-deps "$SERVICE" 2>&1 | tee "$CMD_LOG"; then
		return 0
	fi
	return 1
}

# ---------------------------------------------------------------------------
# start-up: heartbeat first, then the one-at-a-time lock

atomic_write "$HEARTBEAT_FILE" "$(now)"

exec 200>"$LOCK_FILE"
if ! flock -n 200; then
	echo "an update run is already in progress, skipping"
	exit 0
fi

HAS_CHECK="no"; HAS_REQUESTED="no"
[ -f "$CHECK_FILE" ] && HAS_CHECK="yes"
[ -f "$REQUESTED_FILE" ] && HAS_REQUESTED="yes"

# The timer's tick does nothing unless a signal is waiting.
if [ "$MODE" = "tick" ] && [ "$HAS_CHECK" = "no" ] && [ "$HAS_REQUESTED" = "no" ]; then
	exit 0
fi

# ---------------------------------------------------------------------------
# check only: look up the newest digest, change nothing

if [ "$HAS_CHECK" = "yes" ] && [ "$HAS_REQUESTED" = "no" ]; then
	: >"$CMD_LOG"
	if ! [[ "$TAG" =~ ^[A-Za-z0-9._-]{1,64}$ ]]; then
		echo "WARBLER_UPDATE_TAG in .env is not a valid tag name: $TAG" >&2
		rm -f "$CHECK_FILE"
		exit 0
	fi
	if latest="$(resolve_latest_digest)"; then
		write_available "$(current_digest)" "$latest"
	else
		echo "could not look up the newest version: $(truncate_detail "$(cat "$CMD_LOG")")" >&2
		# Leave available.json as it was; the app keeps showing the old answer.
	fi
	rm -f "$CHECK_FILE"
	exit 0
fi

# ---------------------------------------------------------------------------
# update (a request file, or a bare start from Meridian or by hand)

PREVIOUS_IMAGE="$(env_get WARBLER_IMAGE "")"
SNAPSHOT_TAKEN="no"

finish_failed() { # <detail>
	write_result "failed" "$1"
	rm -f "$REQUESTED_FILE" "$CHECK_FILE"
	exit 1
}

if [ "$HAS_REQUESTED" = "yes" ]; then
	asked="$(tr -d '[:space:]' <"$REQUESTED_FILE" 2>/dev/null || true)"
	if [ "$asked" != "latest" ]; then
		# The app only ever writes the word "latest". Anything else means a
		# bug or tampering, so refuse and say so.
		finish_failed "refusing an unexpected update request (expected the word 'latest')"
	fi
fi

if ! [[ "$TAG" =~ ^[A-Za-z0-9._-]{1,64}$ ]]; then
	finish_failed "WARBLER_UPDATE_TAG in .env is not a valid tag name: $TAG"
fi

: >"$CMD_LOG"
if ! digest="$(resolve_latest_digest)"; then
	finish_failed "could not look up the newest version (tag $TAG) on GHCR: $(truncate_detail "$(cat "$CMD_LOG")")"
fi
TARGET_IMAGE="$REPO@$digest"
if ! valid_target "$TARGET_IMAGE"; then
	finish_failed "the image reference does not have the expected shape, refusing to use it: $TARGET_IMAGE"
fi

CURRENT="$(current_digest)"
if [ "$CURRENT" = "$digest" ]; then
	write_available "$CURRENT" "$digest"
	write_result "skipped" "already running the newest version"
	rm -f "$REQUESTED_FILE" "$CHECK_FILE"
	exit 0
fi
echo "updating warbler: $(short "$CURRENT") -> $(short "$digest")"

wait_for_idle

# Snapshot the database through the running app. The migrations only go
# forward, so an older version may not understand a newer database; the
# snapshot is what makes rollback safe. If the app is not running there is
# nothing to snapshot, and the update proceeds (it may be the fix).
if service_running; then
	if timeout 60 docker compose exec -T "$SERVICE" /app/warbler snapshot 2>&1 | tee "$CMD_LOG"; then
		SNAPSHOT_TAKEN="yes"
	else
		finish_failed "could not take a database snapshot before updating, so nothing was changed: $(truncate_detail "$(cat "$CMD_LOG")")"
	fi
fi

set_pinned_image "$TARGET_IMAGE"

if ! timeout 300 docker compose pull "$SERVICE" 2>&1 | tee "$CMD_LOG"; then
	# The running container was never touched; just put the pin back.
	restore_pin
	finish_failed "docker compose pull failed: $(truncate_detail "$(cat "$CMD_LOG")")"
fi

if ! timeout 60 docker compose up -d --force-recreate --no-deps "$SERVICE" 2>&1 | tee "$CMD_LOG"; then
	detail="docker compose up failed: $(truncate_detail "$(cat "$CMD_LOG")")"
	if rollback_container; then
		finish_failed "$detail"
	else
		finish_failed "update failed AND rollback to the previous image also failed, Warbler may be down right now: $detail"
	fi
fi

# `up` returning only means the container was told to start. The image's own
# health check (the program asking itself /healthz) says whether it is serving.
CONTAINER_ID="$(docker compose ps -q "$SERVICE" | head -1)"
HEALTH="unknown"
for _ in $(seq 1 "$HEALTH_POLLS"); do
	HEALTH="$(docker inspect --format '{{.State.Health.Status}}' "$CONTAINER_ID" 2>/dev/null || echo unknown)"
	if [ "$HEALTH" = "healthy" ] || [ "$HEALTH" = "unhealthy" ]; then break; fi
	sleep "${WARBLER_HEALTH_SLEEP:-3}"
done

if [ "$HEALTH" != "healthy" ]; then
	FAIL_LOG="$(docker compose logs --no-color --tail=30 "$SERVICE" 2>&1 || true)"
	detail="the new version started but never reported healthy (status: $HEALTH): $(truncate_detail "$FAIL_LOG")"
	if rollback_container; then
		finish_failed "$detail"
	else
		finish_failed "update failed AND rollback to the previous image also failed, Warbler may be down right now: $detail"
	fi
fi

write_available "$digest" "$digest"
write_result "ok" "updated to $(short "$digest")"
rm -f "$REQUESTED_FILE" "$CHECK_FILE"
