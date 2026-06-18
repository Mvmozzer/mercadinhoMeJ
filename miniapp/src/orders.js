import { retryApiFetchWithFreshRuntimeConfig } from './api.js?v=2026.06.18.695';
export async function loadOrders(state) { return retryApiFetchWithFreshRuntimeConfig(state, '/api/miniapp/pedidos').catch(() => ({ ok: false, pedidos: [] })); }
