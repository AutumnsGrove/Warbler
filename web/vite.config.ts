import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// The Go server (server/cmd/warbler) serves this build and the API on one
// origin. In development, Vite serves the page and forwards API calls to a
// local Go server (started by `make dev`, with the identity lock off).
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, '.', 'WARBLER_');
	const goServer = env.WARBLER_DEV_API ?? 'http://127.0.0.1:8892';
	return {
		plugins: [
			sveltekit({
				compilerOptions: {
					// Force runes mode for the project, except for libraries.
					runes: ({ filename }) =>
						filename.split(/[/\\]/).includes('node_modules') ? undefined : true
				},
				// Single-page app: the Go server falls back to index.html for any
				// route it does not know, so one fallback page is enough.
				adapter: adapter({ fallback: 'index.html', precompress: false, strict: false }),
				// The page may load only its own files: no outside scripts, fonts,
				// images or connections. SvelteKit adds exact hashes for the one
				// inline start-up script, so 'unsafe-inline' is not needed for scripts.
				csp: {
					mode: 'hash',
					directives: {
						'default-src': ['none'],
						'script-src': ['self'],
						'style-src': ['self', 'unsafe-inline'],
						'img-src': ['self', 'data:'],
						'font-src': ['self'],
						'connect-src': ['self'],
						'media-src': ['self', 'blob:'],
						'worker-src': ['self', 'blob:'],
						'manifest-src': ['self'],
						'base-uri': ['self'],
						'form-action': ['self'],
						'frame-ancestors': ['none']
					}
				}
			})
		],
		server: {
			host: true,
			allowedHosts: true,
			proxy: {
				'/api': goServer,
				'/healthz': goServer
			}
		},
		test: {
			include: ['src/**/*.test.ts'],
			environment: 'node'
		}
	};
});
