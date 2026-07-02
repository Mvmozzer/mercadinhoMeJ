import { initTelegram, telegramUserId } from './telegram.js?v=2026.07.02.044';
import { carregarRuntimeConfigPages, authenticateBridge, loadBootstrap, loadCatalogWithFallback, loadHealth, loadCustomer } from './api.js?v=2026.07.02.044';
import { createRenderer } from './render.js?v=2026.07.02.044';
import { createState, applySnapshot, normalizeMiniAppUi, loyaltyProgramEnabled } from './state.js?v=2026.07.02.044';
import { normalizeCatalog } from './catalog.js?v=2026.07.02.044';
import { reconcileCartWithCatalog, restoreCart } from './cart.js?v=2026.07.02.044';
import { loadLoyalty } from './loyalty.js?v=2026.07.02.044';
import { loadOrders } from './orders.js?v=2026.07.02.044';

function sincronizarStatusLoja(state, health) {
  if (health?.loja) state.store = { ...state.store, ...health.loja };
  return state.store;
}
function miniappUiFromPayload(payload) {
  return payload?.miniappUi || payload?.catalogo?.miniappUi || null;
}
function stableStringify(value) {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}
function miniappRefreshSignature(state = {}) {
  return stableStringify({
    pollingMs: state.pollingMs || 0,
    store: state.store || {},
    cliente: state.cliente || {},
    loyalty: { ativo: state.loyalty?.ativo },
    checkout: state.checkout || {},
    miniappUi: state.miniappUi || {}
  });
}
function miniappPollingMs(state = {}) {
  const value = Number(state.pollingMs || 7000);
  if (!Number.isFinite(value)) return 7000;
  return Math.max(3000, Math.min(60000, Math.round(value)));
}
function withTimeout(promise, ms = 2500) {
  let timer = null;
  return Promise.race([
    promise,
    new Promise(resolve => {
      timer = window.setTimeout(() => resolve(null), ms);
    })
  ]).finally(() => {
    if (timer) window.clearTimeout(timer);
  });
}
async function hydrateCustomerBeforeRender(state) {
  if (!state.apiBase && !state.authOk && !state.bridgeReady) return null;
  const customer = await withTimeout(loadCustomer(state).catch(() => null));
  if (customer?.cliente) {
    state.telegramId = String(customer.cliente.telegramId || customer.cliente.telegram_id || customer.cliente.chatId || state.telegramId || '').trim();
    applySnapshot(state, { telegramId: customer.cliente.telegramId || state.telegramId, cliente: customer.cliente });
  }
  return customer;
}
async function refreshMiniAppVisualConfig(state) {
  const before = miniappRefreshSignature(state);
  const health = await loadHealth(state);
  if (health?.checkout?.pollingMs) state.pollingMs = health.checkout.pollingMs;
  sincronizarStatusLoja(state, health);
  if (health?.checkout) state.checkout = { ...state.checkout, ...health.checkout };
  if (health?.programa) state.loyalty = { ...state.loyalty, ...health.programa };
  const customer = await loadCustomer(state);
  if (customer?.cliente) applySnapshot(state, { telegramId: customer.cliente.telegramId, cliente: customer.cliente });
  const ui = miniappUiFromPayload(health);
  if (ui) state.miniappUi = normalizeMiniAppUi(ui);
  if (!ui) {
    const catalog = await loadCatalogWithFallback(state).catch(() => null);
    const catalogUi = miniappUiFromPayload(catalog);
    if (catalogUi) state.miniappUi = normalizeMiniAppUi(catalogUi);
    const catalogWholesale = catalog?.catalogo?.atacado || catalog?.atacado;
    if (catalogWholesale) {
      const normalized = normalizeCatalog(catalog);
      state.wholesale = normalized.wholesale;
      state.atacado = normalized.wholesale;
    }
  }
  return { health, changed: miniappRefreshSignature(state) !== before };
}
function pollMiniApp(renderer, state) {
  refreshMiniAppVisualConfig(state)
    .then(({ changed }) => {
      if (changed) renderer?.render?.();
    })
    .catch(() => null);
}
function startPolling(renderer, state) { return window.setInterval(() => pollMiniApp(renderer, state), miniappPollingMs(state)); }
function applyBridgeSnapshot(renderer, state, snapshot = {}) {
  const before = miniappRefreshSignature(state);
  applySnapshot(state, snapshot);
  if (miniappRefreshSignature(state) !== before) renderer?.render?.();
}
function bindBridgeCustomerSync(renderer, state) {
  const bridge = globalThis.window?.MJMiniAppBridge;
  if (!bridge?.state) return false;
  if (!bridge.state.sessionToken || !bridge.state.apiBase) return false;
  const previousSnapshot = bridge.state.onSnapshot;
  const previousEvents = bridge.state.onEvents;
  const previousError = bridge.state.onError;
  bridge.state.onSnapshot = snapshot => {
    if (typeof previousSnapshot === 'function') previousSnapshot(snapshot);
    applyBridgeSnapshot(renderer, state, snapshot);
  };
  bridge.state.onEvents = eventos => {
    if (typeof previousEvents === 'function') previousEvents(eventos);
    const before = miniappRefreshSignature(state);
    loadCustomer(state)
      .then(customer => {
        if (customer?.cliente) applySnapshot(state, { telegramId: customer.cliente.telegramId, cliente: customer.cliente });
        if (miniappRefreshSignature(state) !== before) renderer?.render?.();
      })
      .catch(error => bridge.state.onError?.(error));
  };
  bridge.state.onError = error => {
    if (typeof previousError === 'function') previousError(error);
  };
  bridge.loadEvents?.({ snapshot: true }).catch(error => bridge.state.onError?.(error));
  if (bridge.startStream?.() === true) return true;
  if (typeof bridge.startPolling === 'function') {
    bridge.startPolling(Math.min(2000, miniappPollingMs(state)));
    return true;
  }
  return false;
}

