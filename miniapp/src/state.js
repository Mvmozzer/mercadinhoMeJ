import { restoreMiniAppUiState } from './storage.js';

export const MINIAPP_UI_DEFAULTS = {
  header: {
    logo: '/assets/logo-mj-mercadinho.png'
  },
  theme: {
    primary: '#ed000b',
    primarySoft: '#ffefef',
    bg: '#f4f5f9',
    card: '#ffffff',
    text: '#14161d',
    muted: '#6a6e82',
    border: '#e8ebf3',
    heroFrom: '#ff3b4b',
    heroTo: '#ed000b'
  },
  splash: {
    mode: 'logo',
    mediaUrl: '',
    background: '#ed000b',
    gradientFrom: '#ff3b4b',
    gradientTo: '#ed000b',
    durationMs: 5000
  }
};

export function normalizeMiniAppUi(raw = {}) {
  const cfg = raw && typeof raw === 'object' ? raw : {};
  return {
    header: {
      logo: String((cfg.header && cfg.header.logo) || '').trim() || MINIAPP_UI_DEFAULTS.header.logo
    },
    theme: {
      ...MINIAPP_UI_DEFAULTS.theme,
      ...(cfg.theme || {})
    },
    splash: {
      ...MINIAPP_UI_DEFAULTS.splash,
      ...(cfg.splash || {})
    }
  };
}

export function createState() {
  const saved = restoreMiniAppUiState();
  return {
    page: 'home',
    previousPage: 'home',
    sectionId: saved.sectionId || '',
    query: saved.query || '',
    apiBase: '',
    bridgeReady: false,
    authOk: false,
    loading: true,
    sending: false,
    error: '',
    store: { nome: 'Mercadinho M&J', status: 'aberta', mensagem: 'Aberto agora', aceitaPedidos: true },
    cliente: { nome: 'cliente' },
    loyalty: { saldoPontos: 0 },
    sections: [],
    products: [],
    cart: {},
    orders: [],
    pix: null,
    pedidoAtual: null,
    checkoutMessage: '',
    selectedDeliveryMode: 'retirada',
    miniappUi: normalizeMiniAppUi(saved.miniappUi || saved.miniappui || {})
  };
}

export function applySnapshot(state, snapshot = {}) {
  if (snapshot.cliente) state.cliente = { ...state.cliente, ...snapshot.cliente };
  if (Array.isArray(snapshot.pedidos)) state.orders = snapshot.pedidos;
  if (snapshot.loja) state.store = { ...state.store, ...snapshot.loja };
  if (snapshot.programa) state.loyalty = { ...state.loyalty, ...snapshot.programa };
  if (snapshot.miniappUi) state.miniappUi = normalizeMiniAppUi(snapshot.miniappUi);
}

export function reopenStateFromUrl() {
  const params = new URLSearchParams(location.search);
  return params.get('mj_state') || '';
}
