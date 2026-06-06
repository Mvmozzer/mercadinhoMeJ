import {
  authenticateMiniApp,
  apiBase,
  apiBaseConfigurada,
  bridgeSendAction,
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

async function sincronizarStatusLoja() {
  await sincronizarStatusLojaApi(state);
  renderer.renderStatusLoja();
  renderer.render();
}

async function saveProfile() {
  if (state.savingProfile) return;
  if (!state.authOk) {
    renderer.showToast('Conectando com a loja...');
    await carregarRuntimeConfigPages(state);
    await authenticate();
    if (!state.authOk) {
      const motivo = state.authError || 'Nao consegui autenticar sua sessao.';
      const mensagem = /initData|Telegram/i.test(motivo)
        ? 'Abra a loja pelo Telegram. Para teste fora do Telegram, ative TELEGRAM_WEBAPP_DEV_AUTH=true e reinicie o node index.js.'
        : motivo;
      renderer.showToast(mensagem);
      return;
    }
  }
  state.savingProfile = true;
  if (renderer.els.saveProfile) {
    renderer.els.saveProfile.disabled = true;
    renderer.els.saveProfile.textContent = 'Salvando...';
  }
  try {
    await salvarCadastroMiniApp(state, renderer.els);
    await bridgeSendAction(state, 'cadastro/update', {
      nome: renderer.els.profileName?.value || '',
      cpf: renderer.els.profileCpf?.value || '',
      dataNascimento: renderer.els.profileBirthDate?.value || '',
      telefone: renderer.els.profilePhone?.value || '',
      cep: renderer.els.profileCep?.value || '',
      rua: renderer.els.profileRua?.value || '',
      numero: renderer.els.profileNumero?.value || '',
      complemento: renderer.els.profileComplemento?.value || '',
      bairro: renderer.els.profileBairro?.value || '',
      cidade: renderer.els.profileCidade?.value || '',
      estado: renderer.els.profileEstado?.value || ''
    }).catch(() => null);
    renderer.preencherFormularioCadastro({ force: true });
    renderer.renderJourney();
    if (state.cliente?.cadastroCompleto !== true) {
      renderer.showToast('Complete CPF, nascimento e endereco para liberar as compras.');
      return;
    }
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
    state.authError = '';
    state.telegramUser = getUser(telegram.webApp);
    const data = await authenticateMiniApp(state, telegram.webApp);
    if (renderer.els.authStatus) {
      renderer.els.authStatus.textContent = data.modoDev ? 'Modo dev' : 'Mini App conectado';
    }
    renderer.preencherFormularioCadastro();
    renderer.render();
    await bootstrapMiniApp();
    await Promise.all([loadOrders(), loadLoyaltyState()]);
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
  handlers.syncCartAction = (action, payload) => bridgeSendAction(state, action, payload).catch(() => null);
  handlers.fillAddressByCep = () => preencherEnderecoPorCep(renderer.els);

  await carregarRuntimeConfigPages(state);
  restoreCart(state);
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
