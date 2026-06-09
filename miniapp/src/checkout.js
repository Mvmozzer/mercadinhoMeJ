import { cartPayload } from './cart.js';
import { fallbackSendData } from './telegram.js';
import { retryApiFetchWithFreshRuntimeConfig } from './api.js';

function telegramCartPayload(state) {
  const itens = cartPayload(state);
  return {
    type: 'mercadinho_cart',
    origem: 'miniapp',
    checkout: 'telegram',
    items: itens,
    itens
  };
}

export async function telegramHandoff(state) {
  const payload = telegramCartPayload(state);
  try {
    return await retryApiFetchWithFreshRuntimeConfig(state, '/api/miniapp/checkout/telegram-handoff', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  } catch (error) {
    fallbackSendData(payload);
    return {
      ok: false,
      fallback: true,
      erro: error.message,
      mensagem: 'Carrinho enviado ao Telegram. Termine entrega, retirada e Pix pelo chat.'
    };
  }
}

export async function checkoutCreate(state) {
  return telegramHandoff(state);
}
