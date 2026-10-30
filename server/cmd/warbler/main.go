// Command warbler is the Warbler server: it serves the web app and the API.
//
// Subcommands:
//
//	warbler run          start the server (the default)
//	warbler healthcheck  exit 0 if a running server answers /healthz (used by Docker)
//	warbler snapshot     take a database snapshot (used by the update watcher)
//	warbler version      print the version
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/AutumnsGrove/Warbler/server/internal/api"
	"github.com/AutumnsGrove/Warbler/server/internal/busy"
	"github.com/AutumnsGrove/Warbler/server/internal/config"
	"github.com/AutumnsGrove/Warbler/server/internal/update"
	"github.com/AutumnsGrove/Warbler/server/internal/version"
	"github.com/AutumnsGrove/Warbler/web"
)

func main() {
	cmd := "run"
	if len(os.Args) > 1 {
		cmd = os.Args[1]
	}
	cfg, err := config.FromEnv(os.Getenv)
	if err != nil {
		fmt.Fprintln(os.Stderr, "warbler:", err)
		os.Exit(2)
	}

	switch cmd {
	case "run":
		os.Exit(run(cfg))
	case "healthcheck":
		os.Exit(healthcheck(cfg))
	case "snapshot":
		// There is no database until Phase 2. The update watcher calls this
		// before every update, so it must succeed now and start doing real
		// work when the database arrives.
		fmt.Println("no database yet; nothing to snapshot")
	case "version":
		fmt.Println(version.Version)
	default:
		fmt.Fprintf(os.Stderr, "warbler: unknown command %q\n", cmd)
		os.Exit(2)
	}
}

func run(cfg config.Config) int {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if cfg.Lock == config.LockEnforce && len(cfg.AllowedHosts) == 0 {
		log.Warn("WARBLER_ALLOWED_HOSTS is empty: the Host header is not being checked")
	}
	if cfg.Lock != config.LockEnforce {
		log.Warn("the identity lock is not enforced", "mode", cfg.Lock)
	}

	srv := &api.Server{
		Cfg:     cfg,
		Updates: update.NewStore(cfg.SignalDir),
		Busy:    &busy.Tracker{},
		Web:     web.Build(),
		Log:     log,
	}
	httpSrv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       2 * time.Minute,
		// No overall Read/WriteTimeout: session uploads (later phases) are
		// large and arrive over a phone connection.
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	errc := make(chan error, 1)
	go func() {
		log.Info("warbler starting", "version", version.Version, "addr", cfg.Addr, "deployment", cfg.Deployment)
		errc <- httpSrv.ListenAndServe()
	}()

	select {
	case err := <-errc:
		if !errors.Is(err, http.ErrServerClosed) {
			log.Error("server stopped", "err", err)
			return 1
		}
	case <-ctx.Done():
		log.Info("shutting down")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := httpSrv.Shutdown(shutdownCtx); err != nil {
			log.Error("shutdown", "err", err)
			return 1
		}
	}
	return 0
}

// healthcheck asks the local server for /healthz. The final Docker image has
// no shell, wget or curl, so the binary checks itself.
func healthcheck(cfg config.Config) int {
	_, port, err := net.SplitHostPort(cfg.Addr)
	if err != nil {
		fmt.Fprintln(os.Stderr, "healthcheck: bad WARBLER_ADDR:", err)
		return 1
	}
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get("http://127.0.0.1:" + port + "/healthz")
	if err != nil {
		fmt.Fprintln(os.Stderr, "healthcheck:", err)
		return 1
	}
	defer resp.Body.Close()
	var body struct {
		Status string `json:"status"`
	}
	if resp.StatusCode != http.StatusOK || json.NewDecoder(resp.Body).Decode(&body) != nil || body.Status != "ok" {
		fmt.Fprintln(os.Stderr, "healthcheck: unhealthy response", resp.StatusCode)
		return 1
	}
	return 0
}
