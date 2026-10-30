package update

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func newStore(t *testing.T) (*Store, string) {
	t.Helper()
	dir := t.TempDir()
	return &Store{Dir: dir, Now: func() time.Time { return time.Date(2026, 10, 30, 12, 0, 0, 0, time.UTC) }}, dir
}

func TestRequestUpdateWritesOnlyTheWordLatest(t *testing.T) {
	s, dir := newStore(t)
	if err := s.RequestUpdate(); err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(filepath.Join(dir, "requested"))
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != "latest" {
		t.Fatalf("requested = %q, want exactly \"latest\"", got)
	}
}

func TestRequestUpdateTwiceIsRefused(t *testing.T) {
	s, _ := newStore(t)
	if err := s.RequestUpdate(); err != nil {
		t.Fatal(err)
	}
	if err := s.RequestUpdate(); !errors.Is(err, ErrPending) {
		t.Fatalf("second request error = %v, want ErrPending", err)
	}
}

func TestNoTemporaryFilesLeftBehind(t *testing.T) {
	s, dir := newStore(t)
	_ = s.RequestCheck()
	_ = s.RequestUpdate()
	entries, _ := os.ReadDir(dir)
	for _, e := range entries {
		if e.Name() != "check" && e.Name() != "requested" {
			t.Errorf("unexpected file %q", e.Name())
		}
	}
}

func TestPending(t *testing.T) {
	s, _ := newStore(t)
	if c, u := s.Pending(); c || u {
		t.Fatal("nothing should be pending at first")
	}
	_ = s.RequestCheck()
	if c, u := s.Pending(); !c || u {
		t.Fatalf("pending = %v %v", c, u)
	}
}

func TestAvailableAndResultReadWhatTheWatcherWrote(t *testing.T) {
	s, dir := newStore(t)
	if a, _ := s.Available(); a != nil {
		t.Fatal("expected no result yet")
	}
	_ = os.WriteFile(filepath.Join(dir, "available.json"),
		[]byte(`{"current":"r1.a","latest":"r2.b","latest_digest":"sha256:x","checked_at":"t","update_available":true}`), 0o644)
	a, err := s.Available()
	if err != nil || a == nil || !a.UpdateAvailable || a.Latest != "r2.b" {
		t.Fatalf("available = %+v, err %v", a, err)
	}
	_ = os.WriteFile(filepath.Join(dir, "result"), []byte(`{"status":"failed","detail":"pull failed","target":"t","finished_at":"x"}`), 0o644)
	r, _ := s.Result()
	if r == nil || r.Status != "failed" || r.Detail != "pull failed" {
		t.Fatalf("result = %+v", r)
	}
}

func TestUnreadableResultIsAVisibleFailure(t *testing.T) {
	s, dir := newStore(t)
	// A raw tab inside a string is invalid JSON: this is what the real
	// watcher once wrote, and the app showed nothing at all.
	_ = os.WriteFile(filepath.Join(dir, "result"), []byte("{\"status\":\"failed\",\"detail\":\"a\tb\"}"), 0o644)
	r, err := s.Result()
	if err != nil || r == nil {
		t.Fatalf("result = %+v, err %v; want a failure the user can see", r, err)
	}
	if r.Status != "failed" || !strings.Contains(r.Detail, "could not be read") {
		t.Fatalf("result = %+v", r)
	}
}

func TestMissingResultIsNil(t *testing.T) {
	s, _ := newStore(t)
	if r, err := s.Result(); r != nil || err != nil {
		t.Fatalf("result = %+v, err %v; want nil, nil", r, err)
	}
}

func TestUnreadableAvailableIsIgnored(t *testing.T) {
	s, dir := newStore(t)
	_ = os.WriteFile(filepath.Join(dir, "available.json"), []byte(`{"current":`), 0o644)
	if a, err := s.Available(); a != nil || err != nil {
		t.Fatalf("available = %+v, err %v; want nil, nil", a, err)
	}
}

func TestUpdaterState(t *testing.T) {
	s, dir := newStore(t)
	if st, _ := s.UpdaterState(); st != UpdaterNotInstalled {
		t.Errorf("no heartbeat: %q", st)
	}
	hb := filepath.Join(dir, "heartbeat")
	_ = os.WriteFile(hb, []byte("2026-10-30T11:55:00Z\n"), 0o644)
	if st, _ := s.UpdaterState(); st != UpdaterReady {
		t.Errorf("fresh heartbeat: %q", st)
	}
	_ = os.WriteFile(hb, []byte("2026-10-30T10:00:00Z\n"), 0o644)
	if st, _ := s.UpdaterState(); st != UpdaterStale {
		t.Errorf("old heartbeat: %q", st)
	}
	_ = os.WriteFile(hb, []byte("garbage"), 0o644)
	if st, _ := s.UpdaterState(); st != UpdaterStale {
		t.Errorf("garbage heartbeat: %q", st)
	}
}
