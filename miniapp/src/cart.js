import {
  clampProductQuantity,
  isWeightedProduct,
  measureStep
} from './catalog.js';
import { CART_KEY, writeJson, readJson } from './storage.js';
import { toNumber } from './utils.js';

export function restoreCart(state) {
  const saved = readJson(CART_KEY, {});
  state.cart.clear();
  Object.entries(saved || {}).forEach(([id, qty]) => {
    const quantity = Math.max(0, Number(qty) || 0);
    if (quantity > 0) state.cart.set(id, quantity);
  });
}

export function persistCart(state) {
  const payload = {};
  state.cart.forEach((qty, id) => { payload[id] = qty; });
  writeJson(CART_KEY, payload);
}

export function cartQty(state, id) {
  return state.cart.get(id) || 0;
}

export function findProduct(state, id) {
  return state.productCache.get(id) || state.products.find(item => item.id === id) || null;
}

export function pruneCart(state, clearPendingOrderId) {
  const ids = new Set(state.products.map(item => item.id));
  let changed = false;
  state.cart.forEach((qty, id) => {
    const product = findProduct(state, id);
    if (state.catalogPage.usePaged && !product) return;
    if ((!state.catalogPage.usePaged && !ids.has(id)) || !product || qty > product.stock) {
      if (product && product.stock > 0) state.cart.set(id, product.stock);
      else state.cart.delete(id);
      changed = true;
    }
  });
  if (changed) clearPendingOrderId?.();
  persistCart(state);
}

export function changeQty(state, id, delta, clearPendingOrderId) {
  const product = findProduct(state, id);
  if (!product) return { ok: false, message: '' };
  if (toNumber(product.stock, 0) <= 0) return { ok: false, message: 'Produto sem estoque no momento' };
  state.viniAi.focusedProductId = id;
  state.viniAi.interactedProducts.add(id);
  const current = cartQty(state, id);
  const next = clampProductQuantity(product, current + (isWeightedProduct(product) ? delta * measureStep(product) : delta));
  if (next !== current) clearPendingOrderId?.();
  if (next > 0) state.cart.set(id, next);
  else {
    state.cart.delete(id);
    state.itemNotes.delete(id);
  }
  persistCart(state);
  return { ok: true, added: delta > 0 && current === 0, next, current };
}

export function setWeightedQty(state, id, value, clearPendingOrderId) {
  const product = findProduct(state, id);
  if (!product || !isWeightedProduct(product)) return { ok: false };
  const current = cartQty(state, id);
  const next = clampProductQuantity(product, value);
  if (next !== current) clearPendingOrderId?.();
  if (next > 0) state.cart.set(id, next);
  else {
    state.cart.delete(id);
    state.itemNotes.delete(id);
  }
  persistCart(state);
  return { ok: true, added: current === 0 && next > 0, next, current };
}

export function clearCart(state, clearPendingOrderId) {
  state.cart.clear();
  state.itemNotes.clear();
  clearPendingOrderId?.();
  persistCart(state);
}

export function cartItems(state) {
  return Array.from(state.cart.entries()).map(([id, quantity]) => {
    const product = findProduct(state, id);
    return product ? { ...product, quantity } : null;
  }).filter(Boolean);
}

export function cartTotal(state) {
  return cartItems(state).reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function cartCount(state) {
  return cartItems(state).reduce((sum, item) => sum + (isWeightedProduct(item) ? 1 : item.quantity), 0);
}

export function itemNoteValue(state, id) {
  return String(state.itemNotes.get(id) || '').trim().slice(0, 240);
}

export function setItemNoteValue(state, id, value) {
  const text = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 240);
  if (text) state.itemNotes.set(id, text);
  else state.itemNotes.delete(id);
}

export function syncCouponFromInput(state, value) {
  state.couponCode = String(value || '').trim().slice(0, 40);
}

export function syncUsePointsIntent(state, value) {
  state.usePointsIntent = value === true;
}

export function promotionalPointsPreview(state) {
  const total = cartTotal(state);
  const earned = [];
  const pending = [];
  cartItems(state).forEach(item => {
    const offer = item.pointOffer || {};
    if (offer.isActive !== true || Number(offer.points || 0) <= 0) return;
    const entry = {
      productId: item.id,
      productName: item.name,
      points: Number(offer.points || 0),
      minimumOrderValue: Number(offer.minimumOrderValue || 0)
    };
    if (total >= entry.minimumOrderValue) earned.push(entry);
    else pending.push({ ...entry, missingValue: Number((entry.minimumOrderValue - total).toFixed(2)) });
  });
  return {
    totalPromotionalPoints: earned.reduce((sum, item) => sum + item.points, 0),
    earned,
    pending
  };
}

export function promotionalPointsText(state, money) {
  const preview = promotionalPointsPreview(state);
  if (preview.totalPromotionalPoints > 0) {
    return `Voce ganhou +${preview.totalPromotionalPoints} pontos com produtos selecionados.`;
  }
  if (preview.pending.length) {
    const item = preview.pending[0];
    return `Faltam ${money(item.missingValue)} para ganhar +${item.points} pontos${item.productName ? ` de ${item.productName}` : ''}.`;
  }
  return '';
}
