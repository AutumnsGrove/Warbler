#!/usr/bin/env node
// Fails if the built web app mentions any web address that is not on a short
// list of harmless ones. Warbler must never load scripts, fonts, images or
// data from outside (see docs/testing.md, Layer 11). The page's content
// policy blocks outside requests at run time; this check catches them at
// build time, before anyone opens the app.
//
// Harmless addresses:
//  - XML namespace names such as http://www.w3.org/2000/svg. They are labels
//    inside the code, never requested.
//  - https://svelte.dev/e/... links that appear inside error-message text.
//
// Usage: node scripts/check-no-external.mjs web/build

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ALLOWED_PREFIXES = ['http://www.w3.org/', 'https://svelte.dev/e/', 'https://svelte.dev/docs/'];

const TEXT_EXTENSIONS = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.svg', '.txt', '.map']);
const URL_PATTERN = /https?:\/\/[^\s"'`)<>\\]+/g;

/** Return a list of { file, url } for every address that is not allowed. */
export function findExternal(dir, allowed = ALLOWED_PREFIXES) {
	const found = [];
	const walk = (current) => {
		for (const name of readdirSync(current)) {
			const full = join(current, name);
			const info = statSync(full);
			if (info.isDirectory()) {
				walk(full);
			} else if (TEXT_EXTENSIONS.has(extname(name))) {
				const text = readFileSync(full, 'utf8');
				for (const url of text.match(URL_PATTERN) ?? []) {
					if (!allowed.some((prefix) => url.startsWith(prefix))) found.push({ file: full, url });
				}
			}
		}
	};
	walk(dir);
	return found;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const dir = process.argv[2];
	if (!dir) {
		console.error('usage: check-no-external.mjs <build folder>');
		process.exit(2);
	}
	const bad = findExternal(dir);
	if (bad.length > 0) {
		console.error('The built app mentions outside web addresses:');
		for (const { file, url } of bad) console.error(`  ${file}: ${url}`);
		process.exit(1);
	}
	console.log('No outside web addresses in the built app.');
}
