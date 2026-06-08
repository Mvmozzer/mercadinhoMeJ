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
  loadCheckoutAddressFromApi,
  limparClientOrderIdPendente,
  previewCheckoutMiniApp
} from './checkout.js';
import { loadLoyalty, shareReferralCode } from './loyalty.js';
import { loadOrder, loadOrders as loadOrdersApi, pollOrderStatus } from './orders.js';
import { copyPix, refreshPixStatus, uploadReceipt } from './pix.js';
import { createRenderer } from './render.js';
import { createInitialState } from './state.js';
import { persistMiniAppUiState, restoreMiniAppUiState, validateRestoredMiniAppUiOwner } from './storage.js';
import { getUser, isActive, setMainButtonLoading, setupTelegram } from './telegram.js';
import { loadTracking, pollLocation, stopTrackingWhenDelivered } from './tracking.js';
import { runningOnStaticHost } from './utils.js';
import { escapeHtml } from './utils.js';

const state = createInitialState();
const handlers = {};
let renderer = null;
let startupWatchdog = null;
const STARTUP_TIMEOUT_MS = 14000;
const DEBUG_PANEL_MAX_ERRORS = 8;

const startupDebugEvents = [];
let debugCaptureInstalled = false;
let buildMetaProbeInProgress = null;

function getStartupDebugMode() {
  try {
    const value = new URL(window.location.href).searchParams.get('debug') || '';
    return ['1', 'true', 'sim', 'yes'].includes(String(value).toLowerCase());
  } catch (_) {
    return false;
  }
}

function detectBuildVersion() {
  try {
    const query = new URL(window.location.href).searchParams.get('miniapp_v');
    if (query) return query;
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    const mainScript = scripts.find(script => /\/miniapp\/src\/main\.js(\?|$)/.test(String(script.getAttribute('src') || '')))
      || scripts.find(script => /\/src\/main\.js(\?|$)/.test(String(script.getAttribute('src') || '')))
      || scripts.find(script => /\/miniapp\/main\.js(\?|$)/.test(String(script.getAttribute('src') || '')));
    if (!mainScript) return '';
    const src = mainScript.getAttribute('src') || '';
    return new URL(src, window.location.href).searchParams.get('v') || '';
  } catch (_) {
    return '';
  }
}

function formatBuildVersion(version = '') {
  const text = String(version || '').trim();
  return text && /^\d{4}\.\d{2}\.\d{2}\.\d{3}$/.test(text) ? text : text;
}

