import { initTelegram, telegramUserName } from './telegram.js';
import { carregarRuntimeConfigPages, authenticateBridge, loadBootstrap, loadCatalogWithFallback, loadHealth, loadCustomer } from './api.js';
import { createRenderer } from './render.js';
import { createState, applySnapshot, normalizeMiniAppUi } from './state.js';
import { normalizeCatalog } from './catalog.js';
import { restoreCart } from './cart.js';
import { loadLoyalty } from './loyalty.js';
import { loadOrders } from './orders.js';

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
    miniappUi: state.miniappUi || {}
  });
}
function miniappPollingMs(state = {}) {
  const value = Number(state.pollingMs || 7000);
  if (!Number.isFinite(value)) return 7000;
  return Math.max(3000, Math.min(60000, Math.round(value)));
}
async function refreshMiniAppVisualConfig(state) {
  const before = miniappRefreshSignature(state);
  const health = await loadHealth(state);
  if (health?.checkout?.pollingMs) state.pollingMs = health.checkout.pollingMs;
  sincronizarStatusLoja(state, health);
  const customer = await loadCustomer(state);
  if (customer?.cliente) state.cliente = { ...state.cliente, ...customer.cliente };
  const ui = miniappUiFromPayload(health);
  if (ui) state.miniappUi = normalizeMiniAppUi(ui);
  if (!ui) {
    const catalog = await loadCatalogWithFallback(state).catch(() => null);
    const catalogUi = miniappUiFromPayload(catalog);
    if (catalogUi) state.miniappUi = normalizeMiniAppUi(catalogUi);
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
        if (customer?.cliente) state.cliente = { ...state.cliente, ...customer.cliente };
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
  state.cliente.nome = telegramUserName() || state.cliente.nome || 'cliente';
  restoreCart(state);
  await carregarRuntimeConfigPages(state);
  await authenticateBridge(state);
  const health = await loadHealth(state);
  if (health?.checkout?.pollingMs) state.pollingMs = health.checkout.pollingMs;
  sincronizarStatusLoja(state, health);
  if (miniappUiFromPayload(health)) state.miniappUi = normalizeMiniAppUi(miniappUiFromPayload(health));
  try {
    const boot = await loadBootstrap(state);
    if (boot?.loja) state.store = { ...state.store, ...boot.loja };
    if (boot?.cliente) state.cliente = { ...state.cliente, ...boot.cliente };
    if (boot?.programa) state.loyalty = { ...state.loyalty, ...boot.programa };
    if (boot?.miniappUi) state.miniappUi = normalizeMiniAppUi(boot.miniappUi);
    if (Array.isArray(boot?.pedidosAtivos)) state.orders = boot.pedidosAtivos;
    const normalized = normalizeCatalog({ catalogo: { secoes: boot.secoes, produtos: boot.produtos } });
    state.sections = normalized.sections;
    state.products = normalized.products;
  } catch {
    const catalog = await loadCatalogWithFallback(state);
    if (miniappUiFromPayload(catalog)) state.miniappUi = normalizeMiniAppUi(miniappUiFromPayload(catalog));
    const normalized = normalizeCatalog(catalog);
    state.sections = normalized.sections;
    state.products = normalized.products;
  }
  const loyalty = await loadLoyalty(state);
  if (loyalty?.ok !== false) state.loyalty = { ...state.loyalty, ...loyalty };
  const orders = await loadOrders(state);
  if (Array.isArray(orders?.pedidos)) state.orders = orders.pedidos;
  applySnapshot(state, window.__MJ_SNAPSHOT__ || {});
  if (!state.products.length) state.error = 'Catálogo vazio no painel.';
  const renderer = createRenderer(state);
  window.__mjMiniApp = { state, renderer };
  // Checkout marker: cart handoff stays in Telegram.
  bindBridgeCustomerSync(renderer, state);
  renderer.render();
  startPolling(renderer, state);
}

init().catch(error => {
  const root = document.getElementById('miniapp-root') || document.body;
  root.innerHTML = `<div class="fatal-error"><strong>Não foi possível abrir o Mini App.</strong><small>${error.message || error}</small></div>`;
});
