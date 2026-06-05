import {
  checkoutCreate,
  checkoutPreview,
  getOrderTracking
} from './api.js';
import {
  cartItems,
  clearCart,
  persistCart,
  promotionalPointsPreview
} from './cart.js';
import { isWeightedProduct } from './catalog.js';
import { PENDING_ORDER_KEY, removeKey, writeText } from './storage.js';
import { clientOrderId, compactWhitespace } from './utils.js';
import { fallbackSendData } from './telegram.js';

export function clientOrderIdAtual(state) {
  if (!state.pendingClientOrderId) {
    state.pendingClientOrderId = clientOrderId();
    writeText(PENDING_ORDER_KEY, state.pendingClientOrderId);
  }
  return state.pendingClientOrderId;
}

export function limparClientOrderIdPendente(state) {
  state.pendingClientOrderId = '';
  removeKey(PENDING_ORDER_KEY);
}

export function observacoesCarrinhoMiniApp(els = {}) {
  return compactWhitespace(els.cartNotes?.value || '', 500);
}

export function cupomDigitadoMiniApp(state) {
  return compactWhitespace(state.couponCode || '', 40).replace(/\s+/g, '');
}

export function canalCompra() {
  return 'telegram_miniapp';
}

export function payloadCarrinhoMiniApp(state, els = {}) {
  return {
    type: 'mercadinho_cart',
    source: 'telegram_mini_app_html',
    origem: canalCompra(),
    client_order_id: clientOrderIdAtual(state),
    use_points_intent: Boolean(state.usePointsIntent),
    cupom_digitado: cupomDigitadoMiniApp(state),
    cliente_intencoes: {
      usar_pontos: Boolean(state.usePointsIntent),
      cupom_digitado: cupomDigitadoMiniApp(state)
    },
    items: cartItems(state).map(item => ({
      produto_id: item.id,
      secao: item.section,
      index: item.index,
      nome: item.name,
      sku: item.sku || '',
      codigoBarras: item.barcode || '',
      modo_venda: item.saleMode === 'weighted' ? 'granel' : 'unidade',
      unidade_venda: item.unidadeVenda || item.unit || 'un',
      unidade_base_preco: item.unidadeBasePreco || item.unidadeVenda || item.unit || 'un',
      quantidade: item.quantity,
      quantidade_solicitada: item.quantity,
      observacao_item: compactWhitespace(state.itemNotes.get(item.id) || '', 240),
      peso_estimado: isWeightedProduct(item) ? item.quantity : null,
      preco_unitario_exibido: item.price,
      preco_base_centavos: item.precoBaseCentavos || Math.round(item.price * 100),
      subtotal_exibido: Number((item.price * item.quantity).toFixed(2)),
      subtotal_estimado_exibido: Number((item.price * item.quantity).toFixed(2))
    })),
    observacoes: observacoesCarrinhoMiniApp(els)
  };
}

export function entregaCheckoutMiniApp(els = {}) {
  return {
    cep: String(els.checkoutCep?.value || els.profileCep?.value || '').trim(),
    rua: String(els.checkoutRua?.value || els.profileRua?.value || '').trim(),
    numero: String(els.checkoutNumero?.value || els.profileNumero?.value || '').trim(),
    complemento: String(els.checkoutComplemento?.value || els.profileComplemento?.value || '').trim(),
    bairro: String(els.checkoutBairro?.value || els.profileBairro?.value || '').trim(),
    cidade: String(els.checkoutCidade?.value || els.profileCidade?.value || '').trim(),
    estado: String(els.checkoutEstado?.value || els.profileEstado?.value || '').trim().toUpperCase(),
    telefone: String(els.checkoutPhone?.value || els.profilePhone?.value || '').trim()
  };
}

export function pontosUsarMiniApp(state, els = {}) {
  const bruto = els.checkoutPoints?.value || (state.usePointsIntent ? state.loyalty?.saldoPontos : 0);
  return Math.max(0, Math.floor(Number(bruto || 0) || 0));
}

export function modalidadeEntregaMiniApp(state, els = {}) {
  return String(els.deliveryMode?.value || state.checkout.deliveryMode || 'retirada').trim() === 'entrega'
    ? 'entrega'
    : 'retirada';
}

