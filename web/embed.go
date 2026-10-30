// Package web embeds the built frontend (web/build) into the Go binary.
//
// web/build/.gitkeep is committed so this compiles, and the Go tests run,
// before the frontend has been built. A release build runs `pnpm build`
// first, which fills the folder.
package web

import (
	"embed"
	"io/fs"
)

//go:embed all:build
var build embed.FS

// Build returns the built frontend, rooted at its index.html.
func Build() fs.FS {
	sub, err := fs.Sub(build, "build")
	if err != nil {
		panic(err) // cannot happen: "build" is embedded above
	}
	return sub
}
