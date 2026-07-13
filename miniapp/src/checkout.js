import { cartPayload } from './cart.js?v=2026.07.13.319';
import { retryApiFetchWithFreshRuntimeConfig } from './api.js?v=2026.07.13.319';
import { fallbackSendData, telegramPayloadBytes, TELEGRAM_SEND_DATA_MAX_BYTES } from './telegram.js?v=2026.07.13.319';

const MINIAPP_CHECKOUT_CREATE_PATH = '/api/miniapp/checkout/create';
const TELEGRAM_OFFLINE_ATTEMPT_KEY = 'mj_telegram_offline_attempt_v1';
const TELEGRAM_OFFLINE_ATTEMPT_TTL_MS = 24 * 60 * 60 * 1000;

function normalizeTelegramCartItem(item = {}) {
  const quantity = Number(item.quantidade ?? item.quantity ?? item.q ?? 0);
  const productId = String(item.produto_id || item.produtoId || item.id || item.p || '').trim().slice(0, 120);
  const weighted = item.saleMode === 'weighted' || item.modo_venda === 'granel' || item.m === 'g';
  return {
    p: productId,
    q: weighted ? Number(quantity.toFixed(3)) : Math.trunc(quantity),
    ...(weighted ? { m: 'g' } : {})
  };
}

function offlineAttemptStorage() {
  return globalThis.localStorage || globalThis.window?.localStorage || null;
}

function clientOrderFingerprint(items = []) {
  return JSON.stringify(items.map(normalizeTelegramCartItem));
}

function saveOfflineAttempt(id, fingerprint) {
  try {
    offlineAttemptStorage()?.setItem(TELEGRAM_OFFLINE_ATTEMPT_KEY, JSON.stringify({
      id,
      fingerprint,
      createdAt: Date.now()
    }));
  } catch (_) {
    // O estado em memoria ainda protege retries dentro da mesma abertura.
  }
}

function loadOfflineAttempt(fingerprint) {
  try {
    const raw = offlineAttemptStorage()?.getItem(TELEGRAM_OFFLINE_ATTEMPT_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    const age = Date.now() - Number(saved?.createdAt || 0);
    const id = String(saved?.id || '').trim().slice(0, 80);
    if (!id || saved?.fingerprint !== fingerprint || age < 0 || age > TELEGRAM_OFFLINE_ATTEMPT_TTL_MS) return '';
    return id;
  } catch (_) {
    return '';
  }
}

function ensureClientOrderId(state, items = []) {
  const fingerprint = clientOrderFingerprint(items);
  const atual = String(state.clientOrderId || '').trim().slice(0, 80);
  const fingerprintAtual = String(state.clientOrderFingerprint || '');
  if (atual && (!fingerprintAtual || fingerprintAtual === fingerprint)) {
    state.clientOrderId = atual;
    state.clientOrderFingerprint = fingerprint;
    saveOfflineAttempt(atual, fingerprint);
    return atual;
  }

  const persistido = loadOfflineAttempt(fingerprint);
  state.clientOrderId = persistido || `miniapp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  state.clientOrderFingerprint = fingerprint;
  saveOfflineAttempt(state.clientOrderId, fingerprint);
  return state.clientOrderId;
}

function telegramCartPayload(state) {
  const itens = cartPayload(state).map(normalizeTelegramCartItem);
  return {
    type: 'mercadinho_cart',
    v: 2,
    origem: 'miniapp',
    checkout: 'telegram',
    client_order_id: ensureClientOrderId(state, itens),
    items: itens
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
    client_order_id: ensureClientOrderId(state, itens),
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
    const tamanho = telegramPayloadBytes(payload);
    return {
      ok: false,
      fallback: false,
      client_order_id: payload.client_order_id,
      mensagem: tamanho > TELEGRAM_SEND_DATA_MAX_BYTES
        ? 'Seu carrinho ficou grande demais para a contingencia do Telegram. Remova alguns itens e tente novamente pelo botao Abrir lojinha dentro da conversa do bot.'
        : 'Nao foi possivel enviar ao Telegram. Abra a lojinha pelo botao Abrir lojinha dentro da conversa do bot. O menu do Telegram nao envia carrinho em Mini App estatico.'
    };
  }
  const mensagem = 'Solicitacao entregue ao Telegram e aguardando confirmacao do bot. Quando o sistema se conectar, preco e estoque serao validados e o bot respondera na conversa. O Telegram pode guardar a solicitacao por ate 24 horas.';
  return {
    ok: true,
    fallback: true,
    client_order_id: payload.client_order_id,
    mensagem,
    telegram: {
      status: 'aguardando_confirmacao',
      client_order_id: payload.client_order_id,
      mensagem
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
    mensagem: result.ok
      ? `Pagamento no Mini App indisponivel. ${result.telegram?.mensagem || result.mensagem}`
      : result.mensagem
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