async function init() {
  initTelegram();
  const state = createState();
  state.telegramId = telegramUserId();
  restoreCart(state);
  await carregarRuntimeConfigPages(state);
  await authenticateBridge(state);
  const health = await loadHealth(state);
  if (health?.checkout?.pollingMs) state.pollingMs = health.checkout.pollingMs;
  sincronizarStatusLoja(state, health);
  if (miniappUiFromPayload(health)) state.miniappUi = normalizeMiniAppUi(miniappUiFromPayload(health));
  try {
    const boot = await loadBootstrap(state);
    applySnapshot(state, {
      telegramId: boot?.telegramId || boot?.cliente?.telegramId,
      loja: boot?.loja,
      cliente: boot?.cliente,
      programa: boot?.programa,
      checkout: boot?.checkout,
      pagamentos: boot?.pagamentos,
      miniappUi: boot?.miniappUi,
      atacado: boot?.atacado || boot?.catalogo?.atacado,
      pedidos: Array.isArray(boot?.pedidosAtivos) ? boot.pedidosAtivos : undefined
    });
    const normalized = normalizeCatalog({ catalogo: { secoes: boot.secoes, produtos: boot.produtos, atacado: boot.atacado } });
    state.sections = normalized.sections;
    state.products = normalized.products;
    state.wholesale = normalized.wholesale;
    state.atacado = normalized.wholesale;
    reconcileCartWithCatalog(state);
  } catch {
    const catalog = await loadCatalogWithFallback(state);
    if (miniappUiFromPayload(catalog)) state.miniappUi = normalizeMiniAppUi(miniappUiFromPayload(catalog));
    const normalized = normalizeCatalog(catalog);
    state.sections = normalized.sections;
    state.products = normalized.products;
    state.wholesale = normalized.wholesale;
    state.atacado = normalized.wholesale;
    reconcileCartWithCatalog(state);
  }
  if (loyaltyProgramEnabled(state)) {
    const loyalty = await loadLoyalty(state);
    if (loyalty?.ok !== false) applySnapshot(state, { telegramId: loyalty.telegramId || loyalty.programa?.telegramId, programa: loyalty });
    else state.loyalty = { ...state.loyalty, ...loyalty };
  }
  const orders = await loadOrders(state);
  if (Array.isArray(orders?.pedidos)) applySnapshot(state, { telegramId: orders.telegramId, pedidos: orders.pedidos });
  applySnapshot(state, window.__MJ_SNAPSHOT__ || {});
  await hydrateCustomerBeforeRender(state);
  if (!state.products.length) state.error = 'Catálogo vazio no painel.';
  const renderer = createRenderer(state);
  window.__mjMiniApp = { state, renderer };
  // Checkout marker: payment mode comes from panel config.
  bindBridgeCustomerSync(renderer, state);
  renderer.render();
  startPolling(renderer, state);
}

init().catch(error => {
  const root = document.getElementById('miniapp-root') || document.body;
  root.innerHTML = `<div class="fatal-error"><strong>Não foi possível abrir o Mini App.</strong><small>${error.message || error}</small></div>`;
});
