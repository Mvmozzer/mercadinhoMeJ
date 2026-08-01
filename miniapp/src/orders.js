import { hasAuthenticatedMiniAppIdentity, retryApiFetchWithFreshRuntimeConfig } from './api.js?v=2026.08.01.015';

function orderPath(pedidoId, action = '') {
  const id = String(pedidoId || '').trim();
  if (!id) throw new Error('Pedido nao encontrado.');
  return `/api/miniapp/pedidos/${encodeURIComponent(id)}${action ? `/${action}` : ''}`;
}

function normalizePreorderVersion(value) {
  const version = Number(value);
  if (!Number.isInteger(version) || version < 0) {
    throw new Error('Atualize a tela da encomenda antes de continuar.');
  }
  return version;
}

export async function loadOrders(state) {
  if (!hasAuthenticatedMiniAppIdentity(state)) return { ok: false, pedidos: [] };
  return retryApiFetchWithFreshRuntimeConfig(state, '/api/miniapp/pedidos')
    .catch(() => ({ ok: false, pedidos: [] }));
}

export async function cancelOrder(state, pedidoId, options = {}) {
  const body = {
    motivo: String(options.motivo || 'Cancelado pelo cliente no Mini App').trim().slice(0, 300)
  };
  if (Object.prototype.hasOwnProperty.call(options, 'versaoEncomenda')) {
    body.versaoEncomenda = normalizePreorderVersion(options.versaoEncomenda);
  }
  return retryApiFetchWithFreshRuntimeConfig(state, orderPath(pedidoId, 'cancelar'), {
    method: 'POST',
    critical: true,
    body: JSON.stringify(body)
  });
}

export async function confirmPreorder(state, pedidoId, options = {}) {
  return retryApiFetchWithFreshRuntimeConfig(state, orderPath(pedidoId, 'encomenda/confirmar'), {
    method: 'POST',
    critical: true,
    body: JSON.stringify({
      versaoEncomenda: normalizePreorderVersion(options.versaoEncomenda)
    })
  });
}

export async function cancelPreorder(state, pedidoId, options = {}) {
  return retryApiFetchWithFreshRuntimeConfig(state, orderPath(pedidoId, 'encomenda/cancelar'), {
    method: 'POST',
    critical: true,
    body: JSON.stringify({
      versaoEncomenda: normalizePreorderVersion(options.versaoEncomenda),
      motivo: String(options.motivo || 'Encomenda cancelada pelo cliente no Mini App').trim().slice(0, 300)
    })
  });
}
