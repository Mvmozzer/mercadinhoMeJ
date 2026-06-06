import {
  authenticateMiniApp,
  carregarRuntimeConfigPages,
  loadBootstrap,
  loadMoreProducts as loadMoreProductsApi,
  loadProducts as loadProductsApi,
  preencherEnderecoPorCep,
  salvarCadastroMiniApp,
  sincronizarStatusLoja as sincronizarStatusLojaApi
} from './api.js';
import { pruneCart, restoreCart, cartItems } from './cart.js';
import { sectionItems } from './catalog.js';
import { finalizarCheckoutMiniApp, limparClientOrderIdPendente, previewCheckoutMiniApp } from './checkout.js';
import { loadLoyalty, shareReferralCode } from './loyalty.js';
import { loadOrder, loadOrders as loadOrdersApi, pollOrderStatus } from './orders.js';
import { copyPix, refreshPixStatus, uploadReceipt } from './pix.js';
import { createRenderer } from './render.js';
import { createInitialState } from './state.js';
import { getUser, isActive, setMainButtonLoading, setupTelegram } from './telegram.js';
import { loadTracking, pollLocation, stopTrackingWhenDelivered } from './tracking.js';

const state = createInitialState();
const handlers = {};
let renderer = null;

const telegram = setupTelegram(() => {
  if (state.checkoutStep === 'cart') return sendCartToTelegram();
  return renderer?.iniciarCheckout();
});

renderer = createRenderer({ state, telegram, handlers });

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

async function sincronizarStatusLoja() {
  await sincronizarStatusLojaApi(state);
  renderer.renderStatusLoja();
  renderer.render();
}

async function saveProfile() {
  if (!state.authOk || state.savingProfile) return;
  state.savingProfile = true;
  if (renderer.els.saveProfile) {
    renderer.els.saveProfile.disabled = true;
    renderer.els.saveProfile.textContent = 'Salvando...';
  }
  try {
    await salvarCadastroMiniApp(state, renderer.els);
    renderer.preencherFormularioCadastro();
    renderer.renderJourney();
    renderer.navigateTo('home');
    renderer.showToast('Cadastro salvo. Agora voce ja pode comprar.');
  } catch (error) {
    renderer.showToast(error.message || 'Nao foi possivel salvar seu cadastro');
  } finally {
    state.savingProfile = false;
    if (renderer.els.saveProfile) {
      renderer.els.saveProfile.disabled = false;
      renderer.els.saveProfile.textContent = 'Continuar para compras';
    }
    renderer.render();
  }
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
    if (result.mode === 'api') {
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

async function refreshPix() {
  const pedidoId = state.pedidoAtual?.id;
  if (!pedidoId) return;
  try {
    await refreshPixStatus(state, pedidoId);
    await pollOrderStatus(state, pedidoId).catch(() => null);
    renderer.render();
    renderer.showToast('Pagamento atualizado');
  } catch (error) {
    renderer.showToast(error.message || 'Nao foi possivel atualizar Pix.');
  }
}

async function sendReceipt() {
  const pedidoId = state.pedidoAtual?.id;
  if (!pedidoId) return;
  const texto = window.prompt('Informe uma observacao sobre o pagamento ou comprovante:');
  if (!texto) return;
  try {
    await uploadReceipt(state, pedidoId, { texto });
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
  renderer.render();
}

function startPolling() {
  if (state.pollTimer) window.clearInterval(state.pollTimer);
  const delay = Math.max(2000, Number(state.updateIntervalMs || 5000));
  state.pollTimer = window.setInterval(pollMiniApp, delay);
}

async function authenticate() {
  try {
    state.telegramUser = getUser(telegram.webApp);
    const data = await authenticateMiniApp(state, telegram.webApp);
    if (renderer.els.authStatus) {
      renderer.els.authStatus.textContent = data.modoDev ? 'Modo dev' : 'Mini App conectado';
    }
    renderer.preencherFormularioCadastro();
    renderer.render();
    await bootstrapMiniApp();
    await Promise.all([loadOrders(), loadLoyaltyState()]);
    startPolling();
  } catch (_) {
    state.authOk = false;
    state.authMode = 'offline';
    if (renderer.els.authStatus) renderer.els.authStatus.textContent = 'Sessao indisponivel';
    renderer.render();
  }
}

async function init() {
  handlers.reloadCatalog = reloadCatalog;
  handlers.loadMoreProducts = loadMoreProducts;
  handlers.saveProfile = saveProfile;
  handlers.sendCart = sendCartToTelegram;
  handlers.previewCheckout = previewCheckout;
  handlers.loadOrders = loadOrders;
  handlers.showPix = showPix;
  handlers.showTracking = showTracking;
  handlers.refreshPix = refreshPix;
  handlers.copyPix = copyCurrentPix;
  handlers.sendReceipt = sendReceipt;
  handlers.shareReferral = shareReferral;
  handlers.fillAddressByCep = () => preencherEnderecoPorCep(renderer.els);

  await carregarRuntimeConfigPages(state);
  restoreCart(state);
  renderer.render();

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
