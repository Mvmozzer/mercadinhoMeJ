import { API_BASE_KEY, MINIAPP_TOKEN_KEY, PENDING_ORDER_KEY, readText } from './storage.js';

export function createInitialState() {
  return {
    products: [],
    productCache: new Map(),
    catalogSections: [],
    section: '',
    query: '',
    marketFilter: '',
    marketSort: '',
    cart: new Map(),
    itemNotes: new Map(),
    cartOpen: false,
    productSheetId: '',
    checkoutStep: 'catalog',
    usePointsIntent: false,
    couponCode: '',
    telegramUser: null,
    telegramInitData: '',
    apiBaseUrl: readText(API_BASE_KEY, ''),
    miniappToken: readText(MINIAPP_TOKEN_KEY, ''),
    pendingClientOrderId: readText(PENDING_ORDER_KEY, ''),
    authOk: false,
    authMode: 'pending',
    catalogLoading: true,
    catalogSource: 'loading',
    catalogPage: {
      page: 0,
      pageSize: 48,
      hasMore: false,
      loadingMore: false,
      usePaged: false
    },
    orders: [],
    pedidoAtual: null,
    orderStatus: null,
    pix: null,
    loyalty: {
      saldoPontos: 0,
      saldoReais: 0,
      codigoIndicacao: '',
      historico: [],
      regras: {}
    },
    checkout: {
      preview: null,
      lastCreate: null,
      deliveryMode: 'retirada',
      pointsToUse: 0
    },
    checkoutConfig: {},
    paymentConfig: {},
    bootstrap: null,
    tracking: null,
    location: null,
    updateIntervalMs: 5000,
    lastUpdated: 0,
    cliente: null,
    savingProfile: false,
    sending: false,
    pollTimer: null,
    storeStatusTimer: null,
    loja: {
      status: 'aberta',
      mensagem: '',
      aceitaPedidos: true
    },
    viniAi: {
      focusedProductId: '',
      viewedSections: new Map(),
      interactedProducts: new Set(),
      alertHideTimer: null
    }
  };
}
