import { initTelegram, telegramUserId } from './telegram.js?v=2026.07.13.286';
import {
  atualizarStatusLoja,
  authenticateBridge,
  carregarRuntimeConfigPages,
  catalogPayloadSource,
  loadBootstrap,
  loadCatalogWithFallback,
  loadCustomer,
  loadHealth
} from './api.js?v=2026.07.13.286';
import { createRenderer } from './render.js?v=2026.07.13.286';
import { createState, applySnapshot, normalizeMiniAppUi, loyaltyProgramEnabled, setRuntimeOnline } from './state.js?v=2026.07.13.286';
import { normalizeCatalog } from './catalog.js?v=2026.07.13.286';
import { reconcileCartWithCatalog, restoreCart } from './cart.js?v=2026.07.13.286';
import { loadLoyalty } from './loyalty.js?v=2026.07.13.286';
import { loadOrders } from './orders.js?v=2026.07.13.286';

function sincronizarStatusLoja(state, health) {
  return atualizarStatusLoja(state, health || {});
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
    runtimeOnline: state.runtimeOnline === true,
    pollingMs: state.pollingMs || 0,
    store: state.store || {},
    cliente: state.cliente || {},
    loyalty: { ativo: state.loyalty?.ativo },
    checkout: state.checkout || {},
    orders: (state.orders || []).map(order => ({
      id: order.id || order.pedidoId || '',
      status: order.status || '',
      statusPagamento: order.statusPagamento || order.status_pagamento || order.pagamento?.status || '',
      updatedAt: order.updatedAt || order.atualizadoEm || ''
    })),
    wholesale: state.wholesale || state.atacado || {},
    products: (state.products || []).map(product => ({
      id: product.id || product.produto_id || '',
      name: product.name || product.nome || '',
      image: product.image || product.imagem || product.imagem_url || '',
      retailPrice: Number(product.price ?? product.preco ?? 0),
      normalPrice: Number(product.normalPrice ?? product.preco_normal ?? product.preco ?? product.price ?? 0),
      promotionalPrice: Number(product.preco_promocional ?? product.precoPromocional ?? 0),
      promotion: product.promocao === true || product.promocao_ativa === true || product.promocaoAtiva === true,
      wholesaleActive: product.wholesaleActive === true || product.atacado_ativo === true || product.atacadoAtivo === true,
      wholesalePrice: Number(product.wholesalePrice ?? product.preco_atacado ?? product.precoAtacado ?? 0),
      wholesaleMinQuantity: Number(product.wholesaleMinQuantity ?? product.quantidade_atacado ?? product.quantidadeAtacado ?? 0),
      stock: Number(product.stock ?? product.estoque_pronta_entrega ?? product.estoque ?? 0),
      availability: product.disponibilidade || product.availabilityMode || '',
      preorder: product.sob_encomenda === true || product.sobEncomenda === true,
      pickupDeadlineDays: Number(product.prazo_retirada_dias ?? product.prazoRetiradaDias ?? 0),
      pickupForecast: product.previsao_retirada_texto || product.previsaoRetiradaTexto || ''
    })),
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
    const customerTelegramId = String(
      customer.telegramId ||
      customer.cliente.telegramId ||
      customer.cliente.telegram_id ||
      customer.cliente.chatId ||
      ''
    ).trim();
    applySnapshot(state, { telegramId: customerTelegramId, cliente: customer.cliente });
  }
  return customer;
}
async function refreshMiniAppVisualConfig(state) {
  const before = miniappRefreshSignature(state);
  const health = await loadHealth(state);
  setRuntimeOnline(state, Boolean(health?.ok !== false && health?.loja));
  if (!state.runtimeOnline) return { health, changed: miniappRefreshSignature(state) !== before };
  if (health?.checkout?.pollingMs) state.pollingMs = health.checkout.pollingMs;
  sincronizarStatusLoja(state, health);
  if (health?.checkout) state.checkout = { ...state.checkout, ...health.checkout };
  if (health?.programa) state.loyalty = { ...state.loyalty, ...health.programa };
  const customer = await loadCustomer(state);
  if (customer?.cliente) applySnapshot(state, { telegramId: customer.cliente.telegramId, cliente: customer.cliente });
  const orders = await loadOrders(state);
  if (Array.isArray(orders?.pedidos)) applySnapshot(state, { telegramId: orders.telegramId, pedidos: orders.pedidos });
  const ui = miniappUiFromPayload(health);
  if (ui) state.miniappUi = normalizeMiniAppUi(ui);
  const catalog = await loadCatalogWithFallback(state).catch(() => null);
  if (catalog) {
    if (!health?.loja || catalogPayloadSource(catalog) !== 'static') sincronizarStatusLoja(state, catalog);
    const catalogUi = miniappUiFromPayload(catalog);
    if (!ui && catalogUi) state.miniappUi = normalizeMiniAppUi(catalogUi);
    const normalized = normalizeCatalog(catalog);
    state.sections = normalized.sections;
    state.products = normalized.products;
    state.wholesale = normalized.wholesale;
    state.atacado = normalized.wholesale;
    reconcileCartWithCatalog(state);
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
  renderer?.refreshActiveOrderFlow?.();
}
async function refreshPersonalDataFromBridge(renderer, state) {
  const before = miniappRefreshSignature(state);
  const [customer, orders] = await Promise.all([
    loadCustomer(state).catch(() => null),
    loadOrders(state).catch(() => null)
  ]);
  if (customer?.cliente) applySnapshot(state, { telegramId: customer.cliente.telegramId, cliente: customer.cliente });
  if (Array.isArray(orders?.pedidos)) applySnapshot(state, { telegramId: orders.telegramId, pedidos: orders.pedidos });
  if (miniappRefreshSignature(state) !== before) renderer?.render?.();
  renderer?.refreshActiveOrderFlow?.();
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
    refreshPersonalDataFromBridge(renderer, state)
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
  let versionCheck = null;
  try {
    versionCheck = await Promise.resolve(window.__MJ_VERSION_CHECK__);
  } catch {
    versionCheck = null;
  }
  if (versionCheck?.reloading === true) return;
  initTelegram();
  const state = createState();
  state.telegramId = telegramUserId();
  restoreCart(state);
  await carregarRuntimeConfigPages(state);
  await authenticateBridge(state);
  const health = await loadHealth(state);
  setRuntimeOnline(state, Boolean(health?.ok !== false && health?.loja));
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
    const catalog = await loadCatalogWithFallback(state).catch(() => null);
    if (catalog) {
      sincronizarStatusLoja(state, catalog);
      if (miniappUiFromPayload(catalog)) state.miniappUi = normalizeMiniAppUi(miniappUiFromPayload(catalog));
      const normalized = normalizeCatalog(catalog);
      state.sections = normalized.sections;
      state.products = normalized.products;
      state.wholesale = normalized.wholesale;
      state.atacado = normalized.wholesale;
      reconcileCartWithCatalog(state);
    }
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
