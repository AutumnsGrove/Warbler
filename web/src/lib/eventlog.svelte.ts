/**
 * A short running log of things that happen to the audio session (permission
 * granted, app hidden, audio interrupted, and so on). Shown on the
 * Diagnostics screen so the phone test can be reported accurately.
 */

export interface LogEntry {
	at: string;
	message: string;
}

class EventLog {
	entries = $state<LogEntry[]>([]);

	add(message: string): void {
		const at = new Date().toLocaleTimeString([], { hour12: false });
		this.entries = [{ at, message }, ...this.entries].slice(0, 60);
	}

	clear(): void {
		this.entries = [];
	}
}

export const eventLog = new EventLog();
