import { CART_KEY, readJson, writeJson } from './storage.js?v=2026.06.18.602';

function itemQuantity(item = {}) {
  const quantity = Number(item.quantity ?? item.quantidade ?? item.qtd ?? 0);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
}

function productId(product = {}) {
  return String(product.id || product.produto_id || product.produtoId || '').trim();
}

function cartItemId(item = {}) {
  return String(item.id || item.produto_id || item.produtoId || '').trim();
}

function productCatalogMap(products = []) {
  const map = new Map();
  products.forEach(product => {
    const keys = [product.id, product.produto_id, product.produtoId]
      .map(value => String(value || '').trim())
      .filter(Boolean);
    keys.forEach(key => map.set(key, product));
  });
  return map;
}

function cartItemFromProduct(product = {}, quantity = 1) {
  const id = productId(product);
  const name = product.name || product.nome || 'Produto';
  const price = Number(product.price ?? product.preco ?? 0);
  const saleMode = product.saleMode || product.modo_venda || product.modoVenda || 'unit';
  return {
    id,
    produto_id: String(product.produto_id || product.produtoId || id),
    name,
    nome: name,
    price,
    preco: price,
    image: product.image || product.imagem || '',
    unit: product.unit || product.unidade || product.tamanho || 'un',
    section: product.section || product.secao_nome || product.secao || '',
    points: Number(product.points || product.pontos || 0),
    saleMode,
    quantity
  };
}

export function restoreCart(state) {
  state.cart = readJson(CART_KEY, {}) || {};
}

export function saveCart(state) {
  writeJson(CART_KEY, state.cart || {});
}

export function reconcileCartWithCatalog(state, options = {}) {
  state.cart = state.cart || {};
  const products = Array.isArray(state.products) ? state.products : [];
  if (!products.length) return state.cart;

  const before = JSON.stringify(state.cart || {});
  const byId = productCatalogMap(products);
  const next = {};

  Object.values(state.cart || {}).forEach(item => {
    const quantity = itemQuantity(item);
    if (!quantity) return;
    const product = byId.get(cartItemId(item));
    if (!product) return;
    const normalized = cartItemFromProduct(product, quantity);
    if (!normalized.id || normalized.price <= 0) return;
    next[normalized.id] = normalized;
  });

  state.cart = next;
  if (options.persist !== false && JSON.stringify(next) !== before) saveCart(state);
  return state.cart;
}

export function cartQty(state, id) {
  return Number(state.cart?.[id]?.quantity || 0);
}

export function cartItems(state) {
  return Object.values(state.cart || {});
}

export function cartCount(state) {
  return cartItems(state).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

export function cartTotal(state) {
  return cartItems(state).reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0), 0);
}

export function changeQty(state, product, delta) {
  const id = productId(product);
  const next = Math.max(0, cartQty(state, id) + delta);
  if (!next) delete state.cart[id];
  else state.cart[id] = cartItemFromProduct(product, next);
  saveCart(state);
  return next;
}

export function clearCart(state) {
  state.cart = {};
  saveCart(state);
}

export function cartPayload(state) {
  reconcileCartWithCatalog(state);
  return cartItems(state).map(item => ({
    produto_id: item.id,
    id: item.id,
    nome: item.name,
    quantidade: item.quantity,
    preco: item.price,
    saleMode: item.saleMode,
    quantidade_solicitada: item.quantity,
    peso_estimado: item.saleMode === 'weighted' ? item.quantity : null,
    subtotal_estimado_exibido: Number((Number(item.quantity || 0) * Number(item.price || 0)).toFixed(2)),
    modo_venda: item.saleMode === 'weighted' ? 'granel' : 'unidade'
  }));
}
