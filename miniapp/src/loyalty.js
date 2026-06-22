import { retryApiFetchWithFreshRuntimeConfig } from './api.js?v=2026.06.22.643';
export async function loadLoyalty(state) { return retryApiFetchWithFreshRuntimeConfig(state, '/api/miniapp/loyalty').catch(() => ({ ok: false, saldoPontos: 0 })); }
