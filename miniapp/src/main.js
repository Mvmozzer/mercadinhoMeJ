import {
  authenticateMiniApp,
  apiBase,
  apiBaseConfigurada,
  bridgeSendAction,
  carregarRuntimeConfigPages,
  healthMiniApp,
  loadBootstrap,
  loadMoreProducts as loadMoreProductsApi,
  loadProducts as loadProductsApi,
  sendMiniAppEvent,
  sincronizarStatusLoja as sincronizarStatusLojaApi
} from './api.js';
import { pruneCart, restoreCart, cartItems } from './cart.js';
import { sectionItems } from './catalog.js';
import {
  finalizarCheckoutMiniApp,
  limparClientOrderIdPendente,
  previewCheckoutMiniApp
} from './checkout.js';
import { loadLoyalty, shareReferralCode } from './loyalty.js';
import { loadOrder, loadOrders as loadOrdersApi, pollOrderStatus } from './orders.js';
import { createRenderer } from './render.js';
import { createInitialState } from './state.js';
import { persistMiniAppUiState, restoreMiniAppUiState, validateRestoredMiniAppUiOwner } from './storage.js';
import { getUser, isActive, setMainButtonLoading, setupTelegram } from './telegram.js';
import { loadTracking, pollLocation, stopTrackingWhenDelivered } from './tracking.js';

const state = createInitialState();
const handlers = {};
let renderer = null;

const telegram = setupTelegram(() => {
  if (state.currentPage === 'cart') return sendCartToTelegram();
  return null;
});

renderer = createRenderer({ state, telegram, handlers });

function installMiniAppDesignRuntime() {
  if (!apiBaseConfigurada(state)) return;
  const base = apiBase(state);
  const runtimeBase = base || '';

  if (!document.getElementById('miniapp-design-runtime-css')) {
    const link = document.createElement('link');
    link.id = 'miniapp-design-runtime-css';
    link.rel = 'stylesheet';
    link.href = `${runtimeBase}/mini-app-design/runtime.css`;
    document.head.appendChild(link);
  }

  if (!document.getElementById('miniapp-design-runtime-js')) {
    const script = document.createElement('script');
    script.id = 'miniapp-design-runtime-js';
    script.src = `${runtimeBase}/mini-app-design/runtime.js`;
    script.defer = true;
    if (base) script.dataset.apiBase = base;
    document.head.appendChild(script);
  }
}

function clearPendingOrderId() {
  limparClientOrderIdPendente(state);
}

function normalizeSectionSelection() {
  if (state.section && !sectionItems(state).some(section => section.id === state.section)) {
    state.section = '';
  }
}

async function reloadCatalog() {
  state.catalogLoading = true;
  renderer.render();
  await loadProductsApi(state);
  normalizeSectionSelection();
  pruneCart(state, clearPendingOrderId);
  renderer.render();
}

async function loadMoreProducts() {
  await loadMoreProductsApi(state);
  pruneCart(state, clearPendingOrderId);
  renderer.render();
}

async function loadOrders() {
  await loadOrdersApi(state);
  renderer.renderOrders();
}

async function bootstrapMiniApp() {
  if (!state.authOk) return;
  await loadBootstrap(state);
  renderer.render();
}

async function loadLoyaltyState() {
  if (!state.authOk) return;
  await loadLoyalty(state).catch(() => null);
  renderer.render();
}

async function resumeRestoredFlow() {
  if (!state.restoredPedidoId) return;
  try {
    const pedido = await loadOrder(state, state.restoredPedidoId);
    if (!pedido?.id) return;
    await pollOrderStatus(state, pedido.id).catch(() => null);
    if (state.currentPage === 'tracking') await loadTracking(state, pedido.id).catch(() => null);
  } catch (_) {
    state.restoredPedidoId = '';
  }
}

async function sincronizarStatusLoja() {
  await sincronizarStatusLojaApi(state);
  renderer.renderStatusLoja();
  renderer.render();
}

async function sendCartToTelegram() {
  if (state.sending) return;
  if (!state.loja.aceitaPedidos) {
    renderer.showToast(state.loja.mensagem || 'A loja nao esta recebendo pedidos agora.');
    return;
  }
  if (!cartItems(state).length) {
    renderer.showToast('Adicione ao menos um produto');
    return;
  }
  state.sending = true;
  setMainButtonLoading(telegram.webApp, true);
  renderer.render();
  try {
    const result = await finalizarCheckoutMiniApp(state, renderer.els, telegram, {
      render: renderer.render,
      showToast: renderer.showToast
    });
    if (result.mode === 'api' || result.mode === 'bridge' || result.mode === 'fallback') {
      await Promise.all([
        loadOrders(),
        loadLoyaltyState()
      ]);
      renderer.setCartOpen(false);
      renderer.navigateTo('home');
    }
  } catch (error) {
    renderer.showToast(error.message || 'Nao consegui enviar seu carrinho para o Telegram.');
  } finally {
    state.sending = false;
    setMainButtonLoading(telegram.webApp, false);
    state.checkoutStep = 'catalog';
    renderer.render();
  }
}

