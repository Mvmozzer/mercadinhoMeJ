export const MINIAPP_UI_STATE_KEY = 'mj-miniapp-ui-v3';
export const CART_KEY = 'mj-miniapp-cart-v3';
export function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || ''); } catch { return fallback; } }
export function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
export function persistMiniAppUiState(state) { writeJson(MINIAPP_UI_STATE_KEY, { page: state.page, sectionId: state.sectionId, query: state.query }); }
export function restoreMiniAppUiState() { return readJson(MINIAPP_UI_STATE_KEY, {}); }
