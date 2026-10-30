// Package version holds the build stamp. The release build sets Version to
// r<commit count>.<short sha> (the same format Polaris uses) through
// -ldflags; a plain `go build` reports "dev".
package version

// Version identifies this build. Set at link time:
//
//	-ldflags "-X github.com/AutumnsGrove/Warbler/server/internal/version.Version=r12.abc1234"
var Version = "dev"