async function previewCheckout() {
  try {
    await previewCheckoutMiniApp(state, renderer.els);
    renderer.render();
  } catch (error) {
    renderer.showToast(error.message || 'Revise entrega e carrinho antes de continuar.');
    throw error;
  }
}

async function showTracking(pedidoId) {
  try {
    const pedido = await loadOrder(state, pedidoId);
    if (pedido?.id) await loadTracking(state, pedido.id);
    renderer.navigateTo('tracking');
    renderer.render();
  } catch (error) {
    renderer.showToast(error.message || 'Nao foi possivel carregar acompanhamento.');
  }
}

async function shareReferral() {
  try {
    await shareReferralCode(state);
    renderer.showToast('Codigo de indicacao compartilhado.');
  } catch (_) {
    renderer.showToast('Codigo de indicacao copiado.');
  }
}

async function pollMiniApp() {
  if (!state.authOk || !isActive(telegram.webApp)) return;
  await Promise.all([
    loadProductsApi(state).catch(() => null),
    loadOrdersApi(state).catch(() => null),
    state.pedidoAtual?.id ? pollOrderStatus(state, state.pedidoAtual.id).catch(() => null) : Promise.resolve(),
    state.pedidoAtual?.id ? pollLocation(state, state.pedidoAtual.id).catch(() => null) : Promise.resolve(),
    loadLoyalty(state).catch(() => null)
  ]);
  if (state.pedidoAtual?.id && !stopTrackingWhenDelivered(state)) {
    await loadTracking(state, state.pedidoAtual.id).catch(() => null);
  }
  renderer.render();
}

function startPolling() {
  if (state.pollTimer) window.clearInterval(state.pollTimer);
  const delay = Math.max(2000, Number(state.updateIntervalMs || 5000));
  state.pollTimer = window.setInterval(pollMiniApp, delay);
}

async function authenticate() {
  try {
    state.authError = '';
    state.telegramUser = getUser(telegram.webApp);
    const data = await authenticateMiniApp(state, telegram.webApp);
    if (renderer.els.authStatus) {
      renderer.els.authStatus.textContent = data.modoDev ? 'Modo dev' : 'Mini App conectado';
    }
    validateRestoredMiniAppUiOwner(state);
    renderer.render();
    await bootstrapMiniApp();
    const health = await healthMiniApp(state).catch(() => null);
    state.apiHealth = health;
    if (health?.ok) {
      await sendMiniAppEvent(state, 'health_ping', {
        checkoutApi: health.checkout?.apiEnabled === true,
        bridgeHybrid: health.bridge?.hybrid === true
      }).catch(() => null);
    }
    validateRestoredMiniAppUiOwner(state);
    await Promise.all([loadOrders(), loadLoyaltyState()]);
    await resumeRestoredFlow();
    window.MJMiniAppBridge?.startStream?.();
    window.MJMiniAppBridge?.startPolling?.(state.updateIntervalMs || 5000);
    startPolling();
    return data;
  } catch (error) {
    state.authOk = false;
    state.authMode = 'offline';
    state.authError = error?.message || 'Sessao da Mini App indisponivel.';
    if (renderer.els.authStatus) renderer.els.authStatus.textContent = 'Sessao indisponivel';
    renderer.render();
    return null;
  }
}

async function init() {
  handlers.reloadCatalog = reloadCatalog;
  handlers.loadMoreProducts = loadMoreProducts;
  handlers.sendCart = sendCartToTelegram;
  handlers.previewCheckout = previewCheckout;
  handlers.loadOrders = loadOrders;
  handlers.showTracking = showTracking;
  handlers.shareReferral = shareReferral;
  handlers.persistUiState = () => persistMiniAppUiState(state);
  handlers.syncCartAction = (action, payload) => bridgeSendAction(state, action, payload).catch(() => null);
  handlers.trackEvent = (tipo, payload) => sendMiniAppEvent(state, tipo, payload).catch(() => null);

  await carregarRuntimeConfigPages(state);
  restoreCart(state);
  restoreMiniAppUiState(state);
  renderer.render();
  installMiniAppDesignRuntime();

  await Promise.all([
    reloadCatalog(),
    authenticate()
  ]);

  await sincronizarStatusLoja();
  state.storeStatusTimer = setInterval(sincronizarStatusLoja, 15000);
}

init().catch(error => {
  console.error(error);
  renderer.showToast('Nao foi possivel iniciar a loja. Atualize a pagina.');
});
