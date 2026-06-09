import { initTelegram, telegramUserName } from './telegram.js';
import { carregarRuntimeConfigPages, authenticateBridge, loadBootstrap, loadCatalogWithFallback, loadHealth } from './api.js';
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
function pollMiniApp(renderer) { renderer?.render?.(); }
function startPolling(renderer) { return window.setInterval(() => pollMiniApp(renderer), 30000); }

async function init() {
  initTelegram();
  const state = createState();
  state.cliente.nome = telegramUserName() || state.cliente.nome || 'cliente';
  restoreCart(state);
  await carregarRuntimeConfigPages(state);
  await authenticateBridge(state);
  const health = await loadHealth(state);
  sincronizarStatusLoja(state, health);
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
  renderer.render();
  startPolling(renderer);
}

init().catch(error => {
  const root = document.getElementById('miniapp-root') || document.body;
  root.innerHTML = `<div class="fatal-error"><strong>Não foi possível abrir o Mini App.</strong><small>${error.message || error}</small></div>`;
});
