import { retryApiFetchWithFreshRuntimeConfig } from './api.js';
export async function loadTracking(state, pedidoId) { return retryApiFetchWithFreshRuntimeConfig(state, `/api/miniapp/pedidos/${encodeURIComponent(pedidoId)}/tracking`).catch(() => ({ ok: false, tracking: null, path: '/tracking' })); }
