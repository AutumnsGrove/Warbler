// Package config reads Warbler's settings from environment variables.
//
// Everything is an environment variable because the app runs in a container
// whose compose file is the one place settings live. Nothing here is a secret.
package config

import (
	"fmt"
	"strings"
)

// LockMode says how strictly the Tailscale identity check is applied.
type LockMode string

const (
	// LockOff disables the check. For local development only.
	LockOff LockMode = "off"
	// LockLog records whether the identity header arrived but lets every
	// request through. Used once, to confirm the header reaches the server.
	LockLog LockMode = "log"
	// LockEnforce refuses requests without a valid identity header.
	LockEnforce LockMode = "enforce"
)

// Config is the full runtime configuration.
type Config struct {
	// Addr is the listen address inside the container.
	Addr string
	// DataDir holds the database, audio and series files (later phases).
	DataDir string
	// SignalDir is the folder shared with the host update watcher.
	SignalDir string
	// Lock is the identity-check mode.
	Lock LockMode
	// IdentityHeader is the header `tailscale serve` adds to proxied requests.
	IdentityHeader string
	// AllowedLogins limits which Tailscale logins may use the API. Empty
	// means any request that carries the header.
	AllowedLogins []string
	// AllowedHosts limits the Host header on locked routes. Empty disables
	// the check (and the server logs a warning).
	AllowedHosts []string
	// Deployment is "docker" in the container and "dev" otherwise. Shown in
	// Settings.
	Deployment string
}

// FromEnv builds a Config from a lookup function such as os.Getenv.
func FromEnv(getenv func(string) string) (Config, error) {
	c := Config{
		Addr:           withDefault(getenv("WARBLER_ADDR"), ":8080"),
		DataDir:        withDefault(getenv("WARBLER_DATA"), "./data"),
		SignalDir:      withDefault(getenv("WARBLER_SIGNAL_DIR"), "./update-signal"),
		Lock:           LockMode(withDefault(getenv("WARBLER_LOCK"), string(LockEnforce))),
		IdentityHeader: withDefault(getenv("WARBLER_IDENTITY_HEADER"), "Tailscale-User-Login"),
		AllowedLogins:  splitList(getenv("WARBLER_ALLOWED_LOGINS")),
		AllowedHosts:   splitList(getenv("WARBLER_ALLOWED_HOSTS")),
		Deployment:     withDefault(getenv("WARBLER_DEPLOYMENT"), "dev"),
	}
	switch c.Lock {
	case LockOff, LockLog, LockEnforce:
	default:
		return Config{}, fmt.Errorf("WARBLER_LOCK must be off, log or enforce, got %q", c.Lock)
	}
	return c, nil
}

func withDefault(v, def string) string {
	if strings.TrimSpace(v) == "" {
		return def
	}
	return strings.TrimSpace(v)
}

func splitList(v string) []string {
	var out []string
	for _, part := range strings.Split(v, ",") {
		if p := strings.TrimSpace(part); p != "" {
			out = append(out, p)
		}
	}
	return out
}
