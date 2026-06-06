import {
  catalogSectionsFromPayload,
  cacheProducts,
  mergeProducts,
  normalizeCatalogPayload
} from './catalog.js';
import { API_BASE_KEY, MINIAPP_TOKEN_KEY, writeText, removeKey } from './storage.js';
import { normalizePublicApiBase, runningOnStaticHost } from './utils.js';

export function apiBase(state) {
  const url = new URL(window.location.href);
  const fromQuery = url.searchParams.get('apiBase');
  if (fromQuery) {
    const clean = fromQuery.replace(/\/+$/, '');
    state.apiBaseUrl = clean;
    writeText(API_BASE_KEY, clean);
    return clean;
  }
  return String(state.apiBaseUrl || '').replace(/\/+$/, '');
}

export async function carregarRuntimeConfigPages(state) {
  const url = new URL(window.location.href);
  if (!runningOnStaticHost() || url.searchParams.get('apiBase')) return;
  try {
    const res = await fetch('./runtime-config.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('runtime config indisponivel');
    const config = await res.json();
    if (!Object.prototype.hasOwnProperty.call(config || {}, 'apiBaseUrl')) return;
    const clean = normalizePublicApiBase(config.apiBaseUrl);
    if (clean) {
      state.apiBaseUrl = clean;
      writeText(API_BASE_KEY, clean);
    } else {
      state.apiBaseUrl = '';
      removeKey(API_BASE_KEY);
    }
  } catch (_) {
    // GitHub Pages can still render the static catalog while runtime-config.json is being published.
  }
}

export function apiBaseConfigurada(state) {
  return Boolean(apiBase(state)) || !runningOnStaticHost();
}

export function exigirApiBaseConfigurada(state) {
  if (apiBaseConfigurada(state)) return;
  throw new Error('Servidor do app nao configurado. Abra pelo servidor local ou informe apiBase.');
}

export async function apiFetch(state, path, options = {}) {
  exigirApiBaseConfigurada(state);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), Number(options.timeoutMs || 15000));
  const response = await fetch(`${apiBase(state)}${path}`, {
    ...options,
    credentials: 'include',
    signal: options.signal || controller.signal,
    headers: {
      'Content-Type': 'application/json',
      ...(state.miniappToken ? { Authorization: `Bearer ${state.miniappToken}` } : {}),
      ...(state.telegramInitData ? { 'X-Telegram-Init-Data': state.telegramInitData } : {}),
      ...(options.headers || {})
    }
  }).finally(() => window.clearTimeout(timeout));
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    const error = new Error(data.erro || data.error || `Falha HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export function normalizarStatusLojaPayload(payload = {}) {
  const loja = payload?.catalogo?.loja || payload?.loja || payload || {};
  const status = ['aberta', 'pausada', 'fechada'].includes(loja.status) ? loja.status : 'aberta';
  return {
    status,
    mensagem: String(loja.mensagem || '').trim(),
    aceitaPedidos: loja.aceitaPedidos !== false && status === 'aberta'
  };
}

export function atualizarStatusLoja(state, payload = {}) {
  state.loja = normalizarStatusLojaPayload(payload);
  return state.loja;
}

export async function authenticateMiniApp(state, webApp) {
  const initData = webApp?.initData || '';
  state.telegramInitData = initData;
  const data = await apiFetch(state, '/api/telegram/auth', {
    method: 'POST',
    body: JSON.stringify({
      initData,
      devUser: !initData ? { id: 'dev_telegram_1', first_name: 'Cliente', last_name: 'Dev' } : undefined
    })
  });
  state.authOk = true;
  state.authMode = data.modoDev ? 'dev' : 'telegram';
  state.miniappToken = data.token || '';
  if (state.miniappToken) writeText(MINIAPP_TOKEN_KEY, state.miniappToken);
  state.cliente = data.cliente || state.cliente || null;
  const me = await apiFetch(state, '/api/miniapp/me').catch(() => null);
  state.cliente = me?.cliente || state.cliente;
  return data;
}

export async function loadBootstrap(state) {
  const data = await apiFetch(state, '/api/miniapp/bootstrap');
  state.bootstrap = data;
  state.loja = {
    status: data.loja?.status || state.loja.status,
    mensagem: data.loja?.mensagemStatus || state.loja.mensagem,
    aceitaPedidos: data.loja?.aceitaPedidos !== false && data.loja?.status === 'aberta'
  };
  state.checkoutConfig = data.checkout || state.checkoutConfig;
  state.paymentConfig = data.pagamentos || state.paymentConfig;
  state.miniappDesign = data.design || data.catalogo?.design || state.miniappDesign;
  state.loyalty = {
    ...(state.loyalty || {}),
    ...(data.programa || {}),
    saldoPontos: Number(data.programa?.pontosDisponiveis || data.programa?.saldoPontos || 0),
    saldoReais: Number(data.programa?.saldoReais || data.programa?.valorPontosReais || 0),
    codigoIndicacao: data.programa?.codigoIndicacao || ''
  };
  state.orders = Array.isArray(data.pedidosAtivos) ? data.pedidosAtivos : state.orders;
  state.updateIntervalMs = Number(data.tempoAtualizacao || state.updateIntervalMs || 5000);
  state.lastUpdated = Date.now();
  return data;
}

export function perfilCadastroPayload(els = {}) {
  return {
    nome: String(els.profileName?.value || '').trim(),
    cpf: String(els.profileCpf?.value || '').trim(),
    dataNascimento: String(els.profileBirthDate?.value || '').trim(),
    telefone: String(els.profilePhone?.value || '').trim(),
    cep: String(els.profileCep?.value || '').trim(),
    rua: String(els.profileRua?.value || '').trim(),
    numero: String(els.profileNumero?.value || '').trim(),
    complemento: String(els.profileComplemento?.value || '').trim(),
    bairro: String(els.profileBairro?.value || '').trim(),
    cidade: String(els.profileCidade?.value || '').trim(),
    estado: String(els.profileEstado?.value || '').trim()
  };
}

export async function salvarCadastroMiniApp(state, els = {}) {
  const data = await apiFetch(state, '/api/miniapp/profile', {
    method: 'POST',
    body: JSON.stringify(perfilCadastroPayload(els))
  });
  state.cliente = data.cliente || state.cliente;
  return data;
}

export async function loadOrders(state) {
  if (!state.authOk) return [];
  try {
    const data = await apiFetch(state, '/api/miniapp/pedidos');
    state.orders = Array.isArray(data.pedidos) ? data.pedidos : [];
  } catch (_) {
    state.orders = [];
  }
  return state.orders;
}

export function shouldUsePagedCatalog(state) {
  return runningOnStaticHost() && Boolean(apiBase(state));
}

export async function loadProductsPage(state, { reset = false } = {}) {
  if (!shouldUsePagedCatalog(state)) return false;
  if (state.catalogPage.loadingMore) return true;
  if (!reset && !state.catalogPage.hasMore) return true;

  const nextPage = reset ? 1 : Number(state.catalogPage.page || 0) + 1;
  const params = new URLSearchParams({
    page: String(nextPage),
    pageSize: String(state.catalogPage.pageSize)
  });
  if (state.query.trim()) params.set('q', state.query.trim());
  if (state.section) params.set('section', state.section);

  state.catalogPage.usePaged = true;
  state.catalogPage.loadingMore = true;
  if (reset) {
    state.catalogLoading = true;
    state.products = [];
    state.catalogPage.page = 0;
    state.catalogPage.hasMore = false;
  }

  try {
    const res = await fetch(`${apiBase(state)}/api/client/catalog-page?${params.toString()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('catalogo paginado indisponivel');
    const payload = await res.json();
    atualizarStatusLoja(state, payload);
    state.miniappDesign = payload.catalogo?.design || payload.design || state.miniappDesign;
    const products = normalizeCatalogPayload(payload);
    state.products = reset ? products : mergeProducts(state.products, products);
    cacheProducts(state, products);
    state.catalogSections = catalogSectionsFromPayload(payload, state.products);
    state.catalogSource = 'api-page';
    state.catalogLoading = false;
    state.catalogPage.page = Number(payload.pagination?.page || nextPage);
    state.catalogPage.pageSize = Number(payload.pagination?.pageSize || state.catalogPage.pageSize);
    state.catalogPage.hasMore = payload.pagination?.hasMore === true;
    return true;
  } catch (_) {
    if (reset) state.catalogPage.usePaged = false;
    return false;
  } finally {
    state.catalogPage.loadingMore = false;
  }
}

