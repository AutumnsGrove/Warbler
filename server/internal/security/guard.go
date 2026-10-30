// Package security holds the checks that stand in front of the API.
//
// Warbler has no passwords. The tailnet is the boundary, and this package is
// the second lock: `tailscale serve` adds a header naming the signed-in
// Tailscale user, and the server refuses API requests that do not carry it.
// That also proves a request came through Tailscale and not from some other
// program on the same machine.
package security

import (
	"encoding/json"
	"log/slog"
	"net"
	"net/http"
	"slices"
	"strings"

	"github.com/AutumnsGrove/Warbler/server/internal/config"
)

// Guard checks the Host name and the Tailscale identity header.
type Guard struct {
	Mode   config.LockMode
	Header string
	// Logins limits who may use the API. Empty means any non-empty header.
	Logins []string
	// Hosts limits the Host header. Empty disables the host check.
	Hosts []string
	// Exempt reports routes that skip the lock (health checks that Docker and
	// Meridian call directly on the potato).
	Exempt func(r *http.Request) bool
	Log    *slog.Logger
}

// Wrap returns next behind the guard. Security headers are added to every
// response, including exempt routes.
func (g *Guard) Wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		setSecurityHeaders(w)

		if g.Exempt != nil && g.Exempt(r) {
			next.ServeHTTP(w, r)
			return
		}
		if g.Mode == config.LockOff {
			next.ServeHTTP(w, r)
			return
		}

		if len(g.Hosts) > 0 && !g.hostAllowed(r.Host) {
			g.deny(w, r, "host_not_allowed", "This address is not one Warbler answers on.")
			return
		}

		login := strings.TrimSpace(r.Header.Get(g.Header))
		ok := login != "" && (len(g.Logins) == 0 || slices.Contains(g.Logins, login))

		if g.Mode == config.LockLog {
			g.Log.Info("identity header check", "present", login != "", "allowed", ok, "path", r.URL.Path)
			next.ServeHTTP(w, r)
			return
		}
		if !ok {
			g.deny(w, r, "not_signed_in", "Open Warbler through your Tailscale address.")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (g *Guard) hostAllowed(hostport string) bool {
	host := hostport
	if h, _, err := net.SplitHostPort(hostport); err == nil {
		host = h
	}
	host = strings.ToLower(strings.Trim(host, "[]"))
	for _, allowed := range g.Hosts {
		if strings.EqualFold(allowed, host) {
			return true
		}
	}
	return false
}

func (g *Guard) deny(w http.ResponseWriter, r *http.Request, code, message string) {
	g.Log.Warn("request refused", "code", code, "path", r.URL.Path)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusForbidden)
	_ = json.NewEncoder(w).Encode(map[string]any{"error": map[string]string{"code": code, "message": message}})
}

// setSecurityHeaders applies the headers every response carries. The page's
// own content policy (own files only, no outside addresses) is added by the
// build as a meta tag with exact script hashes, so it is not repeated here.
func setSecurityHeaders(w http.ResponseWriter) {
	h := w.Header()
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("Referrer-Policy", "no-referrer")
	h.Set("X-Frame-Options", "DENY")
	h.Set("Permissions-Policy", "microphone=(self), camera=(), geolocation=()")
}
