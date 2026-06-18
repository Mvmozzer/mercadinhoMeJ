import { retryApiFetchWithFreshRuntimeConfig } from './api.js?v=2026.06.18.656';
export async function loadOrders(state) { return retryApiFetchWithFreshRuntimeConfig(state, '/api/miniapp/pedidos').catch(() => ({ ok: false, pedidos: [] })); }
