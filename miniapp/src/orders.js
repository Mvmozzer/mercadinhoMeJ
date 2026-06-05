import { apiFetch } from './api.js';

export async function loadOrders(state) {
  if (!state.authOk) return [];
  const data = await apiFetch(state, '/api/miniapp/pedidos');
  state.orders = Array.isArray(data.pedidos) ? data.pedidos : [];
  return state.orders;
}

export async function loadOrder(state, pedidoId) {
  const data = await apiFetch(state, `/api/miniapp/pedidos/${encodeURIComponent(pedidoId)}`);
  state.pedidoAtual = data.pedido || null;
  if (data.pedido?.pix) state.pix = data.pedido.pix;
  return state.pedidoAtual;
}

export async function pollOrderStatus(state, pedidoId) {
  if (!pedidoId) return null;
  const data = await apiFetch(state, `/api/miniapp/pedidos/${encodeURIComponent(pedidoId)}/status`);
  state.orderStatus = data;
  if (state.pedidoAtual && String(state.pedidoAtual.id) === String(pedidoId)) {
    state.pedidoAtual = {
      ...state.pedidoAtual,
      status: data.status,
      statusDetalhe: data.statusDetalhe,
      statusPagamento: data.pagamento?.status || state.pedidoAtual.statusPagamento,
      pontos: data.pontos || state.pedidoAtual.pontos,
      entrega: data.entrega || state.pedidoAtual.entrega
    };
  }
  state.lastUpdated = Date.now();
  return data;
}

export function timelineSteps(status = '') {
  const steps = [
    ['aguardando_pagamento', 'Aguardando pagamento'],
    ['pago', 'Pago'],
    ['preparando', 'Preparando'],
    ['pronto', 'Pronto'],
    ['aguardando_entregador', 'Aguardando entregador'],
    ['saiu_para_entrega', 'Saiu para entrega'],
    ['entregue', 'Entregue'],
    ['cancelado', 'Cancelado']
  ];
  const index = steps.findIndex(([id]) => id === status);
  return steps.map(([id, label], stepIndex) => ({
    id,
    label,
    done: index >= 0 && stepIndex < index,
    active: id === status
  }));
}
