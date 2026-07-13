import { retryApiFetchWithFreshRuntimeConfig } from './api.js?v=2026.07.13.752';

export async function loadTracking(state, pedidoId) {
  return retryApiFetchWithFreshRuntimeConfig(state, `/api/miniapp/pedidos/${encodeURIComponent(pedidoId)}/tracking`)
    .catch(() => ({ ok: false, tracking: null, path: '/tracking' }));
}

export async function loadOrderStatus(state, pedidoId) {
  const id = String(pedidoId || '').trim();
  if (!id) return null;
  return retryApiFetchWithFreshRuntimeConfig(state, `/api/miniapp/pedidos/${encodeURIComponent(id)}/status`)
    .catch(() => null);
}
