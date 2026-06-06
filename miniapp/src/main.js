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
  loadCheckoutAddressFromApi,
  previewCheckoutMiniApp
} from './checkout.js';
import { loadLoyalty, shareReferralCode } from './loyalty.js';
import { loadOrder, loadOrders as loadOrdersApi, pollOrderStatus } from './orders.js';
import { copyPix, refreshPixStatus, uploadReceipt } from './pix.js';
import { createRenderer } from './render.js';
import { createInitialState } from './state.js';
import { persistMiniAppUiState, restoreMiniAppUiState, validateRestoredMiniAppUiOwner } from './storage.js';
import { fallbackSendData, getUser, isActive, setMainButtonLoading, setupTelegram } from './telegram.js';
import { loadTracking, pollLocation, stopTrackingWhenDelivered } from './tracking.js';

const state = createInitialState();
const handlers = {};
let renderer = null;

const telegram = setupTelegram(() => {
  if (state.checkoutStep === 'cart') return sendCartToTelegram();
  return renderer?.iniciarCheckout();
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
  await loadCheckoutAddressFromApi(state, renderer.els).catch(() => null);
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
    if (state.currentPage === 'payment') await refreshPixStatus(state, pedido.id).catch(() => null);
  } catch (_) {
    state.restoredPedidoId = '';
  }
}

async function sincronizarStatusLoja() {
  await sincronizarStatusLojaApi(state);
  renderer.renderStatusLoja();
  renderer.render();
}

function openTelegramRegistration() {
  const payload = {
    type: 'mercadinho_cadastro',
    source: 'telegram_mini_app_html',
    origem: 'telegram_miniapp',
    client_event_id: `cadastro_${Date.now()}`
  };
  const sent = fallbackSendData(telegram.webApp, payload);
  if (sent) return;
  renderer.showToast('Abra o chat do Mercadinho no Telegram e envie /cadastro.');
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
    if (result.mode === 'api' || result.mode === 'bridge') {
      await Promise.all([
        loadOrders(),
        loadLoyaltyState(),
        state.pedidoAtual?.id ? loadTracking(state, state.pedidoAtual.id).catch(() => null) : Promise.resolve()
      ]);
      renderer.navigateTo('payment');
    }
  } catch (error) {
    renderer.showToast(error.message || 'Falha ao finalizar pedido.');
  } finally {
    state.sending = false;
    setMainButtonLoading(telegram.webApp, false);
    if (!state.pix?.copiaCola) {
      state.checkoutStep = 'catalog';
      renderer.setCartOpen(false);
    }
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

async function showPix(pedidoId) {
  try {
    const pedido = await loadOrder(state, pedidoId);
    if (pedido?.id) await refreshPixStatus(state, pedido.id);
    if (pedido?.id) await pollOrderStatus(state, pedido.id).catch(() => null);
    if (await navigateAfterPaymentConfirmation(pedido?.id)) return;
    renderer.navigateTo('payment');
    renderer.render();
  } catch (error) {
    renderer.showToast(error.message || 'Nao foi possivel carregar o Pix.');
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

function isPaymentConfirmed() {
  const paymentStatus = String(
    state.orderStatus?.pagamento?.status ||
    state.pedidoAtual?.statusPagamento ||
    state.pix?.status ||
    ''
  ).toLowerCase();
  const orderStatus = String(
    state.orderStatus?.status ||
    state.pedidoAtual?.status ||
    ''
  ).toLowerCase();
  return paymentStatus === 'pago' || [
    'pago',
    'preparando',
    'pronto',
    'aguardando_entregador',
    'saiu_para_entrega',
    'entregue'
  ].includes(orderStatus);
}

async function navigateAfterPaymentConfirmation(pedidoId) {
  if (!pedidoId || !isPaymentConfirmed()) return false;
  await loadTracking(state, pedidoId).catch(() => null);
  renderer.navigateTo('tracking');
  renderer.render();
  renderer.showToast('Pagamento aprovado. Acompanhe seu pedido.');
  return true;
}

async function refreshPix() {
  const pedidoId = state.pedidoAtual?.id;
  if (!pedidoId) return;
  try {
    await refreshPixStatus(state, pedidoId);
    await pollOrderStatus(state, pedidoId).catch(() => null);
    if (await navigateAfterPaymentConfirmation(pedidoId)) return;
    renderer.render();
    renderer.showToast('Pagamento atualizado');
  } catch (error) {
    renderer.showToast(error.message || 'Nao foi possivel atualizar Pix.');
  }
}

function receiptFileError(file) {
  if (!file) return '';
  const maxBytes = 5 * 1024 * 1024;
  const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']);
  const allowedExtensions = /\.(png|jpe?g|webp|pdf)$/i;
  if (file.size > maxBytes) return 'Comprovante muito grande. Envie arquivo de ate 5 MB.';
  if (!allowedTypes.has(String(file.type || '').toLowerCase())) return 'Formato invalido. Use PNG, JPG, WEBP ou PDF.';
  if (!allowedExtensions.test(file.name || '')) return 'Extensao invalida. Use PNG, JPG, WEBP ou PDF.';
  return '';
}

async function sendReceipt(file = null) {
  const pedidoId = state.pedidoAtual?.id;
  if (!pedidoId) return;
  let payload = null;
  if (typeof File !== 'undefined' && file instanceof File) {
    const erroArquivo = receiptFileError(file);
    if (erroArquivo) {
      renderer.showToast(erroArquivo);
      return;
    }
    payload = new FormData();
    payload.append('comprovante', file, file.name || 'comprovante');
  } else {
    const texto = window.prompt('Informe uma observacao sobre o pagamento ou comprovante:');
    if (!texto) return;
    payload = { texto };
  }
  try {
    await sendMiniAppEvent(state, 'pix_receipt_upload_start', {
      pedidoId: String(pedidoId),
      hasFile: payload instanceof FormData
    }).catch(() => null);
    await uploadReceipt(state, pedidoId, payload);
    await pollOrderStatus(state, pedidoId).catch(() => null);
    renderer.showToast('Comprovante registrado para conferencia.');
  } catch (error) {
    renderer.showToast(error.message || 'Nao foi possivel enviar comprovante.');
  }
}

async function copyCurrentPix() {
  try {
    await copyPix(state);
    renderer.showToast('Pix copiado.');
  } catch (error) {
    renderer.showToast(error.message || 'Pix indisponivel.');
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
  if (state.currentPage === 'payment' && state.pedidoAtual?.id) {
    await navigateAfterPaymentConfirmation(state.pedidoAtual.id);
    return;
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
  handlers.openTelegramRegistration = openTelegramRegistration;
  handlers.sendCart = sendCartToTelegram;
  handlers.previewCheckout = previewCheckout;
  handlers.loadOrders = loadOrders;
  handlers.showPix = showPix;
  handlers.showTracking = showTracking;
  handlers.refreshPix = refreshPix;
  handlers.copyPix = copyCurrentPix;
  handlers.sendReceipt = sendReceipt;
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
