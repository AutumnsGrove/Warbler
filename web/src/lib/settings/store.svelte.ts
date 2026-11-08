/**
 * Saving the settings on the device.
 *
 * These are small numbers typed by hand, so they live in the browser's own
 * storage until the server learns to hold them (Phase 2). Nothing here goes
 * anywhere else.
 *
 * Keeping the reading and writing here, and the rules in settings.ts, means the
 * rules are testable without a browser and this file stays boring on purpose.
 */

import { DEFAULT_SETTINGS, sanitise, type Settings } from './settings';

const STORAGE_KEY = 'warbler-settings-v1';

class SettingsStore {
	/** The current values. Screens read this directly. */
	values = $state<Settings>({ ...DEFAULT_SETTINGS });
	/** True once storage has been read (or tried). */
	loaded = $state(false);

	/**
	 * Read what was saved. Safe to call more than once, and safe when storage
	 * is unavailable (private browsing, or a cleared profile): the defaults are
	 * used instead of throwing.
	 */
	load(): void {
		if (this.loaded) return;
		this.loaded = true;
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) this.values = sanitise(JSON.parse(raw) as Partial<Settings>);
		} catch {
			this.values = { ...DEFAULT_SETTINGS };
		}
	}

	/** Change some values, keep the rest, and save straight away. */
	update(patch: Partial<Settings>): void {
		this.values = sanitise({ ...this.values, ...patch });
		this.save();
	}

	/** Forget any setup, back to a fresh install. */
	reset(): void {
		this.values = { ...DEFAULT_SETTINGS };
		this.save();
	}

	private save(): void {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.values));
		} catch {
			// Storage full or refused: the session still works, it just will not
			// be remembered next time. Not worth interrupting anyone over.
		}
	}
}

export const settings = new SettingsStore();
