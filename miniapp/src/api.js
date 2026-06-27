import { isTemporaryPublicApiBase } from './utils.js?v=2026.06.27.123';
import { applySnapshot } from './state.js?v=2026.06.27.123';

export const TELEGRAM_AUTH_PATH = '/api/telegram/auth';
export const MINIAPP_API_PATHS = {
  bootstrap: '/api/miniapp/bootstrap',
  health: '/api/miniapp/health',
  customer: '/api/miniapp/me',
  catalog: '/api/miniapp/catalogo',
  cartSync: '/api/miniapp/carrinho/sync',
  checkoutCreate: '/api/miniapp/checkout/create',
};

function currentLocation() {
  return globalThis.location || globalThis.window?.location || {
    href: 'http://localhost/',
    hostname: 'localhost',
    protocol: 'http:',
    origin: 'http://localhost',
  };
}

function normalizeApiBaseUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const fixed = raw
    .replace(/^https:([^/])/, 'https://$1')
    .replace(/^http:([^/])/, 'http://$1');
  return fixed.replace(/\/+$/, '');
}

export function apiBaseFromLocation() {
  const loc = currentLocation();
  const url = new URL(loc.href);
  const query = url.searchParams.get('apiBase') || '';
  if (query) return normalizeApiBaseUrl(query);
  if (globalThis.window?.__API_BASE__) return normalizeApiBaseUrl(globalThis.window.__API_BASE__);
  if (/github\.io$/i.test(loc.hostname) || loc.protocol === 'file:') return '';
  return normalizeApiBaseUrl(loc.origin || `${loc.protocol}//${loc.hostname}`);
}

export function apiBase(state = {}) {
  return normalizeApiBaseUrl(state.apiBase || state.apiBaseUrl || apiBaseFromLocation());
}

