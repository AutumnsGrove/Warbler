# syntax=docker/dockerfile:1
#
# Warbler image. Built by GitHub Actions for linux/amd64 and linux/arm64 (the
# potato is arm64) and published to ghcr.io/autumnsgrove/warbler. The potato
# only ever pulls a finished image; it never builds one.
#
# Same shape as Polaris's Dockerfile: the two build stages are pinned to the
# build machine's own architecture so nothing runs under emulation (the web
# build is plain JS/CSS/HTML, and Go cross-compiles natively), and only the
# tiny final stage is assembled per target.

# --- web build ---------------------------------------------------------
# web/build/ is not committed (only a placeholder is), so this stage builds it
# fresh from web/src every time.
FROM --platform=$BUILDPLATFORM node:22-bookworm AS web-build
WORKDIR /web
COPY web/package.json web/pnpm-lock.yaml web/pnpm-workspace.yaml web/.npmrc ./
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate && \
    pnpm install --frozen-lockfile
COPY web/ .
RUN pnpm run build

# --- Go build ----------------------------------------------------------
FROM --platform=$BUILDPLATFORM golang:1.26-alpine AS go-build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
COPY --from=web-build /web/build ./web/build

# VERSION is r<commit count>.<short sha>, passed in by CI. A local build with
# no --build-arg reports "dev-docker".
ARG VERSION=dev-docker
ARG TARGETOS
ARG TARGETARCH
# CGO_ENABLED=0: the server has no C dependencies, so the binary is fully
# static and cross-compiles with just GOOS and GOARCH.
RUN --mount=type=cache,target=/root/.cache/go-build,id=warbler-go-${TARGETOS}-${TARGETARCH} \
    CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    go build -trimpath \
      -ldflags="-s -w -X github.com/AutumnsGrove/Warbler/server/internal/version.Version=${VERSION}" \
      -o /out/warbler ./server/cmd/warbler

# --- runtime -----------------------------------------------------------
# Distroless: the program, CA certificates and nothing else. No shell, no
# package manager. Health checks use the program itself (see HEALTHCHECK).
FROM gcr.io/distroless/static-debian12:nonroot

# Links the published package to this repository, so GitHub shows it there and
# it inherits the repository's visibility.
LABEL org.opencontainers.image.source="https://github.com/AutumnsGrove/Warbler" \
      org.opencontainers.image.description="Warbler: a private voice practice tool"

COPY --from=go-build /out/warbler /app/warbler

# Runs as uid 1000 so files in the bind-mounted folders belong to the same
# user that owns them on the potato. Compose can override with `user:`.
USER 1000:1000
ENV WARBLER_ADDR=:8080 \
    WARBLER_DATA=/data \
    WARBLER_SIGNAL_DIR=/update-signal \
    WARBLER_DEPLOYMENT=docker
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["/app/warbler", "healthcheck"]

ENTRYPOINT ["/app/warbler"]
CMD ["run"]
