import { retryApiFetchWithFreshRuntimeConfig } from './api.js?v=2026.07.11.640';
export async function loadOrders(state) { return retryApiFetchWithFreshRuntimeConfig(state, '/api/miniapp/pedidos').catch(() => ({ ok: false, pedidos: [] })); }