export async function carregarRuntimeConfigPages(state, options = {}) {
  const loc = currentLocation();
  const localBase = apiBaseFromLocation();
  const shouldFetchRuntimeConfig = options.force === true || /github\.io$/i.test(loc.hostname) || loc.protocol === 'file:';
  if (shouldFetchRuntimeConfig) {
    const candidates = ['./runtime-config.json', '../runtime-config.json'];
    for (const candidate of candidates) {
      try {
        const res = await fetch(`${candidate}?ts=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const runtimeBase = normalizeApiBaseUrl(data.apiBaseUrl || data.publicApiBaseUrl || state.apiBaseUrl || state.apiBase || localBase);
          state.apiBase = runtimeBase;
          state.apiBaseUrl = runtimeBase;
          state.webBuild = String(data.webBuild || '').trim() || state.webBuild;
          state.allowTemporaryApiBase = data.allowTemporaryApiBase === true;
          return data;
        }
      } catch {}
    }
  }
  state.apiBase = normalizeApiBaseUrl(state.apiBase || state.apiBaseUrl || localBase);
  state.apiBaseUrl = state.apiBase;
  if (options.force === true) return { ok: false };
  return { ok: true };
}

export function headers(state) {
  const initData = globalThis.window?.Telegram?.WebApp?.initData || '';
  const token = globalThis.window?.MJMiniAppBridge?.getSessionToken?.() || globalThis.localStorage?.getItem?.('mj_miniapp_bridge_token') || globalThis.window?.localStorage?.getItem?.('mj_miniapp_bridge_token') || '';
  return {
    'Content-Type': 'application/json',
    ...(initData ? { 'X-Telegram-Init-Data': initData } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function apiDiagnosticMessage(error) {
  return error?.message || 'Não foi possível conectar ao painel agora.';
}

export async function requestApi(state, path, options = {}) {
  const base = apiBase(state);
  if (!base) throw new Error('A API pública da loja não está configurada.');
  const url = new URL(currentLocation().href);
  const baseTemporariaBloqueada = isTemporaryPublicApiBase(base) && !url.searchParams.has('allowTempApi') && options.critical === true && state.allowTemporaryApiBase !== true;
  if (baseTemporariaBloqueada) throw new Error('Base pública temporária bloqueada para checkout.');
  const res = await fetch(base + path, { ...options, headers: { ...headers(state), ...(options.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.erro || data.error || `Falha HTTP ${res.status}`);
  return data;
}

export async function retryApiFetchWithFreshRuntimeConfig(state, path, options = {}) {
  try {
    return await requestApi(state, path, options);
  } catch (error) {
    await carregarRuntimeConfigPages(state, { force: true });
    return requestApi(state, path, options);
  }
}

export async function authenticateBridge(state) {
  const bridge = globalThis.window?.MJMiniAppBridge;
  if (!bridge?.init) return null;
  try {
    const data = await bridge.init({
      apiBase: apiBase(state),
      devChatId: globalThis.window?.Telegram?.WebApp?.initDataUnsafe?.user?.id || '970814630',
    });
    state.authOk = true;
    state.bridgeReady = true;
    if (data.snapshot) applySnapshot(state, data.snapshot);
    return data;
  } catch {
    return null;
  }
}

export async function loadBootstrap(state) { return retryApiFetchWithFreshRuntimeConfig(state, MINIAPP_API_PATHS.bootstrap); }
export async function loadHealth(state) { return retryApiFetchWithFreshRuntimeConfig(state, MINIAPP_API_PATHS.health).catch(() => null); }
export async function loadCustomer(state) { return retryApiFetchWithFreshRuntimeConfig(state, MINIAPP_API_PATHS.customer).catch(() => null); }
export async function loadCatalog(state) { return retryApiFetchWithFreshRuntimeConfig(state, MINIAPP_API_PATHS.catalog); }
export async function loadStaticCatalog() {
  const candidates = ['./catalogo.json', '../catalogo.json'];
  let lastError = null;
  for (const path of candidates) {
    try {
      const sep = path.includes('?') ? '&' : '?';
      const res = await fetch(`${path}${sep}ts=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) return res.json();
      lastError = new Error(`Falha HTTP ${res.status}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Catálogo estático indisponível.');
}
export async function loadCatalogWithFallback(state) {
  try {
    return await loadCatalog(state);
  } catch (error) {
    if (!apiBase(state)) return loadStaticCatalog();
    try {
      return await loadStaticCatalog();
    } catch {
      throw error;
    }
  }
}
export async function syncCart(state, payload) {
  const normalizedPayload = payload?.items ? payload : { ...payload, items: payload?.itens || [] };
  return retryApiFetchWithFreshRuntimeConfig(state, MINIAPP_API_PATHS.cartSync, { method: 'POST', body: JSON.stringify(normalizedPayload) }).catch(() => null);
}
export async function sendMiniAppEvent(state, tipo, payload = {}) { return retryApiFetchWithFreshRuntimeConfig(state, '/api/miniapp/events', { method: 'POST', body: JSON.stringify({ tipo, payload }) }).catch(() => null); }
export async function bridgeSendAction(state, action, payload = {}) { return globalThis.window?.MJMiniAppBridge?.sendAction ? globalThis.window.MJMiniAppBridge.sendAction(action, payload) : null; }

export async function uploadPixReceipt(state, pedidoId, options = {}) {
  const id = String(pedidoId || '').trim();
  if (!id) throw new Error('Pedido não encontrado para enviar comprovante.');
  const path = `/api/miniapp/pedidos/${encodeURIComponent(id)}/comprovante`;
  const texto = String(options.texto || '').trim();
  if (options.arquivo) {
    const body = new FormData();
    body.append('comprovante', options.arquivo);
    if (texto) body.append('texto', texto);
    const requestHeaders = headers(state);
    delete requestHeaders['Content-Type'];
    return retryApiFetchWithFreshRuntimeConfig(state, path, {
      method: 'POST',
      body,
      headers: requestHeaders
    });
  }
  return retryApiFetchWithFreshRuntimeConfig(state, path, {
    method: 'POST',
    body: JSON.stringify({ texto }),
    headers: {
      ...headers(state),
      'Content-Type': 'application/json'
    }
  });
}

export function atualizarStatusLoja(state, payload = {}, options = {}) {
  if (options.source === 'static') return state.loja || state.store;
  const loja = payload.loja || payload.catalogo?.loja;
  if (!loja) return state.loja || state.store;
  if (state.loja) state.loja = { ...state.loja, ...loja };
  if (state.store) state.store = { ...state.store, ...loja };
  return state.loja || state.store;
}
