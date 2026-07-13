import { retryApiFetchWithFreshRuntimeConfig } from './api.js?v=2026.07.13.052';

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

export async function submitOrderEvaluation(state, pedidoId, options = {}) {
  const nota = Math.floor(Number(options.nota || 0));
  if (nota < 1 || nota > 5) throw new Error('Escolha uma nota de 1 a 5.');
  return retryApiFetchWithFreshRuntimeConfig(state, orderPath(pedidoId, 'avaliacao'), {
    method: 'POST',
    critical: true,
    body: JSON.stringify({
      nota,
      comentario: String(options.comentario || '').trim().slice(0, 1000)
    })
  });
}
