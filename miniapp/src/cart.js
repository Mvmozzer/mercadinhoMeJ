import { CART_KEY, readJson, writeJson } from './storage.js?v=2026.06.18.897';
export function restoreCart(state) { state.cart = readJson(CART_KEY, {}) || {}; }
export function saveCart(state) { writeJson(CART_KEY, state.cart || {}); }
export function cartQty(state, id) { return Number(state.cart?.[id]?.quantity || 0); }
export function cartItems(state) { return Object.values(state.cart || {}); }
export function cartCount(state) { return cartItems(state).reduce((sum, item) => sum + Number(item.quantity || 0), 0); }
export function cartTotal(state) { return cartItems(state).reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0), 0); }
export function changeQty(state, product, delta) { const id = product.id; const next = Math.max(0, cartQty(state, id) + delta); if (!next) delete state.cart[id]; else state.cart[id] = { id, produto_id: product.produto_id || id, name: product.name, nome: product.name, price: product.price, preco: product.price, image: product.image, unit: product.unit, section: product.section, points: product.points, saleMode: product.saleMode || product.modo_venda || product.modoVenda || 'unit', quantity: next }; saveCart(state); return next; }
export function clearCart(state) { state.cart = {}; saveCart(state); }
export function cartPayload(state) { return cartItems(state).map(item => ({ produto_id: item.id, id: item.id, nome: item.name, quantidade: item.quantity, preco: item.price, saleMode: item.saleMode, quantidade_solicitada: item.quantity, peso_estimado: item.saleMode === 'weighted' ? item.quantity : null, subtotal_estimado_exibido: Number((Number(item.quantity || 0) * Number(item.price || 0)).toFixed(2)), modo_venda: item.saleMode === 'weighted' ? 'granel' : 'unidade' })); }
