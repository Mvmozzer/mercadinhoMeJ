export const CART_KEY = 'mj_mercadinho_cart_v2';
export const MINIAPP_TOKEN_KEY = 'mj_mercadinho_miniapp_token_v1';
export const PENDING_ORDER_KEY = 'mj_mercadinho_pending_order_v1';
export const API_BASE_KEY = 'mj_mercadinho_api_base';

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
