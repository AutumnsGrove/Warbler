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

// Available returns the last check result, or nil if there has not been one or
// it cannot be read (the app then simply asks again).
func (s *Store) Available() (*Available, error) {
	var a Available
	state, err := s.readJSON(fileAvailable, &a)
	if err != nil || state != fileValid {
		return nil, err
	}
	return &a, nil
}

// Result returns the last update outcome, or nil if there has not been one.
//
// A result file that exists but cannot be read counts as a failed update with
// an explanation, never as "no result". The watcher writes it atomically, so
// unreadable content means something went wrong, and the one thing the app must
// not do then is look as if nothing happened. (The real rollback test once hid
// a failed update this way, when a tab character in Docker's log output made the
// file invalid.)
func (s *Store) Result() (*Result, error) {
	var r Result
	state, err := s.readJSON(fileResult, &r)
	switch {
	case err != nil:
		return nil, err
	case state == fileMissing:
		return nil, nil
	case state == fileInvalid:
		return &Result{
			Status:     "failed",
			Detail:     "The update finished, but its result could not be read. Check the potato: journalctl -u warbler-update.service",
			FinishedAt: s.Now().UTC().Format(time.RFC3339),
		}, nil
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

type fileState int

const (
	fileMissing fileState = iota
	fileValid
	fileInvalid
)

// readJSON decodes name into v and says whether the file was missing, valid or
// present but not valid JSON.
func (s *Store) readJSON(name string, v any) (fileState, error) {
	data, err := os.ReadFile(filepath.Join(s.Dir, name))
	if errors.Is(err, os.ErrNotExist) {
		return fileMissing, nil
	}
	if err != nil {
		return fileMissing, fmt.Errorf("reading %s: %w", name, err)
	}
	if json.Unmarshal(data, v) != nil {
		return fileInvalid, nil
	}
	return fileValid, nil
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
