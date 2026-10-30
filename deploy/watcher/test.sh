#!/usr/bin/env bash
#
# Tests for update.sh. They run the real script against fake `docker`, `curl`,
# `timeout` and `sleep` commands placed first on the PATH, so every success and
# failure path can be exercised without touching a real machine or GHCR.
#
#   bash deploy/watcher/test.sh
#
# The "second run while locked" test needs the real `flock` (Linux). On macOS it
# is skipped, and CI (Linux) runs it.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_SRC="$HERE/update.sh"
D1="sha256:$(printf 'a%.0s' $(seq 1 64))"
D2="sha256:$(printf 'b%.0s' $(seq 1 64))"
REPO="ghcr.io/autumnsgrove/warbler"

PASS=0; FAIL=0; SKIP=0
REAL_PATH="$PATH"
HAVE_REAL_FLOCK=0
command -v flock >/dev/null 2>&1 && HAVE_REAL_FLOCK=1

ok() { PASS=$((PASS + 1)); echo "  ok   $1"; }
bad() { FAIL=$((FAIL + 1)); echo "  FAIL $1"; [ -n "${2:-}" ] && echo "       $2"; }

check() { # <description> <command...>
	local desc="$1"; shift
	if "$@"; then ok "$desc"; else bad "$desc"; fi
}
contains() { grep -q -- "$2" "$1" 2>/dev/null; }
not_contains() { ! grep -q -- "$2" "$1" 2>/dev/null; }

# ---------------------------------------------------------------------------
# sandbox

setup() {
	SB="$(mktemp -d)"
	INST="$SB/install"
	mkdir -p "$INST/deploy/watcher" "$INST/update-signal" "$INST/data" "$SB/bin" "$SB/state"
	cp "$SCRIPT_SRC" "$INST/deploy/watcher/update.sh"
	chmod +x "$INST/deploy/watcher/update.sh"
	: >"$INST/.env"
	: >"$SB/calls.log"
	export SB INST
	export FAKE_DIGEST="$D2" FAKE_CURRENT="$D1" FAKE_RUNNING=yes FAKE_HEALTH=healthy
	export FAKE_LATEST_FAIL=0 FAKE_PULL_FAIL=0 FAKE_UP_FAIL=0 FAKE_SNAPSHOT_FAIL=0 FAKE_BUSY_COUNT=0
	export FAKE_ROLLBACK_UP_FAIL=0 FAKE_HEALTH_AFTER_UP="" WARBLER_HEALTH_SLEEP=0

	cat >"$SB/bin/timeout" <<'T'
#!/usr/bin/env bash
shift
exec "$@"
T
	cat >"$SB/bin/sleep" <<'T'
#!/usr/bin/env bash
exit 0
T
	if [ "$HAVE_REAL_FLOCK" -eq 0 ]; then
		cat >"$SB/bin/flock" <<'T'
#!/usr/bin/env bash
exit 0
T
	fi
	cat >"$SB/bin/curl" <<'T'
#!/usr/bin/env bash
args="$*"
echo "curl $args" >>"$SB/calls.log"
case "$args" in
*"/token?"*) echo '{"token":"fake-token"}' ;;
*"/manifests/"*)
	[ "$FAKE_LATEST_FAIL" = "1" ] && exit 22
	printf 'HTTP/2 200\r\ncontent-type: application/vnd.oci.image.index.v1+json\r\nDocker-Content-Digest: %s\r\n\r\n' "$FAKE_DIGEST" ;;
*"/api/busy"*)
	n="$(cat "$SB/state/busy" 2>/dev/null || echo "$FAKE_BUSY_COUNT")"
	if [ "$n" -gt 0 ]; then echo $((n - 1)) >"$SB/state/busy"; echo '{"busy":true}'; else echo '{"busy":false}'; fi ;;
esac
T
	cat >"$SB/bin/docker" <<'T'
