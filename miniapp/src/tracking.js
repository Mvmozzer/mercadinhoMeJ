import { apiFetch } from './api.js';

export async function loadTracking(state, pedidoId) {
  if (!pedidoId) return null;
  const data = await apiFetch(state, `/api/miniapp/pedidos/${encodeURIComponent(pedidoId)}/tracking`);
  state.tracking = data.pedido || data.tracking || null;
  return state.tracking;
}

export async function pollLocation(state, pedidoId) {
  if (!pedidoId) return null;
  const data = await apiFetch(state, `/api/miniapp/pedidos/${encodeURIComponent(pedidoId)}/location`);
  state.location = data;
  if (state.tracking) {
    state.tracking = {
      ...state.tracking,
      localizacao: data
    };
  }
  state.lastUpdated = Date.now();
  return data;
}

export function stopTrackingWhenDelivered(state) {
  const status = String(state.pedidoAtual?.status || state.tracking?.status || '').toLowerCase();
  return status === 'entregue' || status === 'cancelado';
}