export function payloadPedidoMiniApp(state, els = {}) {
  const modalidade = modalidadeEntregaMiniApp(state, els);
  return {
    type: 'mercadinho_order',
    fallback_type: 'mercadinho_cart',
    source: 'telegram_mini_app_html',
    origem: canalCompra(),
    client_order_id: clientOrderIdAtual(state),
    items: cartItems(state).map(item => ({
      produto_id: item.id,
      id: item.id,
      secao: item.section,
      index: item.index,
      nome: item.name,
      preco: item.price,
      quantidade: item.quantity,
      quantity: item.quantity,
      qtd: item.quantity,
      observacao_item: compactWhitespace(state.itemNotes.get(item.id) || '', 240),
      preco_unitario_exibido: item.price,
      subtotal_exibido: Number((item.price * item.quantity).toFixed(2))
    })),
    modalidade_entrega: modalidade,
    forma_pagamento: 'pix',
    entrega: modalidade === 'entrega' ? entregaCheckoutMiniApp(els) : {},
    pontos_usar: pontosUsarMiniApp(state, els),
    codigo_indicacao: cupomDigitadoMiniApp(state),
    observacao: observacoesCarrinhoMiniApp(els)
  };
}

export async function previewCheckoutMiniApp(state, els = {}) {
  const payload = payloadPedidoMiniApp(state, els);
  if (!payload.items.length) throw new Error('Adicione ao menos um produto');
  return checkoutPreview(state, payload);
}

export async function createOrderMiniApp(state, els = {}) {
  const payload = payloadPedidoMiniApp(state, els);
  if (!payload.items.length) throw new Error('Adicione ao menos um produto');
  return checkoutCreate(state, payload);
}

export async function finalizarCheckoutMiniApp(state, els, telegram, callbacks = {}) {
  const payload = payloadPedidoMiniApp(state, els);
  if (!payload.items.length) {
    callbacks.showToast?.('Adicione ao menos um produto');
    return { ok: false };
  }
  payload.promotional_points_preview = promotionalPointsPreview(state);
  try {
    await checkoutPreview(state, payload);
    const data = await checkoutCreate(state, payload);
    if (data.pedido?.id) {
      state.pedidoAtual = data.pedido;
      state.pix = data.pix || null;
      state.tracking = await getOrderTracking(state, data.pedido.id).catch(() => state.tracking);
    }
    clearCart(state, () => limparClientOrderIdPendente(state));
    state.couponCode = '';
    state.usePointsIntent = false;
    if (els.cartNotes) els.cartNotes.value = '';
    persistCart(state);
    callbacks.render?.();
    callbacks.showToast?.('Pedido criado. O Pix esta pronto no Mini App.');
    return { ok: true, mode: 'api', data };
  } catch (error) {
    payload.type = 'mercadinho_order';
    payload.fallback_cart = payloadCarrinhoMiniApp(state, els);
    fallbackSendData(telegram?.webApp, payload);
    clearCart(state, () => limparClientOrderIdPendente(state));
    state.couponCode = '';
    state.usePointsIntent = false;
    if (els.cartNotes) els.cartNotes.value = '';
    persistCart(state);
    callbacks.render?.();
    callbacks.showToast?.(telegram?.webApp ? 'API indisponivel. Enviei seu pedido ao Telegram.' : 'API indisponivel. Payload de fallback no console.');
    return { ok: true, mode: 'fallback', error };
  }
}

export async function enviarCarrinhoParaCheckoutTelegram(state, els, telegram, callbacks = {}) {
  const payload = payloadCarrinhoMiniApp(state, els);
  if (!payload.items.length) {
    callbacks.showToast?.('Adicione ao menos um produto');
    return false;
  }
  payload.promotional_points_preview = promotionalPointsPreview(state);
  if (telegram?.webApp?.sendData) {
    telegram.webApp.sendData(JSON.stringify(payload));
  } else {
    window.__lastMiniAppPayload = payload;
    console.log('Mini App test payload', payload);
  }
  clearCart(state, () => limparClientOrderIdPendente(state));
  state.couponCode = '';
  state.usePointsIntent = false;
  if (els.cartNotes) els.cartNotes.value = '';
  persistCart(state);
  callbacks.render?.();
  callbacks.showToast?.('Sua solicitacao foi enviada com sucesso. Agora confirme entrega e pagamento no Telegram.');
  return true;
}