#!/usr/bin/env bash
echo "docker $*" >>"$SB/calls.log"
pin() { grep '^WARBLER_IMAGE=' "$INST/.env" 2>/dev/null | head -1 | cut -d= -f2-; }
case "$*" in
"compose ps -q warbler") if [ "$FAKE_RUNNING" = "yes" ] || [ -f "$SB/state/started" ]; then echo cid123; fi ;;
"inspect --format {{.State.Running}} cid123") if [ "$FAKE_RUNNING" = "yes" ] || [ -f "$SB/state/started" ]; then echo true; else echo false; fi ;;
"inspect --format {{.Image}} cid123") echo imgid ;;
"inspect --format {{index .RepoDigests 0}} imgid") echo "ghcr.io/autumnsgrove/warbler@$FAKE_CURRENT" ;;
"inspect --format {{.State.Health.Status}} cid123")
	if [ -f "$SB/state/upcount" ] && [ -n "$FAKE_HEALTH_AFTER_UP" ] && [ "$(cat "$SB/state/upcount")" -eq 1 ]; then echo "$FAKE_HEALTH_AFTER_UP"; else echo "$FAKE_HEALTH"; fi ;;
"compose pull warbler")
	echo "pulling $(pin)" ; [ "$FAKE_PULL_FAIL" = "1" ] && { printf '%s\n' "${FAKE_PULL_MESSAGE:-pull access denied}"; exit 1; }; exit 0 ;;
"compose up -d --force-recreate --no-deps warbler")
	n=$(( $(cat "$SB/state/upcount" 2>/dev/null || echo 0) + 1 )); echo $n >"$SB/state/upcount"
	echo "up with image: $(pin)" >>"$SB/calls.log"
	if [ "$n" -eq 1 ] && [ "$FAKE_UP_FAIL" = "1" ]; then echo "port is already allocated"; exit 1; fi
	if [ "$n" -ge 2 ] && [ "$FAKE_ROLLBACK_UP_FAIL" = "1" ]; then echo "cannot start"; exit 1; fi
	touch "$SB/state/started"   # like real Docker: after a successful up, a container exists
	exit 0 ;;
"compose exec -T warbler /app/warbler snapshot")
	[ "$FAKE_SNAPSHOT_FAIL" = "1" ] && { echo "database is locked"; exit 1; }
	mkdir -p "$INST/data/backups"; echo SNAP >"$INST/data/backups/pre-update.db"; exit 0 ;;
"compose stop warbler") exit 0 ;;
"compose logs --no-color --tail=30 warbler") echo "panic: could not open database" ;;
esac
exit 0
T
	chmod +x "$SB/bin/"*
	export PATH="$SB/bin:$REAL_PATH"
}

teardown() { export PATH="$REAL_PATH"; rm -rf "$SB"; }

run_watcher() { # [args]
	( cd "$INST" && "$INST/deploy/watcher/update.sh" "$@" ) >"$SB/out.log" 2>&1
	RC=$?
}

result_status() { sed -n 's/.*"status":"\([^"]*\)".*/\1/p' "$INST/update-signal/result" 2>/dev/null; }
env_pin() { grep '^WARBLER_IMAGE=' "$INST/.env" 2>/dev/null | head -1 | cut -d= -f2-; }
up_count() { grep -c '^docker compose up' "$SB/calls.log"; }

# ---------------------------------------------------------------------------
echo "bare start (what Meridian or a hand-typed systemctl start does)"
setup
run_watcher
check "exits 0" test "$RC" -eq 0
check "result is ok" test "$(result_status)" = "ok"
check "pins the new digest" test "$(env_pin)" = "$REPO@$D2"
check "pulled and recreated" contains "$SB/calls.log" "docker compose pull warbler"
check "available.json says up to date afterwards" contains "$INST/update-signal/available.json" '"update_available":false'
check "heartbeat written" test -s "$INST/update-signal/heartbeat"
teardown

echo "request file from the app"
setup
printf 'latest' >"$INST/update-signal/requested"
run_watcher
check "result is ok" test "$(result_status)" = "ok"
check "request file removed" test ! -e "$INST/update-signal/requested"
teardown

echo "an unexpected request is refused"
setup
printf '%s@sha256:cccc' "evil/image" >"$INST/update-signal/requested"
run_watcher
check "result is failed" test "$(result_status)" = "failed"
check "says it refused" contains "$INST/update-signal/result" "refusing"
check "never pulled anything" not_contains "$SB/calls.log" "compose pull"
check "request file removed" test ! -e "$INST/update-signal/requested"
teardown

