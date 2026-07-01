import { retryApiFetchWithFreshRuntimeConfig } from './api.js?v=2026.07.01.280';
export async function loadOrders(state) { return retryApiFetchWithFreshRuntimeConfig(state, '/api/miniapp/pedidos').catch(() => ({ ok: false, pedidos: [] })); }
