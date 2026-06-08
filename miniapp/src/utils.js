export function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

export function titleFromId(value) {
  return String(value || 'Outros')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase());
}

export function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizeUnit(value, fallback = 'un') {
  const unit = String(value || fallback || 'un').trim().toLowerCase();
  if (['unidade', 'unid', 'unit'].includes(unit)) return 'un';
  if (['l', 'lt'].includes(unit)) return 'litro';
  if (['grama', 'gramas'].includes(unit)) return 'g';
  return unit || 'un';
}

export function formatMeasure(value, unit = 'un') {
  const normalized = normalizeUnit(unit);
  const amount = Number(value || 0);
  const formatted = amount.toLocaleString('pt-BR', {
    maximumFractionDigits: normalized === 'un' ? 0 : 3
  });
  return `${formatted} ${normalized}`;
}

export function imageUrl(product) {
  const raw = String(product?.imagem || product?.imagem_url || product?.imagemUrl || product?.image || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^(javascript|data|vbscript|file|blob):/i.test(raw)) return '';
  return encodeURI(raw.replace(/^\/+/, ''));
}

export function safeCssColor(value, fallback) {
  const text = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text : fallback;
}

export function debounce(callback, delay = 220) {
  let timer = null;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => callback(...args), delay);
  };
}

export function compactWhitespace(value, maxLength = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

export function runningOnStaticHost() {
  if (window.location.protocol === 'file:') return true;
  const host = String(window.location.hostname || '').toLowerCase();
  if (!host) return false;
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
  if (/^(127\.|0\.0\.0\.0$|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) return false;
  return true;
}

export function isTemporaryPublicApiBase(value) {
  const text = normalizeUrlProtocol(value);
  if (!text) return false;
  try {
    const host = new URL(text).hostname.toLowerCase();
    return [
      /\.lhr\.life$/,
      /\.trycloudflare\.com$/,
      /\.loca\.lt$/,
      /\.localhost\.run$/,
      /\.ngrok-free\.app$/,
      /\.ngrok\.io$/,
      /\.ngrok\.app$/,
      /\.localtunnel\.me$/,
      /\.serveo\.net$/
    ].some(pattern => pattern.test(host));
  } catch (_) {
    return false;
  }
}

export function normalizeUrlProtocol(value) {
  return String(value || '').trim()
    .replace(/^(https?):\/?(?=[a-z0-9.-])([a-z0-9.-]+(?::\d+)?(?:[/?#].*)?)$/i, '$1://$2');
}

export function normalizePublicApiBase(value, options = {}) {
  const text = normalizeUrlProtocol(value);
  if (!text) return '';
  try {
    const url = new URL(text);
    if (runningOnStaticHost() && url.protocol !== 'https:') return '';
    const allowTemporary = options.allowTemporary === true ||
      window.__ALLOW_TEMP_TUNNEL_API__ === true ||
      new URL(window.location.href).searchParams.get('allowTempApi') === '1';
    if (!allowTemporary && runningOnStaticHost() && isTemporaryPublicApiBase(url.toString())) return '';
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/+$/, '');
  } catch (_) {
    return '';
  }
}

export function clientOrderId() {
  return `miniapp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
