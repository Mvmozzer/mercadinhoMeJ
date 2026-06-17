import { restoreMiniAppUiState } from './storage.js';

export const MINIAPP_UI_DEFAULTS = {
  header: {
    logo: '/assets/logo-mj-mercadinho.png'
  },
  theme: {
    primary: '#10853f',
    primarySoft: '#ddf7e8',
    bg: '#f5f7f6',
    card: '#ffffff',
    text: '#132017',
    muted: '#66736a',
    border: '#e2ebe6',
    heroFrom: '#dff7e9',
    heroTo: '#f5f7f6'
  },
  splash: {
    logo: '/assets/logo-mj-mercadinho.png',
    mode: 'logo',
    mediaUrl: '',
    animation: 'fade',
    background: '#10853f',
    gradientFrom: '#22c55e',
    gradientTo: '#087333',
    durationMs: 5000
  },
  bannerCarousel: {
    autoplay: true,
    intervalMs: 5000,
    animation: 'slide'
  },
  banners: [
    {
      id: 'ofertas-mercadinho',
      title: 'Ofertas para o seu mercado',
      subtitle: 'Produtos por peso, ofertas e itens essenciais com entrega rápida.',
      eyebrow: 'Mercadinho M&J',
      image: '',
      emoji: '🎁',
      imageOnly: false,
      buttonText: 'Ver produtos',
      targetType: 'page',
      targetValue: 'home',
      active: true,
      order: 0
    }
  ]
};

const BANNER_TARGETS = new Set(['page', 'section', 'product', 'search', 'url', 'none']);
const BANNER_PAGES = new Set(['home', 'categories', 'products', 'cart', 'orders', 'tracking', 'loyalty', 'profile']);
const BANNER_ANIMATIONS = new Set(['slide', 'fade', 'none']);

function clampIntervalMs(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return MINIAPP_UI_DEFAULTS.bannerCarousel.intervalMs;
  return Math.max(1500, Math.min(60000, Math.round(parsed)));
}

function cleanText(value, fallback = '', max = 180) {
  return String(value ?? fallback ?? '').replace(/[\u0000-\u001f<>`]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizeBannerTarget(type, value) {
  if (type === 'url') return /^https?:\/\//i.test(String(value || '').trim()) ? String(value || '').trim() : '';
  if (type === 'page') return BANNER_PAGES.has(String(value || '').trim()) ? String(value || '').trim() : 'home';
  return cleanText(value, '', 300);
}

function normalizeBanner(banner = {}, index = 0) {
  const targetTypeRaw = String(banner.targetType || banner.tipoDestino || banner.destinoTipo || 'page').trim().toLowerCase();
  const targetType = BANNER_TARGETS.has(targetTypeRaw) ? targetTypeRaw : 'page';
  return {
    id: cleanText(banner.id || `banner-${index + 1}`, `banner-${index + 1}`, 80).replace(/[^a-z0-9_-]/gi, '-') || `banner-${index + 1}`,
    title: cleanText(banner.title || banner.titulo, MINIAPP_UI_DEFAULTS.banners[0].title, 90),
    subtitle: cleanText(banner.subtitle || banner.subtitulo || banner.description || banner.descricao, '', 180),
    eyebrow: cleanText(banner.eyebrow || banner.chamada || banner.selo, 'Mercadinho M&J', 60),
    image: cleanText(banner.image || banner.imagem || banner.mediaUrl || banner.media_url, '', 300),
    emoji: cleanText(banner.emoji || '🎁', '🎁', 12),
    imageOnly: banner.imageOnly === true || banner.imagemInteira === true || banner.imagem_inteira === true,
    buttonText: cleanText(banner.buttonText || banner.textoBotao || banner.botao || 'Abrir', 'Abrir', 36),
    targetType,
    targetValue: normalizeBannerTarget(targetType, banner.targetValue || banner.valorDestino || banner.destino || ''),
    active: banner.active !== false && banner.ativo !== false,
    order: Number.isFinite(Number(banner.order ?? banner.ordem)) ? Number(banner.order ?? banner.ordem) : index
  };
}

export function normalizeMiniAppUi(raw = {}) {
  const cfg = raw && typeof raw === 'object' ? raw : {};
  const bannerCarousel = cfg.bannerCarousel && typeof cfg.bannerCarousel === 'object' ? cfg.bannerCarousel : {};
  const bannerAnimation = String(bannerCarousel.animation || MINIAPP_UI_DEFAULTS.bannerCarousel.animation).trim().toLowerCase();
  const banners = Array.isArray(cfg.banners) && cfg.banners.length ? cfg.banners : MINIAPP_UI_DEFAULTS.banners;
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
    },
    bannerCarousel: {
      autoplay: bannerCarousel.autoplay !== false,
      intervalMs: clampIntervalMs(bannerCarousel.intervalMs),
      animation: BANNER_ANIMATIONS.has(bannerAnimation) ? bannerAnimation : MINIAPP_UI_DEFAULTS.bannerCarousel.animation
    },
    banners: banners.map(normalizeBanner).sort((a, b) => Number(a.order || 0) - Number(b.order || 0) || String(a.title).localeCompare(String(b.title), 'pt-BR'))
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
    pollingMs: 7000,
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
    bannerIndex: 0,
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
