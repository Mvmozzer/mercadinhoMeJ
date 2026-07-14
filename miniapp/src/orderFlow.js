const PAID_STATUSES = new Set([
  'pago',
  'paid',
  'confirmado',
  'confirmed',
  'aprovado',
  'approved',
  'pagamento_confirmado'
]);

const FINAL_STATUSES = new Set(['entregue', 'cancelado']);
const FINAL_WEIGHT_FLAGS = ['aguardandoPesagem', 'aguardando_pesagem', 'awaitingWeight', 'awaitingFinalWeight'];

function clean(value = '') {
  return String(value || '').trim();
}

function cleanLower(value = '') {
  return clean(value).toLowerCase();
}

function booleanFlag(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const text = cleanLower(value);
  if (['true', '1', 'sim', 'yes'].includes(text)) return true;
  if (['false', '0', 'nao', 'não', 'no'].includes(text)) return false;
  return null;
}

export function awaitingFinalWeightState(...sources) {
  const queue = sources.filter(source => source && typeof source === 'object');
  const visited = new Set();
  let explicitFalse = false;
  while (queue.length) {
    const source = queue.shift();
    if (!source || typeof source !== 'object' || visited.has(source)) continue;
    visited.add(source);
    for (const field of FINAL_WEIGHT_FLAGS) {
      if (!Object.prototype.hasOwnProperty.call(source, field)) continue;
      const value = booleanFlag(source[field]);
      if (value === true) return true;
      if (value === false) explicitFalse = true;
    }
    ['checkout', 'pedido', 'ordem', 'order'].forEach(field => {
      if (source[field] && typeof source[field] === 'object') queue.push(source[field]);
    });
  }
  return explicitFalse ? false : null;
}

export function isAwaitingFinalWeight(...sources) {
  return awaitingFinalWeightState(...sources) === true;
}

function orderId(order = {}) {
  return clean(order.id || order.pedidoId || order.pedido_id);
}

function paymentStatus(order = {}) {
  return cleanLower(
    order.statusPagamento ||
    order.status_pagamento ||
    order.pagamento?.status ||
    order.payment?.status ||
    ''
  );
}

function trackingModeFrom(value = {}, state = {}) {
  const checkout = state.checkout || {};
  const raw = cleanLower(
    value.acompanhamentoModo ||
    value.modoAcompanhamentoCliente ||
    value.modo_acompanhamento_cliente ||
    value.trackingMode ||
    checkout.acompanhamentoModo ||
    checkout.modoAcompanhamentoCliente ||
    checkout.modo_acompanhamento_cliente ||
    checkout.trackingMode ||
    ''
  );
  if (value.acompanhamentoMiniAppAtivo === true || checkout.acompanhamentoMiniAppAtivo === true || raw === 'miniapp') {
    return 'miniapp';
  }
  return raw === 'telegram' ? 'telegram' : '';
}

export function activeOrderId(state = {}) {
  return clean(
    state.pedidoAtual?.id ||
    state.pedidoAtual?.pedidoId ||
    state.lastMiniAppCheckout?.pedido?.id ||
    state.lastMiniAppCheckout?.ordem?.id ||
    state.lastMiniAppCheckout?.order?.id ||
    state.lastMiniAppCheckout?.pedidoId ||
    state.lastMiniAppCheckout?.pedido_id ||
    ''
  );
}

export function isPaymentConfirmed(order = {}) {
  return PAID_STATUSES.has(cleanLower(order.status)) || PAID_STATUSES.has(paymentStatus(order));
}

export function isFinalOrderStatus(status = '') {
  return FINAL_STATUSES.has(cleanLower(status));
}

function statusOrderFromPayload(state = {}, payload = {}) {
  const source = payload.pedido && typeof payload.pedido === 'object'
    ? payload.pedido
    : payload.ordem && typeof payload.ordem === 'object'
      ? payload.ordem
      : payload.order && typeof payload.order === 'object'
        ? payload.order
        : payload;
  const id = orderId(source) || clean(payload.pedidoId || payload.pedido_id || activeOrderId(state));
  const current = orderId(state.pedidoAtual || {}) === id ? state.pedidoAtual : {};
  const pagamento = {
    ...(current.pagamento || {}),
    ...(source.pagamento || {}),
    ...(payload.pagamento || {})
  };
  const statusPagamento = clean(
    source.statusPagamento ||
    source.status_pagamento ||
    payload.statusPagamento ||
    payload.status_pagamento ||
    pagamento.status ||
    current.statusPagamento ||
    current.status_pagamento
  );
  const awaitingWeight = awaitingFinalWeightState(payload, source);
  if (statusPagamento) pagamento.status = statusPagamento;
  return {
    ...current,
    ...source,
    id,
    status: clean(source.status || payload.status || current.status),
    statusPagamento,
    status_pagamento: statusPagamento || current.status_pagamento || '',
    pagamento,
    aguardandoPesagem: awaitingWeight === null
      ? isAwaitingFinalWeight(current)
      : awaitingWeight,
    acompanhamentoModo: trackingModeFrom(payload, state) || current.acompanhamentoModo || '',
    modoAcompanhamentoCliente: trackingModeFrom(payload, state) || current.modoAcompanhamentoCliente || '',
    updatedAt: payload.updatedAt || source.updatedAt || source.atualizadoEm || current.updatedAt || new Date().toISOString()
  };
}

