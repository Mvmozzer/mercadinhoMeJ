import { restoreMiniAppUiState } from './storage.js?v=2026.06.26.965';
import { normalizeWholesaleConfig } from './catalog.js?v=2026.06.26.965';

export const MINIAPP_UI_DEFAULTS = {
  header: {
    logo: '/assets/logo-mj-mercadinho.png',
    logoEnabled: true,
    greetingEnabled: true,
    titleEnabled: true,
    greetingText: '',
    titleText: 'Mercadinho M&J'
  },
  theme: {
    primary: '#006CFF',
    primarySoft: '#EAF3FF',
    bg: '#F5F8FC',
    card: '#ffffff',
    text: '#142033',
    muted: '#60718A',
    border: '#D9E2EF',
    heroFrom: '#006CFF',
    heroTo: '#087BFF',
    buttonGradientFrom: '#006CFF',
    buttonGradientTo: '#0049B8'
  },
  splash: {
    logo: '/assets/logo-mj-mercadinho.png',
    mode: 'logo',
    mediaUrl: '',
    animation: 'fade',
    background: '#006CFF',
    gradientFrom: '#087BFF',
    gradientTo: '#0049B8',
    durationMs: 5000
  },
  bannerCarousel: {
    autoplay: true,
    intervalMs: 5000,
    animation: 'slide'
  },
  sectionsMenu: {
    enabled: true
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

function firstBoolean(values = [], fallback = true) {
  const value = values.find(item => typeof item === 'boolean');
  return typeof value === 'boolean' ? value : fallback === true;
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
  const header = cfg.header && typeof cfg.header === 'object' ? cfg.header : {};
  const bannerCarousel = cfg.bannerCarousel && typeof cfg.bannerCarousel === 'object' ? cfg.bannerCarousel : {};
  const bannerAnimation = String(bannerCarousel.animation || MINIAPP_UI_DEFAULTS.bannerCarousel.animation).trim().toLowerCase();
  const banners = Array.isArray(cfg.banners) && cfg.banners.length ? cfg.banners : MINIAPP_UI_DEFAULTS.banners;
  const sectionsMenuEnabled = [
    cfg.sectionsMenu?.enabled,
    cfg.sections_menu?.enabled,
    cfg.mostrarMenuSecoes,
    cfg.showSectionsMenu
  ].find(value => typeof value === 'boolean');
  return {
    header: {
      ...header,
      logo: String(header.logo || '').trim() || MINIAPP_UI_DEFAULTS.header.logo,
      logoEnabled: firstBoolean(
        [header.logoEnabled, header.showLogo, header.mostrarLogo, header.iconeAtivo],
        MINIAPP_UI_DEFAULTS.header.logoEnabled
      ),
      greetingEnabled: firstBoolean(
        [header.greetingEnabled, header.showGreeting, header.mostrarSaudacao, header.saudacaoAtiva],
        MINIAPP_UI_DEFAULTS.header.greetingEnabled
      ),
      titleEnabled: firstBoolean(
        [header.titleEnabled, header.showTitle, header.mostrarTitulo, header.tituloAtivo],
        MINIAPP_UI_DEFAULTS.header.titleEnabled
      ),
      greetingText: cleanText(
        header.greetingText || header.saudacao || header.fraseSaudacao,
        MINIAPP_UI_DEFAULTS.header.greetingText,
        90
      ),
      titleText: cleanText(
        header.titleText || header.titulo || header.fraseTitulo,
        MINIAPP_UI_DEFAULTS.header.titleText,
        90
      )
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
    sectionsMenu: {
      enabled: sectionsMenuEnabled === undefined
        ? MINIAPP_UI_DEFAULTS.sectionsMenu.enabled
        : sectionsMenuEnabled === true
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
    telegramId: '',
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
    wholesale: normalizeWholesaleConfig(saved.wholesale || saved.atacado || {}),
    atacado: normalizeWholesaleConfig(saved.wholesale || saved.atacado || {}),
    wholesaleCelebrated: {},
    orders: [],
    pix: null,
    pedidoAtual: null,
    checkoutMessage: '',
    selectedDeliveryMode: 'retirada',
    bannerIndex: 0,
    miniappUi: normalizeMiniAppUi(saved.miniappUi || saved.miniappui || {})
  };
}

function cleanTelegramId(value) {
  return String(value ?? '').trim();
}

function firstOrderTelegramId(snapshot = {}) {
  const orders = Array.isArray(snapshot.pedidos)
    ? snapshot.pedidos
    : Array.isArray(snapshot.pedidosAtivos)
      ? snapshot.pedidosAtivos
      : [];
  for (const order of orders) {
    const id = cleanTelegramId(order?.telegramId || order?.telegram_id || order?.chatId || order?.cliente?.chatId);
    if (id) return id;
  }
  return '';
}

function snapshotTelegramId(snapshot = {}) {
  return cleanTelegramId(
    snapshot.telegramId ||
    snapshot.telegram_id ||
    snapshot.chatId ||
    snapshot.cliente?.telegramId ||
    snapshot.cliente?.telegram_id ||
    snapshot.cliente?.chatId ||
    snapshot.programa?.telegramId ||
    snapshot.programa?.telegram_id ||
    snapshot.programa?.chatId ||
    firstOrderTelegramId(snapshot)
  );
}

function currentTelegramId(state = {}) {
  return cleanTelegramId(
    state.telegramId ||
    state.cliente?.telegramId ||
    state.cliente?.telegram_id ||
    state.cliente?.chatId ||
    globalThis.window?.Telegram?.WebApp?.initDataUnsafe?.user?.id
  );
}

function hasPersonalSnapshot(snapshot = {}) {
  return Boolean(snapshot.cliente || snapshot.programa || Array.isArray(snapshot.pedidos) || Array.isArray(snapshot.pedidosAtivos));
}

export function isPersonalSnapshotForCurrentSession(state = {}, snapshot = {}) {
  if (!hasPersonalSnapshot(snapshot)) return true;
  const currentId = currentTelegramId(state);
  const incomingId = snapshotTelegramId(snapshot);
  return Boolean(currentId && incomingId && currentId === incomingId);
}

export function applySnapshot(state, snapshot = {}) {
  const canApplyPersonal = isPersonalSnapshotForCurrentSession(state, snapshot);
  if (canApplyPersonal && snapshot.cliente) state.cliente = { ...state.cliente, ...snapshot.cliente };
  if (canApplyPersonal && Array.isArray(snapshot.pedidos)) state.orders = snapshot.pedidos;
  if (snapshot.loja) state.store = { ...state.store, ...snapshot.loja };
  if (canApplyPersonal && snapshot.programa) state.loyalty = { ...state.loyalty, ...snapshot.programa };
  if (snapshot.miniappUi) state.miniappUi = normalizeMiniAppUi(snapshot.miniappUi);
  if (snapshot.atacado || snapshot.wholesale) {
    state.wholesale = normalizeWholesaleConfig(snapshot.atacado || snapshot.wholesale);
    state.atacado = state.wholesale;
  }
}

export function reopenStateFromUrl() {
  const params = new URLSearchParams(location.search);
  return params.get('mj_state') || '';
}
