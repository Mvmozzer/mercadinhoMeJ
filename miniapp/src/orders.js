import { retryApiFetchWithFreshRuntimeConfig } from './api.js?v=2026.06.20.441';
export async function loadOrders(state) { return retryApiFetchWithFreshRuntimeConfig(state, '/api/miniapp/pedidos').catch(() => ({ ok: false, pedidos: [] })); }
