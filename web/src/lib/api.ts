/** Small helpers for talking to the Warbler server. */

export class ApiError extends Error {
	constructor(
		public status: number,
		public code: string,
		message: string
	) {
		super(message);
		this.name = 'ApiError';
	}
}

/** Call a JSON endpoint. Throws ApiError for error responses. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(path, { ...init, headers: { Accept: 'application/json', ...init?.headers } });
	let body: unknown = null;
	try {
		body = await res.json();
	} catch {
		// Not JSON; handled below.
	}
	if (!res.ok) {
		const err = (body as { error?: { code?: string; message?: string } } | null)?.error;
		throw new ApiError(res.status, err?.code ?? 'error', err?.message ?? `Request failed (${res.status}).`);
	}
	return body as T;
}

/** Ask /healthz for the running version. Returns null if the server is not answering. */
export async function runningVersion(timeoutMs = 3000): Promise<string | null> {
	try {
		const res = await fetch('/healthz', { cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
		if (!res.ok) return null;
		const body = (await res.json()) as { version?: string };
		return body.version ?? null;
	} catch {
		return null;
	}
}
