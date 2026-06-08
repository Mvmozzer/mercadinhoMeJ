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
    currentPage: 'home',
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
    allowTemporaryApiBase: false,
    miniappToken: readText(MINIAPP_TOKEN_KEY, ''),
    pendingClientOrderId: readText(PENDING_ORDER_KEY, ''),
    authOk: false,
    authMode: 'pending',
    authError: '',
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
      lastItemCount: 0,
      deliveryMode: 'entrega',
      pointsToUse: 0,
      deliveryAddress: {},
      deliveryAddressSummary: '',
      deliveryAddressEditing: false,
      deliveryAddressDirty: false,
      saveAddressToProfile: false
    },
    checkoutConfig: {},
    paymentConfig: {},
    miniappDesign: {
      tema: 'verde_fresco',
      modo: 'simples',
      banners: {
        ativo: true,
        itens: [{
          titulo: 'OFERTAS DA SEMANA',
          subtitulo: 'Descontos de até 40%',
          cta: 'Ver ofertas',
          emoji: '🥑',
          tom: 'offer'
        }]
      },
      logoUrl: 'assets/logo-mj-mercadinho.png',
      destaques: {
        ativo: true,
        itens: [
          { id: 'ofertas', titulo: 'Ofertas da semana', subtitulo: 'Descontos selecionados pela loja', cta: 'Ver ofertas', emoji: '🏷️', tom: 'offer', imagem: '', acao: 'ofertas', ativo: true, ordem: 1 },
          { id: 'combos', titulo: 'Combos econômicos', subtitulo: 'Leve mais pagando menos', cta: 'Ver combos', emoji: '🛒', tom: 'combo', imagem: '', acao: 'combos', ativo: true, ordem: 2 },
          { id: 'pontos', titulo: 'Acumule pontos', subtitulo: 'Comprou, ganhou desconto futuro', cta: 'Meus pontos', emoji: '⭐', tom: 'points', imagem: '', acao: 'loyalty', ativo: true, ordem: 3 },
          { id: 'indicacao', titulo: 'Indique e ganhe', subtitulo: 'Chame amigos e ganhe recompensas', cta: 'Indicar', emoji: '🎁', tom: 'invite', imagem: '', acao: 'loyalty', ativo: true, ordem: 4 }
        ]
      },
      fidelidade: {
        ativo: true,
        titulo: 'Programa Fidelidade',
        imagemCapa: '',
        botao: 'Trocar pontos no carrinho'
      },
      categorias: { destaque: true, limite: 8, ordem: [] },
      maisVendidos: true,
      carrinhoFixo: true,
      botoesCta: true,
      pontosIndicacao: true,
      acompanhamentoMapa: true,
      layoutHome: 'delivery',
      buscaFiltros: true
    },
    restoredPedidoId: '',
    restoredUiOwner: '',
    bootstrap: null,
    tracking: null,
    location: null,
    updateIntervalMs: 7000,
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
