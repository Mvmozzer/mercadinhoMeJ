import { retryApiFetchWithFreshRuntimeConfig } from './api.js?v=2026.07.02.526';
export async function loadOrders(state) { return retryApiFetchWithFreshRuntimeConfig(state, '/api/miniapp/pedidos').catch(() => ({ ok: false, pedidos: [] })); }
