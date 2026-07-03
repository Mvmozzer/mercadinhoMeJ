import { cartPayload } from './cart.js?v=2026.07.02.273';
import { retryApiFetchWithFreshRuntimeConfig } from './api.js?v=2026.07.02.273';
import { fallbackSendData } from './telegram.js?v=2026.07.02.273';

const MINIAPP_CHECKOUT_CREATE_PATH = '/api/miniapp/checkout/create';

function normalizeTelegramCartItem(item = {}) {
  const quantity = Number(item.quantidade || item.quantity || 0);
  const price = Number(item.preco || item.price || 0);
  return {
    ...item,
    quantidade_solicitada: item.quantidade_solicitada ?? quantity,
    peso_estimado: item.peso_estimado ?? (item.saleMode === 'weighted' ? quantity : null),
    subtotal_estimado_exibido: item.subtotal_estimado_exibido ?? Number((quantity * price).toFixed(2)),
    modo_venda: item.saleMode === 'weighted' ? 'granel' : 'unidade'
  };
}

function ensureClientOrderId(state) {
  if (!state.clientOrderId) {
    state.clientOrderId = `miniapp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
  return state.clientOrderId;
}

function telegramCartPayload(state) {
  const itens = cartPayload(state).map(normalizeTelegramCartItem);
  return {
    type: 'mercadinho_cart',
    origem: 'miniapp',
    checkout: 'telegram',
    items: itens,
    itens
  };
}

function miniAppOrderPayload(state) {
  const itens = cartPayload(state).map(item => ({
    ...item,
    produto_id: item.produto_id || item.id,
    quantidade: item.quantidade || item.quantity || item.qtd || 0
  }));
  return {
    type: 'mercadinho_order',
    origem: 'miniapp',
    checkout: 'miniapp',
    client_order_id: ensureClientOrderId(state),
    items: itens,
    itens,
    modalidade_entrega: state.selectedDeliveryMode || 'retirada',
    forma_pagamento: 'pix'
  };
}

export function paymentModeForCustomer(state = {}) {
  const checkout = state.checkout || {};
  const raw = String(
    checkout.pagamentoModo ||
    checkout.modoPagamentoCliente ||
    checkout.modo_pagamento_cliente ||
    checkout.paymentMode ||
    ''
  ).trim().toLowerCase();
  if (checkout.pagamentoMiniAppAtivo === true || raw === 'miniapp') return 'miniapp';
  return 'telegram';
}

export function isMiniAppPaymentEnabled(state = {}) {
  return paymentModeForCustomer(state) === 'miniapp';
}

export async function telegramHandoff(state) {
  const payload = telegramCartPayload(state);
  const enviado = fallbackSendData(payload);
  if (!enviado) {
    return {
      ok: false,
      fallback: false,
      mensagem: 'Nao foi possivel enviar ao Telegram. Abra a lojinha pelo botao Abrir lojinha dentro da conversa do bot. O menu do Telegram nao envia carrinho em Mini App estatico.'
    };
  }
  return {
    ok: true,
    fallback: true,
    telegram: {
      mensagem: 'Carrinho enviado ao bot. Termine entrega, retirada, Pix e comprovante pelo Telegram.'
    }
  };
}

export async function miniAppPaymentCheckout(state) {
  const data = await retryApiFetchWithFreshRuntimeConfig(state, MINIAPP_CHECKOUT_CREATE_PATH, {
    method: 'POST',
    critical: true,
    body: JSON.stringify(miniAppOrderPayload(state))
  });
  state.lastMiniAppCheckout = data || {};
  state.pedidoAtual = data?.pedido || null;
  state.pix = data?.pix || null;
  const modo = data?.checkout?.modo || data?.modo || 'miniapp';
  return {
    ...data,
    ok: data?.ok !== false,
    checkout: {
      ...(data?.checkout || {}),
      modo,
      fallbackTelegramAtivo: true
    }
  };
}

export async function fallbackTelegramFromMiniAppPayment(state, error) {
  const result = await telegramHandoff(state);
  return {
    ...result,
    fallbackMiniAppPayment: true,
    miniappErro: error?.message || String(error || ''),
    mensagem: 'Pagamento no Mini App indisponivel. Vamos continuar pelo Telegram.'
  };
}

export async function checkoutCreate(state) {
  if (!isMiniAppPaymentEnabled(state)) return telegramHandoff(state);
  try {
    return await miniAppPaymentCheckout(state);
  } catch (error) {
    return fallbackTelegramFromMiniAppPayment(state, error);
  }
}
