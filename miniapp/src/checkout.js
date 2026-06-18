import { cartPayload } from './cart.js?v=2026.06.18.897';
import { fallbackSendData } from './telegram.js?v=2026.06.18.897';
import { retryApiFetchWithFreshRuntimeConfig } from './api.js?v=2026.06.18.897';

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

export async function telegramHandoff(state) {
  const payload = telegramCartPayload(state);
  try {
    return await retryApiFetchWithFreshRuntimeConfig(state, '/api/miniapp/checkout/telegram-handoff', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  } catch (error) {
    const enviado = fallbackSendData(payload);
    if (!enviado) {
      return {
        ok: false,
        fallback: false,
        erro: error.message,
        mensagem: 'Nao foi possivel enviar ao Telegram. Abra a lojinha pelo botao Abrir lojinha dentro da conversa do bot e tente novamente.'
      };
    }
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
