// Package update is the app's half of the in-app update mechanism.
//
// The app never updates itself and never goes online. It writes small "signal
// files" into a folder shared with a watcher script that runs on the potato
// itself, and it reads the answers the watcher writes back. The design is in
// docs/update.md; the watcher is deploy/watcher/update.sh.
package update

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// File names inside the signal folder. They are shared with update.sh.
const (
	fileCheck     = "check"
	fileRequested = "requested"
	fileAvailable = "available.json"
	fileResult    = "result"
	fileHeartbeat = "heartbeat"
)

// requestedContent is the only thing the app ever writes into "requested".
// The app cannot name an image or a digest; the watcher decides what "latest"
// means, from one repository that is written into the watcher itself.
const requestedContent = "latest"

// heartbeatStaleAfter is how long the watcher's heartbeat may go unrefreshed
// before Settings says updates are not working. The timer fires every 10
// minutes, so 30 allows for two missed ticks.
const heartbeatStaleAfter = 30 * time.Minute

// ErrPending means an update request is already waiting for the watcher.
var ErrPending = errors.New("an update is already in progress")

// Available is the watcher's answer to a check.
type Available struct {
	Current         string `json:"current"`
	Latest          string `json:"latest"`
	LatestDigest    string `json:"latest_digest"`
	CheckedAt       string `json:"checked_at"`
	UpdateAvailable bool   `json:"update_available"`
}

// Result is the watcher's account of the most recent update.
type Result struct {
	Status     string `json:"status"` // ok, failed or skipped
	Detail     string `json:"detail"`
	Target     string `json:"target"`
	FinishedAt string `json:"finished_at"`
}

// Updater states shown in Settings.
const (
	UpdaterReady        = "ready"
	UpdaterNotInstalled = "not_installed"
	UpdaterStale        = "stale"
)

// Store reads and writes the signal folder.
type Store struct {
	Dir string
	Now func() time.Time
}

// NewStore returns a Store for dir that uses the real clock.
func NewStore(dir string) *Store { return &Store{Dir: dir, Now: time.Now} }

// RequestCheck asks the watcher to look up the newest version.
func (s *Store) RequestCheck() error { return s.writeAtomic(fileCheck, "check\n") }

// RequestUpdate asks the watcher to update to the newest version.
func (s *Store) RequestUpdate() error {
	if s.exists(fileRequested) {
		return ErrPending
	}
	return s.writeAtomic(fileRequested, requestedContent)
}

// Pending reports whether requests are still waiting for the watcher.
func (s *Store) Pending() (check, update bool) {
	return s.exists(fileCheck), s.exists(fileRequested)
}

// Available returns the last check result, or nil if there has not been one.
func (s *Store) Available() (*Available, error) {
	var a Available
	ok, err := s.readJSON(fileAvailable, &a)
	if err != nil || !ok {
		return nil, err
	}
	return &a, nil
}

// Result returns the last update outcome, or nil if there has not been one.
// A half-written or invalid file counts as no result.
func (s *Store) Result() (*Result, error) {
	var r Result
	ok, err := s.readJSON(fileResult, &r)
	if err != nil || !ok {
		return nil, err
	}
	return &r, nil
}

// UpdaterState reports whether the watcher looks installed and alive, and the
// time of its last heartbeat if known.
func (s *Store) UpdaterState() (state string, heartbeat time.Time) {
	data, err := os.ReadFile(filepath.Join(s.Dir, fileHeartbeat))
	if err != nil {
		return UpdaterNotInstalled, time.Time{}
	}
	t, err := time.Parse(time.RFC3339, strings.TrimSpace(string(data)))
	if err != nil {
		return UpdaterStale, time.Time{}
	}
	if s.Now().Sub(t) > heartbeatStaleAfter {
		return UpdaterStale, t
	}
	return UpdaterReady, t
}

func (s *Store) exists(name string) bool {
	_, err := os.Stat(filepath.Join(s.Dir, name))
	return err == nil
}

// readJSON decodes name into v. A missing file or invalid JSON returns
// ok=false with no error: the watcher writes atomically, so invalid content
// is treated as "not there yet" rather than a failure.
func (s *Store) readJSON(name string, v any) (ok bool, err error) {
	data, err := os.ReadFile(filepath.Join(s.Dir, name))
	if errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("reading %s: %w", name, err)
	}
	if json.Unmarshal(data, v) != nil {
		return false, nil
	}
	return true, nil
}

// writeAtomic writes content under a temporary name and renames it into
// place, so the watcher (which reacts the instant the final name appears)
// never sees half a file.
func (s *Store) writeAtomic(name, content string) error {
	if err := os.MkdirAll(s.Dir, 0o755); err != nil {
		return fmt.Errorf("creating signal folder: %w", err)
	}
	final := filepath.Join(s.Dir, name)
	tmp := filepath.Join(s.Dir, "."+name+".tmp")
	if err := os.WriteFile(tmp, []byte(content), 0o644); err != nil {
		return fmt.Errorf("writing %s: %w", name, err)
	}
	if err := os.Rename(tmp, final); err != nil {
		_ = os.Remove(tmp)
		return fmt.Errorf("finishing %s: %w", name, err)
	}
	return nil
}