export async function loadProducts(state) {
  state.catalogLoading = true;
  state.catalogSource = 'loading';
  if (await loadProductsPage(state, { reset: true })) return;
  try {
    const res = await fetch(`${apiBase(state)}/api/miniapp/catalogo`, { cache: 'no-store' });
    if (!res.ok) throw new Error('catalogo indisponivel');
    const payload = await res.json();
    atualizarStatusLoja(state, payload);
    state.miniappDesign = payload.catalogo?.design || payload.design || state.miniappDesign;
    state.products = normalizeCatalogPayload(payload);
    cacheProducts(state, state.products);
    state.catalogSections = catalogSectionsFromPayload(payload, state.products);
    state.catalogSource = 'api';
  } catch (_) {
    try {
      const res = await fetch('./catalogo.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('catalogo indisponivel');
      const payload = await res.json();
      atualizarStatusLoja(state, payload);
      state.miniappDesign = payload.catalogo?.design || payload.design || state.miniappDesign;
      state.products = normalizeCatalogPayload(payload);
      cacheProducts(state, state.products);
      state.catalogSections = catalogSectionsFromPayload(payload, state.products);
      state.catalogSource = 'static';
    } catch (error) {
      try {
        const res = await fetch('./produtos.json', { cache: 'no-store' });
        if (!res.ok) throw new Error('catalogo indisponivel');
        state.products = normalizeCatalogPayload(await res.json());
        cacheProducts(state, state.products);
        state.catalogSections = catalogSectionsFromPayload(null, state.products);
        state.catalogSource = 'legacy';
      } catch (_) {
        state.products = [];
        state.catalogSections = [];
        state.catalogSource = 'empty';
      }
    }
  }
  state.catalogLoading = false;
}

export async function loadMoreProducts(state) {
  if (!state.catalogPage.usePaged || !state.catalogPage.hasMore || state.catalogPage.loadingMore) return false;
  return loadProductsPage(state, { reset: false });
}

export async function sincronizarStatusLoja(state) {
  try {
    const res = await fetch(`${apiBase(state)}/loja/status`, { cache: 'no-store' });
    if (!res.ok) return state.loja;
    return atualizarStatusLoja(state, await res.json());
  } catch (_) {
    return state.loja;
  }
}

export async function checkoutPreview(state, payload) {
  const data = await apiFetch(state, '/api/miniapp/checkout/preview', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  state.checkout.preview = data;
  state.lastUpdated = Date.now();
  return data;
}

export async function checkoutCreate(state, payload) {
  const data = await apiFetch(state, '/api/miniapp/checkout/create', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  state.pedidoAtual = data.pedido || null;
  state.pix = data.pix || null;
  state.checkout.lastCreate = data;
  state.lastUpdated = Date.now();
  return data;
}

export async function getOrderPix(state, pedidoId) {
  const data = await apiFetch(state, `/api/miniapp/pedidos/${encodeURIComponent(pedidoId)}/pix`);
  state.pix = data.pix || state.pix;
  return data.pix;
}

export async function getOrderStatus(state, pedidoId) {
  const data = await apiFetch(state, `/api/miniapp/pedidos/${encodeURIComponent(pedidoId)}/status`);
  state.orderStatus = data;
  state.lastUpdated = Date.now();
  return data;
}

export async function getOrderTracking(state, pedidoId) {
  const data = await apiFetch(state, `/api/miniapp/pedidos/${encodeURIComponent(pedidoId)}/tracking`);
  state.tracking = data.pedido || null;
  return state.tracking;
}

export async function getOrderLocation(state, pedidoId) {
  const data = await apiFetch(state, `/api/miniapp/pedidos/${encodeURIComponent(pedidoId)}/location`);
  state.location = data;
  return data;
}

export async function preencherEnderecoPorCep(els = {}) {
  const cep = String(els.profileCep?.value || '').replace(/\D/g, '');
  if (cep.length !== 8) return;
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await response.json();
    if (!response.ok || data.erro) return;
    if (els.profileRua) els.profileRua.value = data.logradouro || els.profileRua.value;
    if (els.profileBairro) els.profileBairro.value = data.bairro || els.profileBairro.value;
    if (els.profileCidade) els.profileCidade.value = data.localidade || els.profileCidade.value;
    if (els.profileEstado) els.profileEstado.value = data.uf || els.profileEstado.value;
  } catch (_) {}
}
