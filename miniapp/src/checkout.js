import {
  bridgeSendAction,
  checkoutCreate,
  checkoutPreview,
  getOrderTracking,
  loadCustomerAddress,
  sendMiniAppEvent,
  syncMiniAppCart,
  telegramHandoff,
  validateCheckoutAddress
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
    comment: observacoesCarrinhoMiniApp(els),
    items: cartItems(state).map(item => ({
      produtoId: item.id,
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
    cep: String(els.checkoutCep?.value || '').trim(),
    rua: String(els.checkoutRua?.value || '').trim(),
    numero: String(els.checkoutNumero?.value || '').trim(),
    complemento: String(els.checkoutComplemento?.value || '').trim(),
    bairro: String(els.checkoutBairro?.value || '').trim(),
    cidade: String(els.checkoutCidade?.value || '').trim(),
    estado: String(els.checkoutEstado?.value || '').trim().toUpperCase(),
    telefone: String(els.checkoutPhone?.value || '').trim()
  };
}

export function deliveryAddressFromCustomer(state) {
  const cliente = state.cliente || {};
  return {
    cep: String(cliente.cep || '').trim(),
    rua: String(cliente.rua || '').trim(),
    numero: String(cliente.numero || '').trim(),
    complemento: String(cliente.complemento || '').trim(),
    bairro: String(cliente.bairro || '').trim(),
    cidade: String(cliente.cidade || '').trim(),
    estado: String(cliente.estado || '').trim().toUpperCase(),
    telefone: String(cliente.telefone || '').trim()
  };
}

export function enderecoEntregaCompleto(endereco = {}) {
  const cep = String(endereco.cep || '').replace(/\D/g, '');
  return /^\d{8}$/.test(cep) &&
    Boolean(String(endereco.rua || '').trim()) &&
    Boolean(String(endereco.numero || '').trim()) &&
    Boolean(String(endereco.bairro || '').trim()) &&
    Boolean(String(endereco.cidade || '').trim()) &&
    /^[A-Z]{2}$/.test(String(endereco.estado || '').trim().toUpperCase()) &&
    String(endereco.telefone || '').replace(/\D/g, '').length >= 10;
}

export function resumoEnderecoEntrega(endereco = {}) {
  const ruaNumero = [endereco.rua, endereco.numero].filter(Boolean).join(', ');
  const linha = [ruaNumero, endereco.bairro].filter(Boolean).join(' - ');
  return linha ? `Entrega em: ${linha}` : 'Endereco de entrega incompleto';
}

export function prefillCheckoutAddressFromCustomer(state, els = {}, options = {}) {
  if (!state.checkout) return {};
  if (state.checkout.deliveryAddressDirty && !options.force) return state.checkout.deliveryAddress || {};
  const atual = state.checkout.deliveryAddress || {};
  const endereco = {
    ...deliveryAddressFromCustomer(state),
    ...Object.fromEntries(Object.entries(atual).filter(([, value]) => String(value || '').trim()))
  };
  state.checkout.deliveryAddress = endereco;
  state.checkout.deliveryAddressSummary = resumoEnderecoEntrega(endereco);
  const fields = {
    checkoutCep: endereco.cep,
    checkoutRua: endereco.rua,
    checkoutNumero: endereco.numero,
    checkoutComplemento: endereco.complemento,
    checkoutBairro: endereco.bairro,
    checkoutCidade: endereco.cidade,
    checkoutEstado: endereco.estado,
    checkoutPhone: endereco.telefone
  };
  Object.entries(fields).forEach(([id, value]) => {
    if (!els[id]) return;
    if (options.force || !String(els[id].value || '').trim()) els[id].value = value || '';
  });
  return endereco;
}

export async function loadCheckoutAddressFromApi(state, els = {}) {
  const data = await loadCustomerAddress(state).catch(() => null);
  if (data?.endereco && !state.checkout.deliveryAddressDirty) {
    state.checkout.deliveryAddress = data.endereco;
    prefillCheckoutAddressFromCustomer(state, els, { force: true });
  }
  return data;
}

export function effectiveDeliveryAddressMiniApp(state, els = {}) {
  const fromFields = entregaCheckoutMiniApp(els);
  const hasFieldValue = Object.values(fromFields).some(value => String(value || '').trim());
  const stateAddress = state.checkout.deliveryAddress || {};
  const hasStateValue = Object.values(stateAddress).some(value => String(value || '').trim());
  const endereco = hasFieldValue ? fromFields : (hasStateValue ? stateAddress : deliveryAddressFromCustomer(state));
  state.checkout.deliveryAddress = endereco;
  state.checkout.deliveryAddressSummary = resumoEnderecoEntrega(endereco);
  return endereco;
}

export function modalidadeEntregaMiniApp(state, els = {}) {
  return String(els.deliveryMode?.value || state.checkout.deliveryMode || 'retirada').trim() === 'entrega'
    ? 'entrega'
    : 'retirada';
}

export async function validateDeliveryAddressMiniApp(state, els = {}) {
  if (modalidadeEntregaMiniApp(state, els) !== 'entrega') return null;
  const endereco = effectiveDeliveryAddressMiniApp(state, els);
  const payload = {
    entrega: endereco,
    salvarCadastro: state.checkout.saveAddressToProfile === true
  };
  const data = await validateCheckoutAddress(state, payload);
  if (data?.endereco) {
    state.checkout.deliveryAddress = data.endereco;
    state.checkout.deliveryAddressSummary = data.resumo || resumoEnderecoEntrega(data.endereco);
  }
  return data;
}

export function pontosUsarMiniApp(state, els = {}) {
  const bruto = els.checkoutPoints?.value || (state.usePointsIntent ? state.loyalty?.saldoPontos : 0);
  return Math.max(0, Math.floor(Number(bruto || 0) || 0));
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
    entrega: modalidade === 'entrega' ? {
      ...effectiveDeliveryAddressMiniApp(state, els),
      salvarCadastro: state.checkout.saveAddressToProfile === true
    } : {},
    salvar_endereco_cadastro: modalidade === 'entrega' && state.checkout.saveAddressToProfile === true,
    pontos_usar: pontosUsarMiniApp(state, els),
    codigo_indicacao: cupomDigitadoMiniApp(state),
    observacao: observacoesCarrinhoMiniApp(els)
  };
}

export async function previewCheckoutMiniApp(state, els = {}) {
  await validateDeliveryAddressMiniApp(state, els);
  const payload = payloadPedidoMiniApp(state, els);
  if (!payload.items.length) throw new Error('Adicione ao menos um produto');
  return checkoutPreview(state, payload);
}

export async function createOrderMiniApp(state, els = {}) {
  await validateDeliveryAddressMiniApp(state, els);
  const payload = payloadPedidoMiniApp(state, els);
  if (!payload.items.length) throw new Error('Adicione ao menos um produto');
  return checkoutCreate(state, payload);
}

export async function finalizarCheckoutMiniApp(state, els, telegram, callbacks = {}) {
  if (modalidadeEntregaMiniApp(state, els) === 'entrega') {
    await validateDeliveryAddressMiniApp(state, els);
  }
  const payload = payloadPedidoMiniApp(state, els);
  if (!payload.items.length) {
    callbacks.showToast?.('Adicione ao menos um produto');
    return { ok: false };
  }
  payload.promotional_points_preview = promotionalPointsPreview(state);
  try {
    await sendMiniAppEvent(state, 'checkout_payment_start', {
      itemCount: payload.items.length,
      modalidade: payload.modalidade_entrega,
      usePoints: payload.pontos_usar > 0
    }).catch(() => null);
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
    try {
      const data = await bridgeSendAction(state, 'checkout/finalize', payload);
      if (data.pedido?.id) {
        state.pedidoAtual = data.pedido;
        state.pix = data.pix || null;
      }
      clearCart(state, () => limparClientOrderIdPendente(state));
      state.couponCode = '';
      state.usePointsIntent = false;
      if (els.cartNotes) els.cartNotes.value = '';
      persistCart(state);
      callbacks.render?.();
      callbacks.showToast?.('Pedido criado pela ponte da loja. O Pix esta pronto no Mini App.');
      return { ok: true, mode: 'bridge', data };
    } catch (_) {
      // Mantem o fallback legado abaixo apenas para compatibilidade.
    }
    payload.fallback_cart = payloadCarrinhoMiniApp(state, els);
    fallbackSendData(telegram?.webApp, payload);
    clearCart(state, () => limparClientOrderIdPendente(state));
    state.couponCode = '';
    state.usePointsIntent = false;
    if (els.cartNotes) els.cartNotes.value = '';
    persistCart(state);
    callbacks.render?.();
    const diagnostico = error?.message ? ` ${error.message}` : '';
    callbacks.showToast?.(telegram?.webApp
      ? `Nao finalizei pela API.${diagnostico} Enviei seu pedido ao Telegram.`
      : `Nao finalizei pela API.${diagnostico} Payload de fallback no console.`);
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
