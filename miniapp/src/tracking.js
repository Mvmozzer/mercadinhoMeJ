import { retryApiFetchWithFreshRuntimeConfig } from './api.js?v=2026.08.01.947';

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

export async function loadOrderDetail(state, pedidoId) {
  const id = String(pedidoId || '').trim();
  if (!id) return null;
  return retryApiFetchWithFreshRuntimeConfig(state, `/api/miniapp/pedidos/${encodeURIComponent(id)}`)
    .catch(() => null);
}
