import { retryApiFetchWithFreshRuntimeConfig } from './api.js?v=2026.06.18.065';
export async function loadLoyalty(state) { return retryApiFetchWithFreshRuntimeConfig(state, '/api/miniapp/loyalty').catch(() => ({ ok: false, saldoPontos: 0 })); }
