import { apiFetch } from './api.js';

export async function loadLoyalty(state) {
  if (!state.authOk) return state.loyalty;
  const data = await apiFetch(state, '/api/miniapp/loyalty');
  state.loyalty = {
    saldoPontos: Number(data.saldoPontos || data.programa?.saldoPontos || 0),
    saldoReais: Number(data.saldoReais || data.programa?.saldoReais || 0),
    codigoIndicacao: String(data.codigoIndicacao || data.programa?.codigoIndicacao || ''),
    historico: Array.isArray(data.historico) ? data.historico : [],
    regras: data.regras || data.programa?.regras || {},
    programa: data.programa || {}
  };
  return state.loyalty;
}

export async function previewPoints(state, payload) {
  return apiFetch(state, '/api/miniapp/loyalty/preview-redemption', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function applyReferralCode(state, codigoIndicacao) {
  return apiFetch(state, '/api/miniapp/loyalty/apply-referral', {
    method: 'POST',
    body: JSON.stringify({ codigo_indicacao: codigoIndicacao })
  });
}

export async function shareReferralCode(state) {
  const code = String(state.loyalty?.codigoIndicacao || state.cliente?.codigoIndicacao || '').trim();
  const text = code
    ? `Use meu codigo ${code} no Mercadinho M&J.`
    : 'Abra o Mercadinho M&J pelo Telegram.';
  if (navigator.share) {
    await navigator.share({ text });
    return text;
  }
  await navigator.clipboard?.writeText?.(text);
  return text;
}
