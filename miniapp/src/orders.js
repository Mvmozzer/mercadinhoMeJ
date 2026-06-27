import { retryApiFetchWithFreshRuntimeConfig } from './api.js?v=2026.06.27.123';
export async function loadOrders(state) { return retryApiFetchWithFreshRuntimeConfig(state, '/api/miniapp/pedidos').catch(() => ({ ok: false, pedidos: [] })); }
