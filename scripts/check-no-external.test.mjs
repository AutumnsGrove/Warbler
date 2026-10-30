import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { findExternal } from './check-no-external.mjs';

function folder(files) {
	const dir = mkdtempSync(join(tmpdir(), 'warbler-ext-'));
	for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
	return dir;
}

test('allows XML namespaces and svelte error links', () => {
	const dir = folder({
		'a.js': 'const ns="http://www.w3.org/2000/svg"; throw new Error(`see https://svelte.dev/e/each_key_duplicate`)'
	});
	assert.deepEqual(findExternal(dir), []);
});

test('flags an outside script, font, image and css import', () => {
	const dir = folder({
		'index.html': '<script src="https://cdn.example.com/x.js"></script><img src="http://ads.example.net/p.gif">',
		'app.css': '@import url("https://fonts.googleapis.com/css2?family=Lexend");'
	});
	const urls = findExternal(dir).map((f) => f.url);
	assert.equal(urls.length, 3);
	assert.ok(urls.some((u) => u.includes('fonts.googleapis.com')));
});

test('ignores binary files', () => {
	const dir = folder({ 'font.woff2': 'https://tracker.example.com' });
	assert.deepEqual(findExternal(dir), []);
});
