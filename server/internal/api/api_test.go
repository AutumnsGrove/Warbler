package api

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/AutumnsGrove/Warbler/server/internal/busy"
	"github.com/AutumnsGrove/Warbler/server/internal/config"
	"github.com/AutumnsGrove/Warbler/server/internal/update"
	"github.com/AutumnsGrove/Warbler/server/internal/version"
)

func newServer(t *testing.T, lock config.LockMode) (*Server, string) {
	t.Helper()
	dir := t.TempDir()
	return &Server{
		Cfg:     config.Config{Lock: lock, IdentityHeader: "Tailscale-User-Login", Deployment: "docker"},
		Updates: update.NewStore(dir),
		Busy:    &busy.Tracker{},
		Web: fstest.MapFS{
			"index.html":                {Data: []byte("<html>app</html>")},
			"_app/immutable/chunk-1.js": {Data: []byte("x")},
			"manifest.webmanifest":      {Data: []byte("{}")},
		},
		Log: slog.New(slog.NewTextHandler(io.Discard, nil)),
	}, dir
}

func call(s *Server, method, path string, header map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, nil)
	for k, v := range header {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)
	return rec
}

func decode(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &m); err != nil {
		t.Fatalf("body is not JSON: %q (%v)", rec.Body.String(), err)
	}
	return m
}

func TestHealthzReturnsOnlyStatusAndVersion(t *testing.T) {
	s, _ := newServer(t, config.LockEnforce)
	rec := call(s, "GET", "/healthz", nil) // no identity header: must still work
	if rec.Code != 200 {
		t.Fatalf("status %d", rec.Code)
	}
	m := decode(t, rec)
	if len(m) != 2 || m["status"] != "ok" || m["version"] != version.Version {
		t.Fatalf("healthz leaks or is wrong: %v", m)
	}
}

func TestAPIIsLockedButBusyIsNot(t *testing.T) {
	s, _ := newServer(t, config.LockEnforce)
	if rec := call(s, "GET", "/api/version", nil); rec.Code != http.StatusForbidden {
		t.Errorf("version without header: %d, want 403", rec.Code)
	}
	if rec := call(s, "GET", "/api/busy", nil); rec.Code != 200 {
		t.Errorf("busy without header: %d, want 200", rec.Code)
	}
	if rec := call(s, "GET", "/api/version", map[string]string{"Tailscale-User-Login": "a@x.com"}); rec.Code != 200 {
		t.Errorf("version with header: %d, want 200", rec.Code)
	}
}

func TestBusyFollowsTheTracker(t *testing.T) {
	s, _ := newServer(t, config.LockEnforce)
	if decode(t, call(s, "GET", "/api/busy", nil))["busy"] != false {
		t.Fatal("expected idle")
	}
	done := s.Busy.Begin()
	if decode(t, call(s, "GET", "/api/busy", nil))["busy"] != true {
		t.Fatal("expected busy")
	}
	done()
}

func TestUpdateStartWritesLatestAndIgnoresTheBody(t *testing.T) {
	s, dir := newServer(t, config.LockOff)
	req := httptest.NewRequest("POST", "/api/update/start", strings.NewReader(`{"image":"evil/image@sha256:abc"}`))
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusAccepted {
		t.Fatalf("status %d", rec.Code)
	}
	got, _ := os.ReadFile(filepath.Join(dir, "requested"))
	if string(got) != "latest" {
		t.Fatalf("requested = %q; the app must never pass anything the browser sent", got)
	}
	if rec := call(s, "POST", "/api/update/start", nil); rec.Code != http.StatusConflict {
		t.Errorf("second start = %d, want 409", rec.Code)
	}
}

func TestUpdateStatusHidesOldResultWhilePending(t *testing.T) {
	s, dir := newServer(t, config.LockOff)
	_ = os.WriteFile(filepath.Join(dir, "result"), []byte(`{"status":"failed","detail":"old","target":"t","finished_at":"x"}`), 0o644)
	m := decode(t, call(s, "GET", "/api/update/status", nil))
	if m["pending"] != false || m["result"] == nil {
		t.Fatalf("idle status = %v", m)
	}
	_ = s.Updates.RequestUpdate()
	m = decode(t, call(s, "GET", "/api/update/status", nil))
	if m["pending"] != true || m["result"] != nil {
		t.Fatalf("pending status must not show the earlier run's result: %v", m)
	}
}

func TestVersionReportsUpdaterState(t *testing.T) {
	s, _ := newServer(t, config.LockOff)
	m := decode(t, call(s, "GET", "/api/version", nil))
	up := m["updater"].(map[string]any)
	if m["deployment"] != "docker" || up["state"] != "not_installed" {
		t.Fatalf("version = %v", m)
	}
}

func TestUnknownAPIPathIsJSON404(t *testing.T) {
	s, _ := newServer(t, config.LockOff)
	rec := call(s, "GET", "/api/nope", nil)
	if rec.Code != 404 || !strings.Contains(rec.Header().Get("Content-Type"), "json") {
		t.Fatalf("got %d %q", rec.Code, rec.Header().Get("Content-Type"))
	}
}

func TestStaticFallbackAndCaching(t *testing.T) {
	s, _ := newServer(t, config.LockOff)
	if rec := call(s, "GET", "/settings", nil); rec.Code != 200 || !strings.Contains(rec.Body.String(), "app") {
		t.Errorf("SPA route should fall back to index.html: %d %q", rec.Code, rec.Body.String())
	}
	if rec := call(s, "GET", "/_app/immutable/chunk-1.js", nil); !strings.Contains(rec.Header().Get("Cache-Control"), "immutable") {
		t.Errorf("hashed assets should be cached: %q", rec.Header().Get("Cache-Control"))
	}
	if rec := call(s, "GET", "/", nil); rec.Header().Get("Cache-Control") != "no-cache" {
		t.Errorf("index.html must not be cached: %q", rec.Header().Get("Cache-Control"))
	}
}

func TestAPIResponsesAreNotCached(t *testing.T) {
	s, _ := newServer(t, config.LockOff)
	if rec := call(s, "GET", "/api/version", nil); rec.Header().Get("Cache-Control") != "no-store" {
		t.Errorf("Cache-Control = %q", rec.Header().Get("Cache-Control"))
	}
}

func TestWhoamiReportsHeaderPresence(t *testing.T) {
	s, _ := newServer(t, config.LockLog)
	if m := decode(t, call(s, "GET", "/api/whoami", nil)); m["identity_header_present"] != false {
		t.Errorf("no header: %v", m)
	}
	m := decode(t, call(s, "GET", "/api/whoami", map[string]string{"Tailscale-User-Login": "me@x.com"}))
	if m["identity_header_present"] != true || m["login"] != "me@x.com" {
		t.Errorf("with header: %v", m)
	}
}
