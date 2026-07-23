import { CART_KEY, readJson, writeJson } from './storage.js?v=2026.07.23.900';
import { isWeightedProduct, measureConversionFactor, productAvailability, productWholesale, weightedProductRules } from './catalog.js?v=2026.07.23.900';

function itemQuantity(item = {}) {
  const quantity = Number(item.quantity ?? item.quantidade ?? item.qtd ?? 0);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
}

function roundedQuantity(value, precision = 0) {
  return Number(Number(value || 0).toFixed(Math.max(0, Math.min(3, precision))));
}

export function quantityInPriceBase(product = {}, quantity = itemQuantity(product)) {
  const informedQuantity = Number(quantity);
  if (!Number.isFinite(informedQuantity) || informedQuantity <= 0) return 0;
  const rules = weightedProductRules(product, { respectStock: false });
  return Number((informedQuantity * measureConversionFactor(rules.unit, rules.priceBaseUnit)).toFixed(6));
}

export function cartLineSubtotal(item = {}, quantity = itemQuantity(item)) {
  const price = Number(item.price ?? item.preco ?? item.preco_unitario ?? 0);
  if (!Number.isFinite(price) || price <= 0) return 0;
  const priceCents = Math.max(0, Math.round(price * 100));
  const baseQuantity = quantityInPriceBase(item, quantity);
  return Number((Math.round(priceCents * baseQuantity) / 100).toFixed(2));
}

