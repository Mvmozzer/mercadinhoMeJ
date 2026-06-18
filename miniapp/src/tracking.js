import { retryApiFetchWithFreshRuntimeConfig } from './api.js?v=2026.06.18.897';
export async function loadTracking(state, pedidoId) { return retryApiFetchWithFreshRuntimeConfig(state, `/api/miniapp/pedidos/${encodeURIComponent(pedidoId)}/tracking`).catch(() => ({ ok: false, tracking: null, path: '/tracking' })); }