echo "check only"
setup
printf 'check\n' >"$INST/update-signal/check"
echo "WARBLER_IMAGE=$REPO@$D1" >"$INST/.env"
run_watcher
check "writes available.json" contains "$INST/update-signal/available.json" '"update_available":true'
check "records the full latest digest" contains "$INST/update-signal/available.json" "$D2"
check "changes nothing" test "$(env_pin)" = "$REPO@$D1"
check "no pull or recreate" not_contains "$SB/calls.log" "docker compose pull"
check "check file removed" test ! -e "$INST/update-signal/check"
teardown

echo "already on the newest version"
setup
echo "WARBLER_IMAGE=$REPO@$D2" >"$INST/.env"
run_watcher
check "result is skipped" test "$(result_status)" = "skipped"
check "no pull" not_contains "$SB/calls.log" "compose pull"
teardown

echo "GHCR lookup fails"
setup
FAKE_LATEST_FAIL=1; export FAKE_LATEST_FAIL
printf 'latest' >"$INST/update-signal/requested"
run_watcher
check "result is failed" test "$(result_status)" = "failed"
check "mentions the lookup" contains "$INST/update-signal/result" "look up"
check "nothing pulled" not_contains "$SB/calls.log" "compose pull"
teardown

echo "GHCR returns a malformed digest"
setup
FAKE_DIGEST="sha256:tooshort"; export FAKE_DIGEST
run_watcher
check "result is failed" test "$(result_status)" = "failed"
check "nothing pulled" not_contains "$SB/calls.log" "compose pull"
teardown

echo "pull fails"
setup
echo "WARBLER_IMAGE=$REPO@$D1" >"$INST/.env"
FAKE_PULL_FAIL=1; export FAKE_PULL_FAIL
run_watcher
check "result is failed" test "$(result_status)" = "failed"
check "previous pin restored" test "$(env_pin)" = "$REPO@$D1"
check "running container never recreated" test "$(up_count)" -eq 0
teardown

echo "pull fails on a first-ever update (nothing pinned yet)"
setup
FAKE_PULL_FAIL=1; export FAKE_PULL_FAIL
run_watcher
check "result is failed" test "$(result_status)" = "failed"
check "no pin left pointing at the broken target" test -z "$(env_pin)"
teardown

echo "failure text with tabs, quotes, backslashes and line breaks still gives valid JSON"
setup
FAKE_PULL_FAIL=1; export FAKE_PULL_FAIL
# The quotes, backslash and control characters are the whole point of this test.
# shellcheck disable=SC2089,SC2090
FAKE_PULL_MESSAGE=$'pull failed:\t"quoted" back\\slash\r\nsecond line\x01end'
# shellcheck disable=SC2090
export FAKE_PULL_MESSAGE
run_watcher
check "result is failed" test "$(result_status)" = "failed"
check "result file is valid JSON" python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$INST/update-signal/result"
check "the reason survives" contains "$INST/update-signal/result" "second line"
unset FAKE_PULL_MESSAGE
teardown

echo "recreate fails, rollback works"
setup
echo "WARBLER_IMAGE=$REPO@$D1" >"$INST/.env"
FAKE_UP_FAIL=1; export FAKE_UP_FAIL
run_watcher
check "result is failed" test "$(result_status)" = "failed"
check "says recreate failed" contains "$INST/update-signal/result" "docker compose up failed"
check "does not claim the rollback failed" not_contains "$INST/update-signal/result" "AND rollback"
check "previous pin restored" test "$(env_pin)" = "$REPO@$D1"
check "recreated twice (new, then rollback)" test "$(up_count)" -eq 2
check "rollback started the previous image" contains "$SB/calls.log" "up with image: $REPO@$D1"
teardown

echo "recreate fails and rollback fails too"
setup
echo "WARBLER_IMAGE=$REPO@$D1" >"$INST/.env"
FAKE_UP_FAIL=1; FAKE_ROLLBACK_UP_FAIL=1; export FAKE_UP_FAIL FAKE_ROLLBACK_UP_FAIL
run_watcher
check "result is failed" test "$(result_status)" = "failed"
check "uses the distinct double-failure wording" contains "$INST/update-signal/result" "AND rollback"
teardown

