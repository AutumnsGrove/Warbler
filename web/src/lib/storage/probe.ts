/**
 * Phase 0 storage check. iOS can clear a website's stored data after a while
 * of non-use. Warbler's later "keep an unsent session until it is saved"
 * safety net depends on that not happening to an installed app, so this
 * writes one small note and reports whether it is still there on later visits.
 */

const DB_NAME = 'warbler-probe';
const STORE = 'notes';
const KEY = 'first-open';

function open(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => req.result.createObjectStore(STORE);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

export interface ProbeResult {
	/** When the note was first written, or null if it was just written now. */
	firstOpenedAt: string | null;
	justCreated: boolean;
	persisted: boolean | null;
	quotaMb: number | null;
	usageKb: number | null;
}

export async function runStorageProbe(): Promise<ProbeResult> {
	const db = await open();
	const existing = await new Promise<string | undefined>((resolve, reject) => {
		const req = db.transaction(STORE).objectStore(STORE).get(KEY);
		req.onsuccess = () => resolve(req.result as string | undefined);
		req.onerror = () => reject(req.error);
	});
	let firstOpenedAt = existing ?? null;
	const justCreated = existing === undefined;
	if (justCreated) {
		firstOpenedAt = new Date().toISOString();
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction(STORE, 'readwrite');
			tx.objectStore(STORE).put(firstOpenedAt, KEY);
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
	}
	db.close();

	let persisted: boolean | null = null;
	try {
		persisted = (await navigator.storage?.persist?.()) ?? null;
	} catch {
		persisted = null;
	}
	let quotaMb: number | null = null;
	let usageKb: number | null = null;
	try {
		const est = await navigator.storage?.estimate?.();
		if (est?.quota) quotaMb = Math.round(est.quota / 1024 / 1024);
		if (est?.usage !== undefined) usageKb = Math.round(est.usage / 1024);
	} catch {
		// Not available; leave as null.
	}
	return { firstOpenedAt: justCreated ? null : firstOpenedAt, justCreated, persisted, quotaMb, usageKb };
}
