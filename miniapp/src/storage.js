export const CART_KEY = 'mj_mercadinho_cart_v2';
export const MINIAPP_TOKEN_KEY = 'mj_mercadinho_miniapp_token_v1';
export const PENDING_ORDER_KEY = 'mj_mercadinho_pending_order_v1';
export const API_BASE_KEY = 'mj_mercadinho_api_base';
export const MINIAPP_UI_STATE_KEY = 'mj_mercadinho_ui_state_v1';

export function readText(key, fallback = '') {
  try {
    return window.localStorage.getItem(key) || fallback;
  } catch (_) {
    return fallback;
  }
}

export function writeText(key, value) {
  try {
    window.localStorage.setItem(key, String(value || ''));
  } catch (_) {}
}

export function removeKey(key) {
  try {
    window.localStorage.removeItem(key);
  } catch (_) {}
}

export function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

export function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {}
}

function stateOwnerId(state = {}) {
  return String(
    state.cliente?.telegramId ||
    state.cliente?.chatId ||
    state.telegramUser?.id ||
    ''
  ).trim();
}

export function restoreMiniAppUiState(state) {
  const saved = readJson(MINIAPP_UI_STATE_KEY, null);
  if (!saved || saved.schema !== 1) return false;
  const ageMs = Date.now() - Number(saved.updatedAt || 0);
  if (!Number.isFinite(ageMs) || ageMs > 24 * 60 * 60 * 1000) {
    removeKey(MINIAPP_UI_STATE_KEY);
    return false;
  }
  const finalPages = new Set(['orders']);
  const finalStatuses = new Set(['entregue', 'cancelado', 'cancelada', 'finalizado']);
  if (finalPages.has(saved.currentPage) && finalStatuses.has(String(saved.orderStatus || '').toLowerCase())) {
    removeKey(MINIAPP_UI_STATE_KEY);
    return false;
  }
  if (saved.currentPage) state.currentPage = String(saved.currentPage);
  if (saved.section !== undefined) state.section = String(saved.section || '');
  if (saved.query !== undefined) state.query = String(saved.query || '');
  if (saved.productSheetId !== undefined) state.productSheetId = String(saved.productSheetId || '');
  if (saved.checkoutStep !== undefined) state.checkoutStep = String(saved.checkoutStep || 'catalog');
  if (saved.pendingOrderId) state.restoredPedidoId = String(saved.pendingOrderId);
  state.restoredUiOwner = String(saved.ownerId || '');
  return true;
}

export function persistMiniAppUiState(state) {
  const ownerId = stateOwnerId(state);
  if (!ownerId) return;
  const finalStatuses = new Set(['entregue', 'cancelado', 'cancelada', 'finalizado']);
  const orderStatus = String(state.pedidoAtual?.status || state.orderStatus?.status || '').toLowerCase();
  if (finalStatuses.has(orderStatus)) {
    removeKey(MINIAPP_UI_STATE_KEY);
    return;
  }
  writeJson(MINIAPP_UI_STATE_KEY, {
    schema: 1,
    ownerId,
    currentPage: state.currentPage,
    section: state.section,
    query: state.query,
    productSheetId: state.productSheetId,
    checkoutStep: state.checkoutStep,
    pendingOrderId: state.pedidoAtual?.id || '',
    orderStatus,
    updatedAt: Date.now()
  });
}

export function validateRestoredMiniAppUiOwner(state) {
  const restoredOwner = String(state.restoredUiOwner || '').trim();
  if (!restoredOwner) return true;
  const ownerId = stateOwnerId(state);
  if (!ownerId || ownerId === restoredOwner) return true;
  removeKey(MINIAPP_UI_STATE_KEY);
  state.currentPage = 'home';
  state.section = '';
  state.query = '';
  state.productSheetId = '';
  state.restoredPedidoId = '';
  state.restoredUiOwner = '';
  return false;
}