export function normalizeProductQuantity(product = {}, requested = 0, options = {}) {
  const value = Number(requested);
  if (!Number.isFinite(value) || value <= 0) return 0;
  const rules = weightedProductRules(product, options);
  if (!rules.weighted) {
    const integer = Math.max(0, Math.floor(value));
    return rules.max > 0 ? Math.min(integer, Math.floor(rules.max)) : integer;
  }
  if (rules.max > 0 && rules.max + 1e-6 < rules.selectionMin) return 0;
  const steps = Math.max(1, Math.round(value / rules.step));
  let normalized = roundedQuantity(Math.max(rules.selectionMin, steps * rules.step), rules.precision);
  if (rules.max > 0) normalized = Math.min(normalized, rules.max);
  if (normalized + 1e-6 < rules.selectionMin) return 0;
  return roundedQuantity(normalized, rules.precision);
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

export function wholesaleProgress(product = {}, quantity = 0) {
  const info = productWholesale(product);
  const current = Math.max(0, Math.floor(Number(quantity || 0)));
  if (!info.active) {
    return {
      active: false,
      quantity: current,
      minQuantity: 0,
      missing: 0,
      percent: 0,
      reached: false,
      wholesalePrice: 0
    };
  }
  const reached = current >= info.wholesaleMinQuantity;
  return {
    active: true,
    quantity: current,
    minQuantity: info.wholesaleMinQuantity,
    missing: Math.max(0, info.wholesaleMinQuantity - current),
    percent: Math.min(100, Math.max(0, Math.round((current / info.wholesaleMinQuantity) * 100))),
    reached,
    wholesalePrice: info.wholesalePrice
  };
}

export function wholesalePriceInfo(product = {}, quantity = 0) {
  const retailPrice = Number(product.price ?? product.preco ?? 0) || 0;
  const progress = wholesaleProgress(product, quantity);
  const price = progress.active && progress.reached ? progress.wholesalePrice : retailPrice;
  return {
    price,
    retailPrice,
    wholesalePrice: progress.wholesalePrice,
    wholesaleApplied: progress.active && progress.reached,
    minQuantity: progress.minQuantity,
    progress
  };
}

function cartItemFromProduct(product = {}, quantity = 1) {
  const id = productId(product);
  const name = product.name || product.nome || 'Produto';
  const priceInfo = wholesalePriceInfo(product, quantity);
  const price = priceInfo.price;
  const availability = productAvailability(product);
  const weightRules = weightedProductRules(product);
  const saleMode = weightRules.weighted ? 'weighted' : 'unit';
  return {
    id,
    produto_id: String(product.produto_id || product.produtoId || id),
    name,
    nome: name,
    price,
    preco: price,
    retailPrice: priceInfo.retailPrice,
    preco_varejo: priceInfo.retailPrice,
    wholesalePrice: priceInfo.wholesalePrice,
    preco_atacado: priceInfo.wholesalePrice,
    wholesaleMinQuantity: priceInfo.minQuantity,
    quantidade_atacado: priceInfo.minQuantity,
    wholesaleApplied: priceInfo.wholesaleApplied,
    atacado_aplicado: priceInfo.wholesaleApplied,
    wholesaleProgress: priceInfo.progress,
    progresso_atacado: priceInfo.progress,
    image: product.image || product.imagem || '',
    unit: weightRules.unit,
    unidadeVenda: weightRules.unit,
    saleUnit: weightRules.unit,
    unidadeBasePreco: weightRules.priceBaseUnit,
    priceBaseUnit: weightRules.priceBaseUnit,
    unidade_base_preco: weightRules.priceBaseUnit,
    section: product.section || product.secao_nome || product.secao || '',
    saleMode,
    modoVenda: weightRules.weighted ? 'granel' : 'unidade',
    modo_venda: weightRules.weighted ? 'granel' : 'unidade',
    pesoMinimo: weightRules.weighted ? weightRules.configuredMin : 0,
    pesoMaximo: weightRules.weighted ? weightRules.configuredMax : 0,
    incrementoPeso: weightRules.weighted ? weightRules.configuredStep : 0,
    textoPesoAproximado: weightRules.weighted ? weightRules.notice : '',
    disponibilidade: availability.mode,
    disponibilidade_label: product.disponibilidade_label || product.disponibilidadeLabel || availability.label,
    sob_encomenda: availability.preorder,
    sobEncomenda: availability.preorder,
    prazo_retirada_dias: availability.days,
    previsao_retirada_texto: product.previsao_retirada_texto || product.previsaoRetiradaTexto || availability.forecast,
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
    const safeQuantity = normalizeProductQuantity(product, quantity, {
      respectStock: state.checkout?.bloquearCompraAcimaEstoque !== false
    });
    if (!safeQuantity) return;
    const normalized = cartItemFromProduct(product, safeQuantity);
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
  return cartItems(state).reduce((sum, item) => sum + (isWeightedProduct(item) ? 1 : Number(item.quantity || 0)), 0);
}

export function cartTotal(state) {
  return Number(cartItems(state).reduce((sum, item) => sum + cartLineSubtotal(item), 0).toFixed(2));
}

export function changeQty(state, product, delta) {
  const id = productId(product);
  const current = cartQty(state, id);
  const quantityOptions = { respectStock: state.checkout?.bloquearCompraAcimaEstoque !== false };
  const rules = weightedProductRules(product, quantityOptions);
  const requested = rules.weighted
    ? (current > 0 ? current + (Number(delta || 0) * rules.step) : (Number(delta || 0) > 0 ? rules.selectionMin : 0))
    : current + Number(delta || 0);
  const next = normalizeProductQuantity(product, requested, quantityOptions);
  if (!next) delete state.cart[id];
  else state.cart[id] = cartItemFromProduct(product, next);
  saveCart(state);
  return next;
}

export function setQty(state, product, quantity) {
  const id = productId(product);
  const next = normalizeProductQuantity(product, quantity, {
    respectStock: state.checkout?.bloquearCompraAcimaEstoque !== false
  });
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
    preco_varejo: item.retailPrice,
    preco_atacado: item.wholesalePrice,
    quantidade_atacado: item.wholesaleMinQuantity,
    atacado_aplicado: item.wholesaleApplied,
    progresso_atacado: item.wholesaleProgress,
    disponibilidade: item.disponibilidade,
    disponibilidade_label: item.disponibilidade_label,
    sob_encomenda: item.sob_encomenda === true || item.sobEncomenda === true,
    prazo_retirada_dias: item.prazo_retirada_dias,
    previsao_retirada_texto: item.previsao_retirada_texto,
    saleMode: item.saleMode,
    modoVenda: item.modoVenda,
    pesoMinimo: item.pesoMinimo,
    pesoMaximo: item.pesoMaximo,
    incrementoPeso: item.incrementoPeso,
    unidadeVenda: item.unidadeVenda || item.saleUnit || item.unit,
    saleUnit: item.saleUnit || item.unidadeVenda || item.unit,
    unidadeBasePreco: item.unidadeBasePreco || item.priceBaseUnit || item.unidade_base_preco || item.unit,
    priceBaseUnit: item.priceBaseUnit || item.unidadeBasePreco || item.unidade_base_preco || item.unit,
    quantidade_base_preco: quantityInPriceBase(item),
    quantidade_solicitada: item.quantity,
    peso_estimado: item.saleMode === 'weighted' ? item.quantity : null,
    subtotal_estimado_exibido: cartLineSubtotal(item),
    modo_venda: item.saleMode === 'weighted' ? 'granel' : 'unidade'
  }));
}
