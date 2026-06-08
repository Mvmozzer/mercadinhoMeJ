import { apiFetch } from './api.js';
import { writeText } from './storage.js';

export function normalizePixPayload(payload = {}) {
  const pix = payload.pix || payload.pagamento?.pix || payload || {};
  return {
    ativo: pix.ativo !== false && Boolean(pix.copiaCola || pix.copiaECola),
    copiaCola: String(pix.copiaCola || pix.copiaECola || '').trim(),
    qrCodeDataUrl: String(pix.qrCodeDataUrl || '').trim(),
    valor: Number(pix.valor || 0),
    txid: String(pix.txid || '').trim(),
    recebedor: String(pix.recebedor || '').trim(),
    cidade: String(pix.cidade || '').trim(),
    status: String(pix.status || payload.statusPagamento || '').trim(),
    modoConfirmacao: String(pix.modoConfirmacao || 'manual').trim()
  };
}

export function setPix(state, payload = {}) {
  state.pix = normalizePixPayload(payload);
  return state.pix;
}

export async function refreshPixStatus(state, pedidoId) {
  if (!pedidoId) return state.pix;
  const data = await apiFetch(state, `/api/miniapp/pedidos/${encodeURIComponent(pedidoId)}/pix`);
  return setPix(state, data.pix || data);
}

export async function uploadReceipt(state, pedidoId, payload = {}) {
  if (payload instanceof FormData) {
    return apiFetch(state, `/api/miniapp/pedidos/${encodeURIComponent(pedidoId)}/comprovante`, {
      method: 'POST',
      body: payload
    });
  }
  return apiFetch(state, `/api/miniapp/pedidos/${encodeURIComponent(pedidoId)}/comprovante`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function copyPix(state) {
  const pix = String(state.pix?.copiaCola || '').trim();
  if (!pix) throw new Error('Pix indisponível.');
  await writeTextToClipboard(pix);
  return pix;
}

async function writeTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  writeText('mj_mercadinho_last_pix_v1', text);
}
