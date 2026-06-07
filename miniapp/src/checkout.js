import {
  bridgeSendAction,
  sendMiniAppEvent,
  syncMiniAppCart,
  telegramHandoff
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

export async function previewCheckoutMiniApp(state, els = {}) {
  const payload = payloadCarrinhoMiniApp(state, els);
  if (!payload.items.length) throw new Error('Adicione ao menos um produto');
  return syncMiniAppCart(state, payload);
}

export async function finalizarCheckoutMiniApp(state, els, telegram, callbacks = {}) {
  const payload = payloadCarrinhoMiniApp(state, els);
  if (!payload.items.length) {
    callbacks.showToast?.('Adicione ao menos um produto');
    return { ok: false };
  }
  payload.promotional_points_preview = promotionalPointsPreview(state);
  try {
    await sendMiniAppEvent(state, 'checkout_telegram_handoff_start', {
      itemCount: payload.items.length
    }).catch(() => null);
    const data = await telegramHandoff(state, payload);
    clearCart(state, () => limparClientOrderIdPendente(state));
    state.couponCode = '';
    state.usePointsIntent = false;
    if (els.cartNotes) els.cartNotes.value = '';
    persistCart(state);
    callbacks.render?.();
    callbacks.showToast?.('Carrinho enviado. Continue entrega e pagamento no Telegram.');
    return { ok: true, mode: 'api', data };
  } catch (error) {
    try {
      const data = await bridgeSendAction(state, 'cart/handoff', payload);
      clearCart(state, () => limparClientOrderIdPendente(state));
      state.couponCode = '';
      state.usePointsIntent = false;
      if (els.cartNotes) els.cartNotes.value = '';
      persistCart(state);
      callbacks.render?.();
      callbacks.showToast?.('Carrinho enviado pela ponte da loja. Continue no Telegram.');
      return { ok: true, mode: 'bridge', data };
    } catch (_) {
      // Mantem o fallback legado abaixo apenas para compatibilidade.
    }
    fallbackSendData(telegram?.webApp, payload);
    clearCart(state, () => limparClientOrderIdPendente(state));
    state.couponCode = '';
    state.usePointsIntent = false;
    if (els.cartNotes) els.cartNotes.value = '';
    persistCart(state);
    callbacks.render?.();
    const diagnostico = error?.message ? ` ${error.message}` : '';
    callbacks.showToast?.(telegram?.webApp
      ? `Nao consegui enviar pela API.${diagnostico} Enviei seu carrinho ao Telegram.`
      : `Nao consegui enviar pela API.${diagnostico} Payload de fallback no console.`);
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
