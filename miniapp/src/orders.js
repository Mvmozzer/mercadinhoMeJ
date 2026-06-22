import { retryApiFetchWithFreshRuntimeConfig } from './api.js?v=2026.06.22.060';
export async function loadOrders(state) { return retryApiFetchWithFreshRuntimeConfig(state, '/api/miniapp/pedidos').catch(() => ({ ok: false, pedidos: [] })); }
