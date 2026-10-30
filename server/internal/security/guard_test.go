package security

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/AutumnsGrove/Warbler/server/internal/config"
)

func newGuard(mode config.LockMode, logins, hosts []string) *Guard {
	return &Guard{
		Mode: mode, Header: "Tailscale-User-Login", Logins: logins, Hosts: hosts,
		Exempt: func(r *http.Request) bool { return r.URL.Path == "/healthz" },
		Log:    slog.New(slog.NewTextHandler(io.Discard, nil)),
	}
}

func do(g *Guard, path, host, login string) *httptest.ResponseRecorder {
	h := g.Wrap(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) }))
	req := httptest.NewRequest(http.MethodGet, path, nil)
	if host != "" {
		req.Host = host
	}
	if login != "" {
		req.Header.Set("Tailscale-User-Login", login)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestEnforceRefusesMissingHeader(t *testing.T) {
	if got := do(newGuard(config.LockEnforce, nil, nil), "/api/version", "", "").Code; got != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", got)
	}
}

func TestEnforceAllowsAnyLoginWhenNoneListed(t *testing.T) {
	if got := do(newGuard(config.LockEnforce, nil, nil), "/api/version", "", "a@x.com").Code; got != http.StatusOK {
		t.Fatalf("status = %d, want 200", got)
	}
}

func TestEnforceChecksTheLoginList(t *testing.T) {
	g := newGuard(config.LockEnforce, []string{"me@x.com"}, nil)
	if got := do(g, "/api/version", "", "other@x.com").Code; got != http.StatusForbidden {
		t.Errorf("other login: %d, want 403", got)
	}
	if got := do(g, "/api/version", "", "me@x.com").Code; got != http.StatusOK {
		t.Errorf("listed login: %d, want 200", got)
	}
}

func TestHostCheck(t *testing.T) {
	g := newGuard(config.LockEnforce, nil, []string{"lepotato.ts.net"})
	if got := do(g, "/api/version", "evil.example", "a@x.com").Code; got != http.StatusForbidden {
		t.Errorf("wrong host: %d, want 403", got)
	}
	if got := do(g, "/api/version", "LEPOTATO.ts.net:443", "a@x.com").Code; got != http.StatusOK {
		t.Errorf("right host with port and different case: %d, want 200", got)
	}
}

func TestHealthzIsExemptFromEverything(t *testing.T) {
	g := newGuard(config.LockEnforce, []string{"me@x.com"}, []string{"lepotato.ts.net"})
	if got := do(g, "/healthz", "localhost:8892", "").Code; got != http.StatusOK {
		t.Fatalf("healthz = %d, want 200", got)
	}
}

func TestLogModeLetsEverythingThrough(t *testing.T) {
	if got := do(newGuard(config.LockLog, nil, nil), "/api/version", "", "").Code; got != http.StatusOK {
		t.Fatalf("log mode = %d, want 200", got)
	}
}

func TestOffModeLetsEverythingThrough(t *testing.T) {
	if got := do(newGuard(config.LockOff, []string{"x"}, []string{"y"}), "/api/version", "z", "").Code; got != http.StatusOK {
		t.Fatalf("off mode = %d, want 200", got)
	}
}

func TestSecurityHeadersOnEveryResponse(t *testing.T) {
	for _, path := range []string{"/healthz", "/api/version"} {
		rec := do(newGuard(config.LockEnforce, nil, nil), path, "", "a@x.com")
		if rec.Header().Get("X-Content-Type-Options") != "nosniff" || rec.Header().Get("Permissions-Policy") == "" {
			t.Errorf("%s missing security headers: %v", path, rec.Header())
		}
	}
}
