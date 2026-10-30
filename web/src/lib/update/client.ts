import { api } from '../api';
import type { Available, UpdateResult, VersionInfo } from './view';

export const getVersion = () => api<VersionInfo>('/api/version');
export const requestCheck = () => api<{ ok: boolean }>('/api/update/check', { method: 'POST' });
export const getAvailable = () =>
	api<{ available: Available | null; check_pending: boolean }>('/api/update/available');
export const requestUpdate = () => api<{ ok: boolean }>('/api/update/start', { method: 'POST' });
export const getUpdateStatus = () =>
	api<{ pending: boolean; result: UpdateResult | null }>('/api/update/status');
