// Package api is Warbler's HTTP surface: health, version, updates and the
// embedded web app. Sessions, settings and the rest arrive in later phases
// (see docs/data-api.md).
package api

import (
	"encoding/json"
	"errors"
	"io/fs"
	"log/slog"
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/AutumnsGrove/Warbler/server/internal/busy"
	"github.com/AutumnsGrove/Warbler/server/internal/config"
	"github.com/AutumnsGrove/Warbler/server/internal/security"
	"github.com/AutumnsGrove/Warbler/server/internal/update"
	"github.com/AutumnsGrove/Warbler/server/internal/version"
)

// Server wires the handlers together.
type Server struct {
	Cfg     config.Config
	Updates *update.Store
	Busy    *busy.Tracker
	Web     fs.FS
	Log     *slog.Logger
}

// Handler returns the complete HTTP handler, security guard included.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.healthz)
	mux.HandleFunc("GET /api/busy", s.busyHandler)
	mux.HandleFunc("GET /api/version", s.versionHandler)
	mux.HandleFunc("GET /api/whoami", s.whoami)
	mux.HandleFunc("POST /api/update/check", s.updateCheck)
	mux.HandleFunc("GET /api/update/available", s.updateAvailable)
	mux.HandleFunc("POST /api/update/start", s.updateStart)
	mux.HandleFunc("GET /api/update/status", s.updateStatus)
	mux.HandleFunc("/api/", func(w http.ResponseWriter, _ *http.Request) {
		writeError(w, http.StatusNotFound, "not_found", "There is nothing at this address.")
	})
	mux.HandleFunc("/", s.static)

	guard := &security.Guard{
		Mode:   s.Cfg.Lock,
		Header: s.Cfg.IdentityHeader,
		Logins: s.Cfg.AllowedLogins,
		Hosts:  s.Cfg.AllowedHosts,
		Exempt: isUnlocked,
		Log:    s.Log,
	}
	return s.logRequests(guard.Wrap(mux))
}

// isUnlocked lists the routes that skip the identity lock. Both are called on
// the potato itself (Docker's health check, Meridian, the update watcher), not
// through `tailscale serve`, so they cannot carry the identity header. Neither
// returns anything personal.
func isUnlocked(r *http.Request) bool {
	return r.URL.Path == "/healthz" || r.URL.Path == "/api/busy"
}

func (s *Server) healthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "version": version.Version})
}

func (s *Server) busyHandler(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]bool{"busy": s.Busy.Busy()})
}

func (s *Server) versionHandler(w http.ResponseWriter, _ *http.Request) {
	state, hb := s.Updates.UpdaterState()
	out := map[string]any{
		"version":    version.Version,
		"deployment": s.Cfg.Deployment,
		"updater":    map[string]any{"state": state},
	}
	if !hb.IsZero() {
		out["updater"] = map[string]any{"state": state, "heartbeat_at": hb.UTC().Format(time.RFC3339)}
	}
	writeJSON(w, http.StatusOK, out)
}

// whoami exists for the Phase 0 check that the Tailscale identity header
// really arrives. It reports whether the header is present, and the login.
func (s *Server) whoami(w http.ResponseWriter, r *http.Request) {
	login := strings.TrimSpace(r.Header.Get(s.Cfg.IdentityHeader))
	writeJSON(w, http.StatusOK, map[string]any{
		"lock":                    s.Cfg.Lock,
		"identity_header":         s.Cfg.IdentityHeader,
		"identity_header_present": login != "",
		"login":                   login,
	})
}

func (s *Server) updateCheck(w http.ResponseWriter, _ *http.Request) {
	if err := s.Updates.RequestCheck(); err != nil {
		s.Log.Error("writing check signal", "err", err)
		writeError(w, http.StatusInternalServerError, "signal_failed", "Could not ask for an update check.")
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]bool{"ok": true})
}

func (s *Server) updateAvailable(w http.ResponseWriter, _ *http.Request) {
	a, err := s.Updates.Available()
	if err != nil {
		s.Log.Error("reading available.json", "err", err)
		writeError(w, http.StatusInternalServerError, "read_failed", "Could not read the update check.")
		return
	}
	check, _ := s.Updates.Pending()
	writeJSON(w, http.StatusOK, map[string]any{"available": a, "check_pending": check})
}

// updateStart ignores the request body on purpose. The app cannot be told
// which image to run; the watcher decides what "latest" means.
func (s *Server) updateStart(w http.ResponseWriter, _ *http.Request) {
	err := s.Updates.RequestUpdate()
	switch {
	case errors.Is(err, update.ErrPending):
		writeError(w, http.StatusConflict, "update_pending", "An update is already in progress.")
	case err != nil:
		s.Log.Error("writing update signal", "err", err)
		writeError(w, http.StatusInternalServerError, "signal_failed", "Could not ask for an update.")
	default:
		writeJSON(w, http.StatusAccepted, map[string]bool{"ok": true})
	}
}

func (s *Server) updateStatus(w http.ResponseWriter, _ *http.Request) {
	res, err := s.Updates.Result()
	if err != nil {
		s.Log.Error("reading result", "err", err)
		writeError(w, http.StatusInternalServerError, "read_failed", "Could not read the update status.")
		return
	}
	_, pending := s.Updates.Pending()
	// While a request is pending, any result on disk belongs to an earlier
	// run, so it is not reported as this run's outcome.
	if pending {
		res = nil
	}
	writeJSON(w, http.StatusOK, map[string]any{"pending": pending, "result": res})
}

// static serves the embedded web app. Unknown paths fall back to index.html
// so the single-page app can handle its own routes.
func (s *Server) static(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
	if name == "" {
		name = "index.html"
	}
	f, err := s.Web.Open(name)
	if err != nil {
		name = "index.html"
		f, err = s.Web.Open(name)
	}
	if err != nil {
		http.Error(w, "the web app has not been built", http.StatusServiceUnavailable)
		return
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil || info.IsDir() {
		http.NotFound(w, r)
		return
	}
	if strings.HasPrefix(name, "_app/immutable/") {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	} else {
		w.Header().Set("Cache-Control", "no-cache")
	}
	if rs, ok := f.(readSeeker); ok {
		http.ServeContent(w, r, name, info.ModTime(), rs)
		return
	}
	http.NotFound(w, r)
}

type readSeeker interface {
	Read(p []byte) (int, error)
	Seek(offset int64, whence int) (int64, error)
}

func (s *Server) logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		// Path only, never the query string, and nothing from the body.
		s.Log.Info("request", "method", r.Method, "path", r.URL.Path, "status", rec.status, "ms", time.Since(start).Milliseconds())
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]any{"error": map[string]string{"code": code, "message": message}})
}
