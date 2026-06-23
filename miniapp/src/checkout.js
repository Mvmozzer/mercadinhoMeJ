import { cartPayload } from './cart.js?v=2026.06.23.304';
import { fallbackSendData } from './telegram.js?v=2026.06.23.304';

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

export async function checkoutCreate(state) {
  return telegramHandoff(state);
}
