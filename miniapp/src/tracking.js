import { retryApiFetchWithFreshRuntimeConfig } from './api.js?v=2026.06.20.441';
export async function loadTracking(state, pedidoId) { return retryApiFetchWithFreshRuntimeConfig(state, `/api/miniapp/pedidos/${encodeURIComponent(pedidoId)}/tracking`).catch(() => ({ ok: false, tracking: null, path: '/tracking' })); }
