import { retryApiFetchWithFreshRuntimeConfig } from './api.js?v=2026.07.22.566';

function orderPath(pedidoId, action = '') {
  const id = String(pedidoId || '').trim();
  if (!id) throw new Error('Pedido nao encontrado.');
  return `/api/miniapp/pedidos/${encodeURIComponent(id)}${action ? `/${action}` : ''}`;
}

export async function loadOrders(state) {
  return retryApiFetchWithFreshRuntimeConfig(state, '/api/miniapp/pedidos')
    .catch(() => ({ ok: false, pedidos: [] }));
}

export async function cancelOrder(state, pedidoId, options = {}) {
  return retryApiFetchWithFreshRuntimeConfig(state, orderPath(pedidoId, 'cancelar'), {
    method: 'POST',
    critical: true,
    body: JSON.stringify({
      motivo: String(options.motivo || 'Cancelado pelo cliente no Mini App').trim().slice(0, 300)
    })
  });
}
