package config

import "testing"

func env(m map[string]string) func(string) string {
	return func(k string) string { return m[k] }
}

func TestDefaults(t *testing.T) {
	c, err := FromEnv(env(nil))
	if err != nil {
		t.Fatal(err)
	}
	if c.Lock != LockEnforce {
		t.Errorf("lock default = %q, want enforce (safe by default)", c.Lock)
	}
	if c.Addr != ":8080" || c.Deployment != "dev" || c.IdentityHeader != "Tailscale-User-Login" {
		t.Errorf("unexpected defaults: %+v", c)
	}
}

func TestListsAreTrimmedAndEmptiesDropped(t *testing.T) {
	c, err := FromEnv(env(map[string]string{
		"WARBLER_ALLOWED_LOGINS": " a@x.com , ,b@y.com ",
		"WARBLER_ALLOWED_HOSTS":  "lepotato.ts.net,lepotato",
	}))
	if err != nil {
		t.Fatal(err)
	}
	if len(c.AllowedLogins) != 2 || c.AllowedLogins[0] != "a@x.com" || c.AllowedLogins[1] != "b@y.com" {
		t.Errorf("logins = %v", c.AllowedLogins)
	}
	if len(c.AllowedHosts) != 2 {
		t.Errorf("hosts = %v", c.AllowedHosts)
	}
}

func TestBadLockModeIsRefused(t *testing.T) {
	if _, err := FromEnv(env(map[string]string{"WARBLER_LOCK": "maybe"})); err == nil {
		t.Fatal("expected an error for an unknown lock mode")
	}
}
