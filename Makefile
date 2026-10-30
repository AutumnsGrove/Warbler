# Warbler. Run `make help` to list the commands.

VERSION ?= r$(shell git rev-list --count HEAD 2>/dev/null || echo 0).$(shell git rev-parse --short HEAD 2>/dev/null || echo dev)
LDFLAGS := -s -w -X github.com/AutumnsGrove/Warbler/server/internal/version.Version=$(VERSION)
IMAGE   ?= ghcr.io/autumnsgrove/warbler
DEV_PORT ?= 8892

.DEFAULT_GOAL := help
.PHONY: help dev web build build-arm64 test test-go test-web test-scripts test-watcher lint icons docker docker-run deploy clean

help: ## List the commands
	@grep -E '^[a-zA-Z0-9_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*## "}{printf "  %-14s %s\n", $$1, $$2}'

dev: ## Go API (identity lock off) and the Vite dev server. Open the Vite address on your phone via tailscale serve
	@echo "Go API on 127.0.0.1:$(DEV_PORT), Vite dev server on :5173. Ctrl-C stops both."
	@trap 'kill 0' INT TERM EXIT; \
	WARBLER_LOCK=off WARBLER_ADDR=127.0.0.1:$(DEV_PORT) WARBLER_SIGNAL_DIR=./.dev/update-signal go run ./server/cmd/warbler run & \
	cd web && WARBLER_DEV_API=http://127.0.0.1:$(DEV_PORT) pnpm dev --host

web: ## Build the web app into web/build
	cd web && pnpm install --frozen-lockfile && pnpm build

build: web ## Build the web app and the server binary into bin/warbler
	CGO_ENABLED=0 go build -trimpath -ldflags "$(LDFLAGS)" -o bin/warbler ./server/cmd/warbler

build-arm64: web ## Cross-build the server for the potato (arm64 Linux) into bin/warbler-linux-arm64
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -trimpath -ldflags "$(LDFLAGS)" -o bin/warbler-linux-arm64 ./server/cmd/warbler

test: test-go test-web test-scripts test-watcher ## Run every automated test (needs no recordings)

test-go: ## Go tests, with the race detector
	go vet ./...
	go test -race ./...

test-web: ## Web type check, unit tests, build, and the no-outside-addresses check
	cd web && pnpm check && pnpm test && pnpm build
	node scripts/check-no-external.mjs web/build

test-scripts: ## Tests for the repo's helper scripts
	node --test scripts/check-no-external.test.mjs

test-watcher: ## Tests for the host update watcher (fake docker and curl)
	shellcheck -x deploy/watcher/update.sh deploy/install.sh deploy/watcher/test.sh
	bash deploy/watcher/test.sh

lint: ## gofmt check
	@test -z "$$(gofmt -l server web)" || (gofmt -l server web; echo "gofmt needed"; exit 1)

icons: ## Regenerate the app icons
	python3 tools/icons/make_icons.py

docker: ## Build the image for this machine (tag warbler:dev)
	docker build --build-arg VERSION=$(VERSION) -t warbler:dev .

docker-run: docker ## Build and run the image locally on port 8892 with the lock off
	mkdir -p .dev/data .dev/update-signal
	docker run --rm -p 127.0.0.1:8892:8080 -e WARBLER_LOCK=off \
		-v "$$PWD/.dev/data:/data" -v "$$PWD/.dev/update-signal:/update-signal" warbler:dev

deploy: ## Release: push to main, CI publishes the image, then update from Settings, Meridian or the potato
	@echo "Warbler releases through GitHub:"
	@echo "  1. git push origin main  (CI runs the tests, then publishes $(IMAGE))"
	@echo "  2. Update the potato from Warbler's Settings, from Meridian, or run:"
	@echo "       sudo systemctl start warbler-update.service"
	@if [ -n "$(POTATO)" ]; then echo "Starting the update on $(POTATO) ..."; ssh $(POTATO) sudo systemctl start warbler-update.service; fi

clean: ## Remove build output
	rm -rf bin .dev web/build/* web/.svelte-kit
	touch web/build/.gitkeep
