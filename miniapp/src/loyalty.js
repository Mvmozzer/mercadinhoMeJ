import { retryApiFetchWithFreshRuntimeConfig } from './api.js';
export async function loadLoyalty(state) { return retryApiFetchWithFreshRuntimeConfig(state, '/api/miniapp/loyalty').catch(() => ({ ok: false, saldoPontos: 0 })); }
