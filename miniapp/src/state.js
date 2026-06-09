import { restoreMiniAppUiState } from './storage.js';
export const MINIAPP_DESIGN_MARKERS = { miniappDesign: true, themes: ['verde_fresco', 'vermelho_energia', 'escuro_premium'], rails: ['destaques', 'Combos econômicos', 'Indique e ganhe'] };
export function createState() {
  const saved = restoreMiniAppUiState();
  return { page: 'home', previousPage: 'home', sectionId: saved.sectionId || '', query: saved.query || '', apiBase: '', bridgeReady: false, authOk: false, loading: true, sending: false, error: '', store: { nome: 'Mercadinho M&J', status: 'aberta', mensagem: 'Aberto agora', aceitaPedidos: true }, cliente: { nome: 'cliente' }, loyalty: { saldoPontos: 0 }, miniappDesign: { tema: 'vermelho_energia', modo: 'mercado', destaques: [], categorias: {}, fidelidade: {} }, sections: [], products: [], cart: {}, orders: [], pix: null, pedidoAtual: null, checkoutMessage: '', selectedDeliveryMode: 'retirada' };
}
export function applySnapshot(state, snapshot = {}) { if (snapshot.cliente) state.cliente = { ...state.cliente, ...snapshot.cliente }; if (Array.isArray(snapshot.pedidos)) state.orders = snapshot.pedidos; if (snapshot.loja) state.store = { ...state.store, ...snapshot.loja }; if (snapshot.programa) state.loyalty = { ...state.loyalty, ...snapshot.programa }; }

export function reopenStateFromUrl() { const params = new URLSearchParams(location.search); return params.get('mj_state') || ''; }
