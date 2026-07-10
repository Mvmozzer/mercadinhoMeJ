import { retryApiFetchWithFreshRuntimeConfig } from './api.js?v=2026.07.10.332';
export async function loadOrders(state) { return retryApiFetchWithFreshRuntimeConfig(state, '/api/miniapp/pedidos').catch(() => ({ ok: false, pedidos: [] })); }