function stableOrderSignature(order = {}) {
  return JSON.stringify({
    id: orderId(order),
    status: order.status || '',
    statusPagamento: order.statusPagamento || order.status_pagamento || order.pagamento?.status || '',
    aguardandoPesagem: isAwaitingFinalWeight(order),
    updatedAt: order.updatedAt || order.atualizadoEm || ''
  });
}

export function applyOrderStatusToState(state = {}, payload = {}) {
  const order = statusOrderFromPayload(state, payload);
  const id = orderId(order);
  if (!id) return { changed: false, order };

  const before = stableOrderSignature(state.pedidoAtual || {});
  const currentId = orderId(state.pedidoAtual || {});
  if (!currentId || currentId === id) state.pedidoAtual = { ...(state.pedidoAtual || {}), ...order };

  const orders = Array.isArray(state.orders) ? state.orders : [];
  const index = orders.findIndex(item => orderId(item) === id);
  if (index >= 0) {
    orders[index] = { ...orders[index], ...order };
  } else {
    orders.unshift(order);
  }
  state.orders = orders;

  const mode = trackingModeFrom(payload, state);
  if (mode) {
    state.checkout = {
      ...(state.checkout || {}),
      acompanhamentoModo: mode,
      modoAcompanhamentoCliente: mode,
      acompanhamentoMiniAppAtivo: mode === 'miniapp'
    };
  }

  return {
    changed: before !== stableOrderSignature(state.pedidoAtual || {}),
    order: state.pedidoAtual || order
  };
}

export function applyTrackingToState(state = {}, tracking = {}) {
  const before = JSON.stringify({
    pedido: stableOrderSignature(state.pedidoAtual || {}),
    trackingStatus: state.tracking?.pedido?.status || state.tracking?.status || '',
    map: mapFromTrackingPayload(state.tracking || {}).mapaUrl || ''
  });
  state.tracking = tracking || {};
  const pedido = tracking?.pedido || tracking?.order || null;
  if (pedido) applyOrderStatusToState(state, { ...tracking, pedido });
  if (!state.tracking?.status && !state.tracking?.pedido?.status && state.pedidoAtual?.status) {
    state.tracking.status = state.pedidoAtual.status;
  }
  const after = JSON.stringify({
    pedido: stableOrderSignature(state.pedidoAtual || {}),
    trackingStatus: state.tracking?.pedido?.status || state.tracking?.status || '',
    map: mapFromTrackingPayload(state.tracking || {}).mapaUrl || ''
  });
  return { changed: before !== after, order: state.pedidoAtual || pedido || null };
}

export function shouldOpenTrackingAfterPayment(state = {}, order = {}) {
  if (state.page !== 'payment') return false;
  if (!isPaymentConfirmed(order)) return false;
  return trackingModeFrom(order, state) === 'miniapp';
}

export function mapFromTrackingPayload(tracking = {}) {
  const pedido = tracking?.pedido || tracking?.order || {};
  const entrega = pedido.entrega || tracking.entrega || {};
  const localizacao = tracking.localizacao || pedido.localizacao || entrega.localizacaoAoVivo || {};
  const mapaUrl = clean(
    tracking.mapaUrl ||
    tracking.mapUrl ||
    localizacao.mapaUrl ||
    localizacao.mapUrl ||
    entrega.mapaUrl ||
    ''
  );
  return {
    aoVivo: localizacao.aoVivo === true || localizacao.live === true || Boolean(mapaUrl && localizacao.status === 'ativa_compartilhada'),
    mapaUrl,
    mensagem: clean(localizacao.mensagem || tracking.mensagem || 'Localizacao do entregador ainda nao esta compartilhada.'),
    atualizadaEm: clean(localizacao.atualizadaEm || localizacao.updatedAt || localizacao.ultima_atualizacao || '')
  };
}

export function orderFlowPollingMs(state = {}) {
  const configured = Number(state.pollingMs || 0);
  const base = Number.isFinite(configured) && configured > 0 ? configured : 2500;
  return Math.max(1500, Math.min(10000, Math.round(base)));
}
