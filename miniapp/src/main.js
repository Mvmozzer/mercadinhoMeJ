import { initTelegram, telegramUserId } from './telegram.js?v=2026.07.23.082';
import {
  atualizarStatusLoja,
  authenticateBridge,
  carregarRuntimeConfigPages,
  catalogPayloadSource,
  hasAuthenticatedMiniAppIdentity,
  loadBootstrap,
  loadCatalogWithFallback,
  loadCustomer,
  loadHealth
} from './api.js?v=2026.07.23.082';
import { createRenderer } from './render.js?v=2026.07.23.082';
import { createState, applySnapshot, miniappStoreIsAvailable, normalizeMiniAppUi, setRuntimeOnline } from './state.js?v=2026.07.23.082';
import { normalizeCatalog } from './catalog.js?v=2026.07.23.082';
import { reconcileCartWithCatalog, restoreCart } from './cart.js?v=2026.07.23.082';
import { loadOrders } from './orders.js?v=2026.07.23.082';

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
    checkout: state.checkout || {},
    orders: (state.orders || []).map(order => ({
      id: order.id || order.pedidoId || '',
      status: order.status || '',
      statusPagamento: order.statusPagamento || order.status_pagamento || order.pagamento?.status || '',
      updatedAt: order.updatedAt || order.atualizadoEm || '',
      actions: order.acoes || order.actions || {}
    })),
    wholesale: state.wholesale || state.atacado || {},
    products: (state.products || []).map(product => ({
      id: product.id || product.produto_id || '',
      name: product.name || product.nome || '',
      image: product.image || product.imagem || product.imagem_url || '',
      retailPrice: Number(product.price ?? product.preco ?? 0),
      normalPrice: Number(product.normalPrice ?? product.preco_normal ?? product.preco ?? product.price ?? 0),
      badges: (product.badges || product.tarjas || product.labels || []).map(badge => ({
        text: String(badge?.text || badge?.texto || badge?.label || badge || '').trim(),
        color: String(badge?.color || badge?.cor || '').trim(),
        background: String(badge?.background || badge?.fundo || badge?.bg || '').trim()
      })),
      wholesaleActive: product.wholesaleActive === true || product.atacado_ativo === true || product.atacadoAtivo === true,
      wholesalePrice: Number(product.wholesalePrice ?? product.preco_atacado ?? product.precoAtacado ?? 0),
      wholesaleMinQuantity: Number(product.wholesaleMinQuantity ?? product.quantidade_atacado ?? product.quantidadeAtacado ?? 0),
      stock: Number(product.stock ?? product.estoque_pronta_entrega ?? product.estoque ?? 0),
      availability: product.disponibilidade || product.availabilityMode || '',
      preorder: product.sob_encomenda === true || product.sobEncomenda === true,
      pickupDeadlineDays: Number(product.prazo_retirada_dias ?? product.prazoRetiradaDias ?? 0),
      pickupForecast: product.previsao_retirada_texto || product.previsaoRetiradaTexto || '',
      saleMode: product.saleMode || product.modoVenda || product.modo_venda || '',
      saleUnit: product.unidadeVenda || product.saleUnit || product.unit || '',
      priceBaseUnit: product.unidadeBasePreco || product.priceBaseUnit || product.unidade_base_preco || product.unit || '',
      minWeight: Number(product.pesoMinimo ?? product.minWeight ?? 0),
      maxWeight: Number(product.pesoMaximo ?? product.maxWeight ?? 0),
      weightStep: Number(product.incrementoPeso ?? product.weightStep ?? 0)
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
  if (!hasAuthenticatedMiniAppIdentity(state)) return null;
  const customer = await withTimeout(loadCustomer(state).catch(() => null));
  if (customer?.cliente) {
    state.telegramId = String(customer.cliente.telegramId || customer.cliente.telegram_id || customer.cliente.chatId || state.telegramId || '').trim();
    applySnapshot(state, {
      telegramId: customer.cliente.telegramId || state.telegramId,
      cliente: customer.cliente,
      identidadeTelegram: customer.identidadeTelegram
    });
  }
  return customer;
}
async function refreshMiniAppVisualConfig(state, options = {}) {
  const before = miniappRefreshSignature(state);
  const availableBeforeHealth = miniappStoreIsAvailable(state);
  const health = await loadHealth(state);
  setRuntimeOnline(state, Boolean(health?.ok !== false && health?.loja));
  if (state.runtimeOnline) sincronizarStatusLoja(state, health);
  const availableAfterHealth = miniappStoreIsAvailable(state);
  if (availableBeforeHealth !== availableAfterHealth) options.onAvailabilityChange?.(availableAfterHealth, health);
  if (!state.runtimeOnline) return { health, changed: miniappRefreshSignature(state) !== before };
  if (health?.checkout?.pollingMs) state.pollingMs = health.checkout.pollingMs;
  if (health?.checkout) state.checkout = { ...state.checkout, ...health.checkout };
  if (hasAuthenticatedMiniAppIdentity(state)) {
    const customer = await loadCustomer(state);
    if (customer?.cliente) applySnapshot(state, {
      telegramId: customer.cliente.telegramId,
      cliente: customer.cliente,
      identidadeTelegram: customer.identidadeTelegram
    });
    const orders = await loadOrders(state);
    if (Array.isArray(orders?.pedidos)) applySnapshot(state, { telegramId: orders.telegramId, pedidos: orders.pedidos });
  }
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
  refreshMiniAppVisualConfig(state, {
    onAvailabilityChange: () => renderer?.render?.()
  })
    .then(({ changed }) => {
      if (changed) renderer?.render?.();
    })
    .catch(() => null);
}
function startPolling(renderer, state) { return window.setInterval(() => pollMiniApp(renderer, state), miniappPollingMs(state)); }
function bindRuntimeRecovery(renderer, state) {
  if (state.__runtimeRecoveryBound) return;
  state.__runtimeRecoveryBound = true;
  const refresh = () => pollMiniApp(renderer, state);
  window.addEventListener?.('online', refresh);
  document.addEventListener?.('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });
}
function applyBridgeSnapshot(renderer, state, snapshot = {}) {
  const before = miniappRefreshSignature(state);
  applySnapshot(state, snapshot);
  if (miniappRefreshSignature(state) !== before) renderer?.render?.();
  renderer?.refreshActiveOrderFlow?.();
}
async function refreshPersonalDataFromBridge(renderer, state) {
  if (!hasAuthenticatedMiniAppIdentity(state)) return;
  const before = miniappRefreshSignature(state);
  const [customer, orders] = await Promise.all([
    loadCustomer(state).catch(() => null),
    loadOrders(state).catch(() => null)
  ]);
  if (customer?.cliente) applySnapshot(state, {
    telegramId: customer.cliente.telegramId,
    cliente: customer.cliente,
    identidadeTelegram: customer.identidadeTelegram
  });
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
      identidadeTelegram: boot?.identidadeTelegram,
      loja: boot?.loja,
      cliente: boot?.cliente,
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
  if (hasAuthenticatedMiniAppIdentity(state)) {
    const orders = await loadOrders(state);
    if (Array.isArray(orders?.pedidos)) applySnapshot(state, { telegramId: orders.telegramId, pedidos: orders.pedidos });
  }
  applySnapshot(state, window.__MJ_SNAPSHOT__ || {});
  await hydrateCustomerBeforeRender(state);
  if (!state.products.length) state.error = 'Catálogo vazio no painel.';
  const renderer = createRenderer(state);
  window.__mjMiniApp = { state, renderer };
  // Checkout marker: payment mode comes from panel config.
  bindBridgeCustomerSync(renderer, state);
  renderer.render();
  bindRuntimeRecovery(renderer, state);
  pollMiniApp(renderer, state);
  startPolling(renderer, state);
}

init().catch(error => {
  const root = document.getElementById('miniapp-root') || document.body;
  root.innerHTML = `<div class="fatal-error"><strong>Não foi possível abrir o Mini App.</strong><small>${error.message || error}</small></div>`;
});