function appendCacheBuster(url) {
  const version = formatBuildVersion(state.buildVersion);
  if (!version) return String(url || '');
  if (String(url || '').includes(`v=${version}`)) return String(url);
  const separator = String(url || '').includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(version)}`;
}

async function detectBuildVersionFromVersionJson() {
  if (buildMetaProbeInProgress) return buildMetaProbeInProgress;
  const candidates = [
    './version.json',
    './publicacao-github-pages/version.json',
    '../version.json',
    '../publicacao-github-pages/version.json',
    '/version.json'
  ];
  buildMetaProbeInProgress = (async () => {
    for (const candidate of candidates) {
      try {
        const response = await fetch(candidate, { cache: 'no-store' });
        if (!response.ok) continue;
        const payload = await response.json();
        const fromPayload = String(payload?.webBuild || '').trim();
        if (fromPayload) {
          state.buildVersion = fromPayload;
          return fromPayload;
        }
      } catch (_) {
        // versão estática antiga pode não ter versão pública publicada.
      }
    }
    return '';
  })();
  const result = await buildMetaProbeInProgress;
  buildMetaProbeInProgress = null;
  return result;
}

function collectConsoleMessage(value) {
  try {
    return String(typeof value === 'string' ? value : JSON.stringify(value)).slice(0, 700);
  } catch (_) {
    return String(value || 'erro');
  }
}

function pushDebugEvent(message, type = 'log') {
  const line = `${new Date().toISOString()} [${type}] ${String(message).slice(0, 680)}`;
  startupDebugEvents.unshift(line);
  if (startupDebugEvents.length > DEBUG_PANEL_MAX_ERRORS) startupDebugEvents.length = DEBUG_PANEL_MAX_ERRORS;
}

function installDebugCapture() {
  if (debugCaptureInstalled || !state.debugMode) return;
  debugCaptureInstalled = true;

  const originalConsoleError = console.error;
  console.error = (...args) => {
    pushDebugEvent(args.map(arg => collectConsoleMessage(arg)).join(' | '), 'error');
    return originalConsoleError(...args);
  };

  window.addEventListener('error', (event) => {
    pushDebugEvent(`${event.message || 'Erro de script'} ${event.filename || ''}:${event.lineno || ''}:${event.colno || ''}`, 'error');
    markStartupFailure('Erro de script detectado. Veja detalhes no debug.');
  });

  window.addEventListener('unhandledrejection', (event) => {
    pushDebugEvent(`Promise rejeitada: ${collectConsoleMessage(event?.reason)}`, 'promise');
    markStartupFailure('Erro assíncrono detectado. Veja detalhes no debug.');
  });
}

function markStartupFailure(error) {
  const elapsed = state.startupStartedAt ? Math.max(0, Date.now() - state.startupStartedAt) : 0;
  const message = typeof error === 'string'
    ? error
    : error?.message || 'Não foi possível finalizar o carregamento da loja.';
  state.startupFailed = true;
  state.startupError = `${message} (${Math.round(elapsed / 1000)}s)`;
  state.startupCompletedAt = Date.now();
  clearStartupWatchdog();
  renderStartupFailure();
}

function clearStartupWatchdog() {
  if (startupWatchdog) window.clearTimeout(startupWatchdog);
  startupWatchdog = null;
}

function startStartupWatchdog() {
  clearStartupWatchdog();
  startupWatchdog = window.setTimeout(() => {
    const stillBooting = state.authMode === 'pending' || state.catalogLoading;
    if (!state.startupCompletedAt && stillBooting) {
      markStartupFailure('A inicialização travou no carregamento. Verifique conexão e tente novamente.');
    }
  }, STARTUP_TIMEOUT_MS);
}

function collectResourceDebugInfo() {
  const stylesheet = document.getElementById('mainStylesheet')
    || Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find(link => /miniapp\/styles\.css|\.\/styles\.css/i.test(String(link.getAttribute('href') || '')));
  const runtimeCss = document.getElementById('miniapp-design-runtime-css');
  const mainJs = document.getElementById('miniappMainJs')
    || Array.from(document.scripts).find(script => /(miniapp\/src\/main\.js|\.\/src\/main\.js)/i.test(String(script.getAttribute('src') || '')));
  const runtimeJs = document.getElementById('miniapp-design-runtime-js');
  return {
    stylesheetHref: stylesheet?.getAttribute('href') || '',
    runtimeCssLoaded: Boolean(runtimeCss),
    runtimeJsLoaded: Boolean(runtimeJs),
    runtimeCssHref: runtimeCss?.getAttribute('href') || '',
    runtimeJsHref: runtimeJs?.getAttribute('src') || '',
    mainJsLoaded: Boolean(mainJs)
  };
}

function getDebugSafeUrl() {
  try {
    const safeKeys = new Set(['apiBase', 'miniapp_v', 'debug', 'state', 'pedido', 'allowTempApi', 'allowtempapi']);
    const cleaned = new URL(window.location.href);
    const blacklist = [];
    for (const key of Array.from(cleaned.searchParams.keys())) {
      if (!safeKeys.has(String(key))) continue;
      const value = cleaned.searchParams.get(key) || '';
      cleaned.searchParams.set(key, String(value).slice(0, 300));
    }
    for (const key of Array.from(cleaned.searchParams.keys())) {
      if (!safeKeys.has(key)) {
        blacklist.push(key);
      }
    }
    blacklist.forEach(key => cleaned.searchParams.delete(key));
    return cleaned.toString();
  } catch (_) {
    return String(window.location.href || '');
  }
}

function collectDebugSnapshot() {
  const api = apiBase(state);
  const health = state.apiHealth || {};
  const resources = collectResourceDebugInfo();
  return {
    carregadoEm: new Date().toLocaleString('pt-BR'),
    urlAtual: getDebugSafeUrl(),
    buildVersion: state.buildVersion || detectBuildVersion(),
    apiBase: api || '(não definido)',
    emTelegram: Boolean(window.Telegram?.WebApp),
    initDataExiste: Boolean(state.telegramInitData),
    authMode: state.authMode || 'desconhecido',
    apiRunningOnStaticHost: runningOnStaticHost(),
    cssCarregado: Boolean(resources.stylesheetHref),
    runtimeCssHref: resources.runtimeCssHref || '',
    runtimeJsHref: resources.runtimeJsHref || '',
    runtimeCss: resources.runtimeCssLoaded,
    runtimeJs: resources.runtimeJsLoaded,
    mainJs: resources.mainJsLoaded,
    apiHealth: {
      ok: Boolean(health.ok),
      status: Number(health.status || 0)
    },
    erros: startupDebugEvents,
    cssHref: resources.stylesheetHref
  };
}

function renderStartupFailure() {
  const root = document.getElementById('miniapp-root');
  if (!root) return;
  root.classList.remove('app-loading');
  const debugUrl = new URL(window.location.href);
  debugUrl.searchParams.set('debug', '1');
  if (state.buildVersion) debugUrl.searchParams.set('miniapp_v', state.buildVersion);
  root.innerHTML = `
    <section class="startup-failed-shell">
      <h2>Não foi possível concluir o carregamento</h2>
      <p class="startup-failed-reason">${escapeHtml(state.startupError || 'Erro desconhecido')}</p>
      <p>Verifique conexão e tente novamente.</p>
      <button id="miniappRetryButton" type="button">Tentar novamente</button>
      <a href="${debugUrl.toString()}" class="miniapp-debug-link">Abrir diagnóstico</a>
    </section>
  `;
  const retryButton = root.querySelector('#miniappRetryButton');
  if (retryButton) retryButton.addEventListener('click', () => window.location.reload());
  if (state.debugMode) renderDebugPanel(root);
}

function renderDebugPanel(rootFallback) {
  if (!state.debugMode) return;
  const root = rootFallback || document.getElementById('miniapp-root');
  if (!root) return;
  const debug = collectDebugSnapshot();
  let debugRoot = document.getElementById('miniappDebugOverlay');
  if (!debugRoot) {
    debugRoot = document.createElement('section');
    debugRoot.id = 'miniappDebugOverlay';
    debugRoot.className = 'miniapp-debug-panel';
    root.appendChild(debugRoot);
  }
  debugRoot.innerHTML = `
    <h2>Mini App Debug</h2>
    <div><strong>URL atual:</strong> ${escapeHtml(debug.urlAtual)}</div>
    <div><strong>buildVersion:</strong> ${escapeHtml(debug.buildVersion || 'indefinida')}</div>
    <div><strong>apiBase:</strong> ${escapeHtml(debug.apiBase)}</div>
    <div><strong>Dentro do Telegram:</strong> ${debug.emTelegram ? 'sim' : 'não'}</div>
    <div><strong>initData existe:</strong> ${debug.initDataExiste ? 'sim' : 'não'}</div>
    <div><strong>authMode:</strong> ${escapeHtml(debug.authMode)}</div>
    <div><strong>Static host:</strong> ${debug.apiRunningOnStaticHost ? 'sim' : 'não'}</div>
    <div><strong>CSS carregado:</strong> ${debug.cssCarregado ? 'sim' : 'não'} ${debug.cssHref ? `(${escapeHtml(debug.cssHref)})` : ''}</div>
    <div><strong>runtime.css/js:</strong> ${debug.runtimeCss ? 'sim' : 'não'} / ${debug.runtimeJs ? 'sim' : 'não'}</div>
    <div><strong>main.js:</strong> ${debug.mainJs ? 'sim' : 'não'}</div>
    <div><strong>runtime.css:</strong> ${debug.runtimeCss ? escapeHtml(debug.runtimeCssHref) : 'não carregado'}</div>
    <div><strong>runtime.js:</strong> ${debug.runtimeJs ? escapeHtml(debug.runtimeJsHref) : 'não carregado'}</div>
    <div><strong>API health:</strong> ${debug.apiHealth.ok ? 'ok' : 'não ok'} (status ${debug.apiHealth.status})</div>
    <div><strong>Carregado em:</strong> ${escapeHtml(debug.carregadoEm)}</div>
    <details>
      <summary>Erros recentes do frontend</summary>
      <pre>${escapeHtml((debug.erros || []).join('\n') || 'Sem erros')}</pre>
    </details>
  `;
}

function markStartupCompleted() {
  state.startupCompletedAt = Date.now();
  state.startupFailed = false;
  state.startupError = '';
  clearStartupWatchdog();
  renderDebugPanel();
}

function resetStartupState() {
  state.startupStartedAt = Date.now();
  state.startupCompletedAt = 0;
  state.startupFailed = false;
  state.startupError = '';
}

const telegram = setupTelegram(() => {
  if (state.currentPage === 'cart') return sendCartToTelegram();
  if (cartItems(state).length) {
    renderer?.iniciarCheckout?.();
  }
  return null;
});

renderer = createRenderer({ state, telegram, handlers });

function installMiniAppDesignRuntime() {
  if (!apiBaseConfigurada(state)) return;
  const base = apiBase(state);
  const runtimeBase = base || '';
  const normalizedBase = String(runtimeBase || '').replace(/\/+$/, '');

  if (!document.getElementById('miniapp-design-runtime-css')) {
    const link = document.createElement('link');
    link.id = 'miniapp-design-runtime-css';
    link.rel = 'stylesheet';
    link.href = appendCacheBuster(`${normalizedBase}/mini-app-design/runtime.css`);
    document.head.appendChild(link);
  }

  if (!document.getElementById('miniapp-design-runtime-js')) {
    const script = document.createElement('script');
    script.id = 'miniapp-design-runtime-js';
    script.src = appendCacheBuster(`${normalizedBase}/mini-app-design/runtime.js`);
    script.defer = true;
    if (normalizedBase) script.dataset.apiBase = normalizedBase;
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

async function sendCartToTelegram() {
  if (state.sending) return;
  if (!state.loja.aceitaPedidos) {
    renderer.showToast(state.loja.mensagem || 'A loja não está recebendo pedidos agora.');
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
    renderer.showToast(error.message || 'Não foi possível carregar o Pix.');
  }
}

async function showTracking(pedidoId) {
  try {
    const pedido = await loadOrder(state, pedidoId);
    if (pedido?.id) await loadTracking(state, pedido.id);
    renderer.navigateTo('tracking');
    renderer.render();
  } catch (error) {
    renderer.showToast(error.message || 'Não foi possível carregar acompanhamento.');
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
    renderer.showToast(error.message || 'Não foi possível atualizar o Pix.');
  }
}

function receiptFileError(file) {
  if (!file) return '';
  const maxBytes = 5 * 1024 * 1024;
  const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']);
  const allowedExtensions = /\.(png|jpe?g|webp|pdf)$/i;
  if (file.size > maxBytes) return 'Comprovante muito grande. Envie arquivo de até 5 MB.';
  if (!allowedTypes.has(String(file.type || '').toLowerCase())) return 'Formato inválido. Use PNG, JPG, WEBP ou PDF.';
  if (!allowedExtensions.test(file.name || '')) return 'Extensão inválida. Use PNG, JPG, WEBP ou PDF.';
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
    const texto = window.prompt('Informe uma observação sobre o pagamento ou comprovante:');
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
    renderer.showToast('Comprovante registrado para conferência.');
  } catch (error) {
    renderer.showToast(error.message || 'Não foi possível enviar comprovante.');
  }
}

async function copyCurrentPix() {
  try {
    await copyPix(state);
    renderer.showToast('Pix copiado.');
  } catch (error) {
    renderer.showToast(error.message || 'Pix indisponível.');
  }
}

async function shareReferral() {
  try {
    await shareReferralCode(state);
    renderer.showToast('Código de indicação compartilhado.');
  } catch (_) {
    renderer.showToast('Código de indicação copiado.');
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
  const delay = Math.max(1000, Number(state.updateIntervalMs || 7000));
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
    window.MJMiniAppBridge?.startPolling?.(state.updateIntervalMs || 7000);
    startPolling();
    return data;
  } catch (error) {
    state.authOk = false;
    state.authMode = 'offline';
    state.authError = error?.message || 'Sessão da Mini App indisponível.';
    if (renderer.els.authStatus) renderer.els.authStatus.textContent = 'Sessão indisponível';
    renderer.render();
    return null;
  }
}

async function init() {
  resetStartupState();
  state.debugMode = getStartupDebugMode();
  state.buildVersion = detectBuildVersion();
  if (!state.buildVersion) await detectBuildVersionFromVersionJson().catch(() => null);
  state.buildVersion = formatBuildVersion(state.buildVersion || '');
  state.startupStartedAt = Date.now();
  state.startupAttempts += 1;
  installDebugCapture();
  const root = document.getElementById('miniapp-root');
  if (root) root.classList.remove('app-loading');
  handlers.reloadCatalog = reloadCatalog;
  handlers.loadMoreProducts = loadMoreProducts;
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

  startStartupWatchdog();

  await Promise.all([
    reloadCatalog(),
    authenticate()
  ]);

  await sincronizarStatusLoja();
  markStartupCompleted();
  state.storeStatusTimer = setInterval(sincronizarStatusLoja, Math.max(1000, Number(state.updateIntervalMs || 7000)));
}

init().catch(error => {
  console.error(error);
  const message = `Não foi possível iniciar a loja. ${error?.message || 'Atualize a página.'}`;
  markStartupFailure(message);
});