echo "new version starts but is unhealthy"
setup
echo "WARBLER_IMAGE=$REPO@$D1" >"$INST/.env"
echo "NEW-DATABASE" >"$INST/data/warbler.db"
echo "x" >"$INST/data/warbler.db-wal"
FAKE_HEALTH_AFTER_UP=unhealthy; export FAKE_HEALTH_AFTER_UP
run_watcher
check "result is failed" test "$(result_status)" = "failed"
check "says it never became healthy" contains "$INST/update-signal/result" "never reported healthy"
check "previous pin restored" test "$(env_pin)" = "$REPO@$D1"
check "database snapshot restored" test "$(cat "$INST/data/warbler.db")" = "SNAP"
check "stale write-ahead file removed" test ! -e "$INST/data/warbler.db-wal"
check "rolled back" test "$(up_count)" -eq 2
teardown

echo "snapshot fails while Warbler is running"
setup
echo "WARBLER_IMAGE=$REPO@$D1" >"$INST/.env"
FAKE_SNAPSHOT_FAIL=1; export FAKE_SNAPSHOT_FAIL
run_watcher
check "result is failed" test "$(result_status)" = "failed"
check "says nothing was changed" contains "$INST/update-signal/result" "nothing was changed"
check "no pull" not_contains "$SB/calls.log" "compose pull"
check "pin untouched" test "$(env_pin)" = "$REPO@$D1"
teardown

echo "Warbler is not running (an update may be the fix)"
setup
FAKE_RUNNING=no; FAKE_CURRENT=unknown; export FAKE_RUNNING FAKE_CURRENT
run_watcher
check "no snapshot attempted" not_contains "$SB/calls.log" "snapshot"
check "still updates" test "$(env_pin)" = "$REPO@$D2"
teardown

echo "waits for an upload in progress"
setup
FAKE_BUSY_COUNT=3; export FAKE_BUSY_COUNT
run_watcher
check "result is ok" test "$(result_status)" = "ok"
check "asked about busy more than once" test "$(grep -c '/api/busy' "$SB/calls.log")" -ge 3
teardown

echo "following another tag (the rollback-test channel)"
setup
echo "WARBLER_UPDATE_TAG=broken-test" >"$INST/.env"
run_watcher
check "asks GHCR for that tag" contains "$SB/calls.log" "/manifests/broken-test"
check "never asked for latest" not_contains "$SB/calls.log" "/manifests/latest"
check "still updates by digest" test "$(env_pin)" = "$REPO@$D2"
teardown

echo "a malformed tag in .env is refused"
setup
echo "WARBLER_UPDATE_TAG=../../evil tag" >"$INST/.env"
run_watcher
check "result is failed" test "$(result_status)" = "failed"
check "says the tag is invalid" contains "$INST/update-signal/result" "not a valid tag"
check "no lookup, no pull" not_contains "$SB/calls.log" "manifests"
teardown

echo "timer tick with nothing waiting"
setup
run_watcher --tick
check "exits 0" test "$RC" -eq 0
check "heartbeat refreshed" test -s "$INST/update-signal/heartbeat"
check "no result written" test ! -e "$INST/update-signal/result"
check "no docker or curl calls" test ! -s "$SB/calls.log"
teardown

echo "timer tick with a check waiting"
setup
printf 'check\n' >"$INST/update-signal/check"
run_watcher --tick
check "answers the check" contains "$INST/update-signal/available.json" '"latest_digest"'
teardown

echo "second run while one is in progress"
if [ "$HAVE_REAL_FLOCK" -eq 1 ]; then
	setup
	(
		exec 200>"$INST/.update-watcher.lock"
		flock -n 200 || exit 9
		run_watcher
		echo "$RC" >"$SB/rc"
	)
	check "exits 0 quietly" test "$(cat "$SB/rc" 2>/dev/null)" = "0"
	check "says one is already running" contains "$SB/out.log" "already in progress"
	check "did nothing" test ! -e "$INST/update-signal/result"
	teardown
else
	SKIP=$((SKIP + 1)); echo "  skip (needs real flock; runs in CI on Linux)"
fi

echo
echo "passed: $PASS   failed: $FAIL   skipped: $SKIP"
[ "$FAIL" -eq 0 ]
