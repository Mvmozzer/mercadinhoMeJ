const WEIGHTED_RENDER_MARKERS = [
  'Produto vendido por peso. O valor final pode mudar apos a pesagem na loja.',
  'data-action="set-weight"',
  'function productBadges'
];
const STORE_STATUS_LABELS = ['Pedidos pausados', 'Loja fechada.'];

const RUNTIME_LOGO_BUILD = String(globalThis?.__MJ_LOGO_BUILD || '').trim();
const MINIAPP_UI_DEFAULTS = {
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
function resolveBuildFromHtml() {
  const styles = globalThis.document?.getElementById?.('mainStylesheet');
  const href = String(styles?.getAttribute?.('href') || '');
  const byHref = href.match(/[?&]v=([^&]+)/)?.[1];
  const byQuery = globalThis.location?.searchParams?.get?.('v');
  return String(byHref || byQuery || '').trim();
}

import { cartCount, cartItems, cartQty, cartTotal, changeQty, clearCart } from './cart.js?v=2026.06.22.322';
import { emojiForSection, filterProducts, looksLikeSectionEmoji, productBadges } from './catalog.js?v=2026.06.22.322';
import { telegramHandoff } from './checkout.js?v=2026.06.22.322';
import { sendMiniAppEvent, syncCart } from './api.js?v=2026.06.22.322';
import { escapeHtml, greetingFor, money } from './utils.js?v=2026.06.22.322';
import { persistMiniAppUiState } from './storage.js?v=2026.06.22.322';
import { updateMainButton } from './telegram.js?v=2026.06.22.322';
import { loadTracking } from './tracking.js?v=2026.06.22.322';

const LOGO_ASSET_URL = new URL('../assets/logo-mj-mercadinho.png', import.meta.url).href;
const SECTION_MENU_IMAGE_ASSETS = {
  ofertas: '../assets/secoes/ofertas.png',
  hortifruti: '../assets/secoes/hortifruti.png',
  padaria: '../assets/secoes/padaria.png',
  frios_laticinios: '../assets/secoes/frios_laticinios.png',
  frios_e_laticinios: '../assets/secoes/frios_laticinios.png',
  laticinios: '../assets/secoes/frios_laticinios.png',
  ovos: '../assets/secoes/ovos.png',
  acougue: '../assets/secoes/acougue.png',
  açougue: '../assets/secoes/acougue.png',
  peixaria: '../assets/secoes/peixaria.png',
  congelados: '../assets/secoes/congelados.png',
  mercearia: '../assets/secoes/mercearia.png',
  cafe_matinais: '../assets/secoes/cafe_matinais.png',
  cafe_e_matinais: '../assets/secoes/cafe_matinais.png',
  cafe_da_manha: '../assets/secoes/cafe_matinais.png',
  higiene: '../assets/secoes/higiene.png',
  limpeza: '../assets/secoes/limpeza.png',
  descartaveis: '../assets/secoes/descartaveis.png',
  biscoitos: '../assets/secoes/biscoitos.png',
  doces: '../assets/secoes/doces.png'
};

function clampMs(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1000, Math.round(parsed));
}

function clampBannerIntervalMs(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return MINIAPP_UI_DEFAULTS.bannerCarousel.intervalMs;
  return Math.max(1500, Math.min(60000, Math.round(parsed)));
}

function cleanBannerText(value, fallback = '', max = 180) {
  return String(value ?? fallback ?? '').replace(/[\u0000-\u001f<>`]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function firstBoolean(values = [], fallback = true) {
  const value = values.find(item => typeof item === 'boolean');
  return typeof value === 'boolean' ? value : fallback === true;
}

function normalizeBannerTarget(type, value) {
  const raw = cleanBannerText(value, '', 300);
  if (type === 'url') return /^https?:\/\//i.test(raw) ? raw : '';
  if (type === 'page') return BANNER_PAGES.has(raw) ? raw : 'home';
  return raw;
}

function normalizeBanner(raw = {}, index = 0) {
  const targetTypeRaw = String(raw.targetType || raw.tipoDestino || raw.destinoTipo || 'page').trim().toLowerCase();
  const targetType = BANNER_TARGETS.has(targetTypeRaw) ? targetTypeRaw : 'page';
  return {
    id: cleanBannerText(raw.id || `banner-${index + 1}`, `banner-${index + 1}`, 80).replace(/[^a-z0-9_-]/gi, '-') || `banner-${index + 1}`,
    title: cleanBannerText(raw.title || raw.titulo, MINIAPP_UI_DEFAULTS.banners[0].title, 90),
    subtitle: cleanBannerText(raw.subtitle || raw.subtitulo || raw.description || raw.descricao, '', 180),
    eyebrow: cleanBannerText(raw.eyebrow || raw.chamada || raw.selo, 'Mercadinho M&J', 60),
    image: cleanBannerText(raw.image || raw.imagem || raw.mediaUrl || raw.media_url, '', 300),
    emoji: cleanBannerText(raw.emoji || '🎁', '🎁', 12),
    imageOnly: raw.imageOnly === true || raw.imagemInteira === true || raw.imagem_inteira === true,
    buttonText: cleanBannerText(raw.buttonText || raw.textoBotao || raw.botao || 'Abrir', 'Abrir', 36),
    targetType,
    targetValue: normalizeBannerTarget(targetType, raw.targetValue || raw.valorDestino || raw.destino || ''),
    active: raw.active !== false && raw.ativo !== false,
    order: Number.isFinite(Number(raw.order ?? raw.ordem)) ? Number(raw.order ?? raw.ordem) : index
  };
}

function normalizeMiniAppUi(raw = {}) {
  const cfg = raw && typeof raw === 'object' ? raw : {};
  const header = cfg.header && typeof cfg.header === 'object' ? cfg.header : {};
  const animation = String(cfg.splash?.animation || MINIAPP_UI_DEFAULTS.splash.animation).toLowerCase();
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
      logo: String(header.logo || MINIAPP_UI_DEFAULTS.header.logo).trim() || MINIAPP_UI_DEFAULTS.header.logo,
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
      greetingText: cleanBannerText(
        header.greetingText || header.saudacao || header.fraseSaudacao,
        MINIAPP_UI_DEFAULTS.header.greetingText,
        90
      ),
      titleText: cleanBannerText(
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
      ...(cfg.splash || {}),
      logo: String(cfg.splash?.logo || cfg.header?.logo || MINIAPP_UI_DEFAULTS.splash.logo).trim(),
      animation: ['fade', 'zoom', 'slide-up', 'pulse'].includes(animation) ? animation : MINIAPP_UI_DEFAULTS.splash.animation,
      durationMs: clampMs(cfg.splash?.durationMs, MINIAPP_UI_DEFAULTS.splash.durationMs)
    },
    bannerCarousel: {
      autoplay: bannerCarousel.autoplay !== false,
      intervalMs: clampBannerIntervalMs(bannerCarousel.intervalMs),
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

function resolveAssetUrl(value, fallback) {
  const raw = String(value || '').trim();
  const fallbackValue = String(fallback || LOGO_ASSET_URL).trim() || LOGO_ASSET_URL;
  if (!raw) return fallbackValue;
  if (/^(https?:\/\/|data:|blob:)/i.test(raw)) return raw;
  if (raw.startsWith('/assets/')) {
    return new URL(raw.replace(/^\//, ''), new URL('../', import.meta.url)).href;
  }
  if (raw.startsWith('/miniapp/assets/')) {
    return new URL(raw.replace(/^\/miniapp\//, ''), new URL('../', import.meta.url)).href;
  }
  if (raw.startsWith('/')) return raw;
  try {
    return new URL(raw, new URL('../', import.meta.url)).href;
  } catch (_) {
    return raw;
  }
}

function appendBuildTag(rawUrl, state = {}) {
  const webBuild = String(state.webBuild || RUNTIME_LOGO_BUILD || resolveBuildFromHtml() || '').trim();
  if (!webBuild) return rawUrl;
  try {
    const url = new URL(rawUrl);
    url.searchParams.set('v', webBuild);
    return url.toString();
  } catch (_) {
    return rawUrl;
  }
}

function applyThemeVariables(uiState = {}) {
  const root = document.documentElement;
  const theme = uiState.theme || {};
  const splash = uiState.splash || {};
  document.body.dataset.miniappTheme = 'mj_blue';
  root.style.setProperty('--mj-primary', theme.primary || MINIAPP_UI_DEFAULTS.theme.primary);
  root.style.setProperty('--mj-primary-soft', theme.primarySoft || MINIAPP_UI_DEFAULTS.theme.primarySoft);
  root.style.setProperty('--mj-bg', theme.bg || MINIAPP_UI_DEFAULTS.theme.bg);
  root.style.setProperty('--mj-card', theme.card || MINIAPP_UI_DEFAULTS.theme.card);
  root.style.setProperty('--mj-text', theme.text || MINIAPP_UI_DEFAULTS.theme.text);
  root.style.setProperty('--mj-muted', theme.muted || MINIAPP_UI_DEFAULTS.theme.muted);
  root.style.setProperty('--mj-border', theme.border || MINIAPP_UI_DEFAULTS.theme.border);
  root.style.setProperty('--mj-header-gradient-from', theme.heroFrom || MINIAPP_UI_DEFAULTS.theme.heroFrom);
  root.style.setProperty('--mj-header-gradient-to', theme.heroTo || MINIAPP_UI_DEFAULTS.theme.heroTo);
  root.style.setProperty('--mj-button-gradient-from', theme.buttonGradientFrom || MINIAPP_UI_DEFAULTS.theme.buttonGradientFrom);
  root.style.setProperty('--mj-button-gradient-to', theme.buttonGradientTo || MINIAPP_UI_DEFAULTS.theme.buttonGradientTo);
  root.style.setProperty('--mj-splash-background', splash.background || MINIAPP_UI_DEFAULTS.splash.background);
  root.style.setProperty('--mj-splash-gradient-from', splash.gradientFrom || MINIAPP_UI_DEFAULTS.splash.gradientFrom);
  root.style.setProperty('--mj-splash-gradient-to', splash.gradientTo || MINIAPP_UI_DEFAULTS.splash.gradientTo);
}

function formatMoney(value = 0) {
  return money(Number(value || 0));
}

function customerPoints(state = {}) {
  return Number(
    state.loyalty?.saldoPontos ??
    state.loyalty?.pontosDisponiveis ??
    0
  ) || 0;
}

function loyaltyPointsAvailable(state = {}) {
  const value = state.loyalty?.pontosDisponiveis ??
    state.loyalty?.saldoPontos ??
    state.loyalty?.pontos ??
    state.cliente?.pontosFidelidade ??
    state.cliente?.saldoFidelidade ??
    0;
  const points = Math.floor(Number(value) || 0);
  return Math.max(0, points);
}

function loyaltyChallenges(state = {}) {
  const items = state.loyalty?.desafios ||
    state.loyalty?.challenges ||
    state.loyalty?.programa?.desafios ||
    [];
  return Array.isArray(items) ? items : [];
}

function customerName(state = {}) {
  const nameFromClient =
    state.cliente?.nome ||
    state.cliente?.first_name ||
    window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name ||
    'cliente';
  return String(nameFromClient || 'cliente').trim() || 'cliente';
}

function logoSrc(state = {}) {
  const ui = normalizeMiniAppUi(state.miniappUi || state.miniappui || {});
  const resolved = resolveAssetUrl(ui.header?.logo || LOGO_ASSET_URL, LOGO_ASSET_URL);
  return appendBuildTag(resolved, state);
}

function customerGreetingPrefix(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'Bom dia';
  if (h >= 12 && h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function customerGreetingLine(state = {}) {
  return `${customerGreetingPrefix(new Date())}, ${customerName(state)}`;
}

function formatHeaderText(template = '', fallback = '', values = {}) {
  const raw = String(template || fallback || '').trim();
  return raw
    .replace(/\{saudacao\}/gi, values.greeting || '')
    .replace(/\{nome\}/gi, values.name || '')
    .replace(/\{titulo\}/gi, values.title || '')
    .replace(/\{loja\}/gi, values.store || values.title || '');
}

function customerTelegramId(state = {}) {
  return String(
    state.cliente?.telegramId ||
    state.cliente?.telegram_id ||
    state.cliente?.chatId ||
    window.Telegram?.WebApp?.initDataUnsafe?.user?.id ||
    ''
  ).trim();
}

function customerReferralCode(state = {}) {
  return String(
    state.cliente?.codigoIndicacao ||
    state.cliente?.codigo_indicacao ||
    state.loyalty?.codigoIndicacao ||
    state.loyalty?.codigo_indicacao ||
    ''
  ).trim();
}

function customerAddressSummary(state = {}) {
  const cliente = state.cliente || {};
  const linha = [
    cliente.rua,
    cliente.numero,
    cliente.bairro,
    cliente.cidade,
    cliente.estado
  ].filter(Boolean).join(', ');
  return String(cliente.endereco || linha || '').trim();
}

function normalizeStoreStatus(state = {}) {
  const status = String(state.store?.status || '').toLowerCase();
  const isPaused = status === 'pausada';
  const isClosed = status === 'fechada' || status === 'fechado' || state.store?.aceitaPedidos === false;
  return {
    className: isPaused ? 'paused' : (isClosed ? 'closed' : 'open'),
    text: isClosed ? 'Loja fechada.' : (state.store?.mensagem || (isPaused ? 'Pedidos pausados' : 'Loja aberta. Pode fazer seu pedido.'))
  };
}

function productThumb(product) {
  const fallback = `<span class="product-thumb-fallback" aria-hidden="true">${escapeHtml((product?.name || 'P').slice(0, 1).toUpperCase())}</span>`;
  if (!product?.image) {
    return fallback;
  }
  return `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name || 'Produto')}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`;
}

function productPriceBlock(product = {}) {
  const precoAtual = Number(product.price || 0);
  const precoOriginal = Number(product.normalPrice || product.preco_normal || product.price || 0);
  const isPromocao = (product.promocao === true || product.promocao_ativa === true || product.promocaoAtiva === true)
    && Number(precoAtual) > 0 && Number(precoOriginal) > Number(precoAtual);
  if (!isPromocao) {
    return `<strong>${formatMoney(precoAtual)}</strong>`;
  }
  return `<strong>${formatMoney(precoAtual)}</strong><small>${formatMoney(precoOriginal)}</small>`;
}

function svgIcon(name, size = 20) {
  const attrs = `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;
  const icons = {
    store: '<path d="m3 9 1.2-5h15.6L21 9"/><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/><path d="M9 20v-6h6v6"/><path d="M3 9h18"/><path d="M7 9v3"/><path d="M12 9v3"/><path d="M17 9v3"/>',
    bag: '<path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
    leaf: '<path d="M5 21c8 0 14-6 14-14V5h-2C9 5 3 11 3 19v2h2Z"/><path d="M3 21c4-6 8-10 14-14"/>',
    bread: '<path d="M4 13a6 6 0 0 1 12 0v7H4v-7Z"/><path d="M16 13a4 4 0 0 1 4 4v3h-4"/><path d="M8 12v3"/><path d="M12 11v4"/>',
    cup: '<path d="M5 8h11v7a5 5 0 0 1-10 0V8Z"/><path d="M16 10h2a3 3 0 0 1 0 6h-2"/><path d="M6 3h10"/>',
    package: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5"/><path d="M12 12v9"/>',
    spray: '<path d="M9 3h6v4H9z"/><path d="M10 7h4l1 4v10H9V11l1-4Z"/><path d="M9 13h6"/>',
    home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
    clipboard: '<rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 4.5h6"/><path d="M9 10h6"/><path d="M9 14h5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    arrowLeft: '<path d="m15 18-6-6 6-6"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/>',
    receipt: '<path d="M5 3v18l2-1 2 1 2-1 2 1 2-1 2 1V3Z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/>',
    check: '<path d="m5 12 4 4L19 6"/>'
  };
  return `<svg ${attrs}>${icons[name] || icons.package}</svg>`;
}

function sectionEmoji(section = {}) {
  const configured = String(section.emoji || section.icon || '').trim();
  if (looksLikeSectionEmoji(configured)) return configured;
  return emojiForSection(section.name || section.nome || section.id || '');
}

function sectionImageKey(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'e')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function sectionImageSrc(section = {}) {
  const keys = [
    section.id,
    section.slug,
    section.name,
    section.nome,
    section.section,
    section.secao
  ].map(sectionImageKey).filter(Boolean);
  const match = keys.find(key => SECTION_MENU_IMAGE_ASSETS[key]);
  if (!match) return '';
  return resolveAssetUrl(SECTION_MENU_IMAGE_ASSETS[match], '');
}

export function createRenderer(state) {
  const root = document.getElementById('miniapp-root') || document.body;
  const splashStartedAt = Date.now();

  function splashMedia(ui) {
    const mode = String(ui.splash?.mode || 'logo').toLowerCase();
    const mediaUrl = String(ui.splash?.mediaUrl || '').trim();
    const logo = appendBuildTag(resolveAssetUrl(ui.splash?.logo || logoSrc(state), logoSrc(state)), state);
    const commonClass = 'miniapp-splash-media';
    if ((mode === 'photo' || mode === 'gif') && mediaUrl) {
      return `<img class="${commonClass}" src="${escapeHtml(resolveAssetUrl(mediaUrl, logo))}" alt="Splash">`;
    }
    if (mode === 'video' && mediaUrl) {
      return `<video class="${commonClass}" src="${escapeHtml(resolveAssetUrl(mediaUrl, logo))}" autoplay muted loop playsinline></video>`;
    }
    return `<img class="${commonClass}" src="${escapeHtml(logo)}" alt="Mercadinho M&J">`;
  }

  function renderSplash() {
    const ui = normalizeMiniAppUi(state.miniappUi || state.miniappui || {});
    const splashDuration = clampMs(ui.splash?.durationMs, MINIAPP_UI_DEFAULTS.splash.durationMs);
    const splashAnimation = String(ui.splash?.animation || MINIAPP_UI_DEFAULTS.splash.animation).toLowerCase();
    if (Date.now() - splashStartedAt > splashDuration + 400) return '';
    return `
      <section class="miniapp-splash" id="miniappSplash" data-splash-animation="${escapeHtml(splashAnimation)}" aria-label="Inicializando Mercadinho M&J">
        ${splashMedia(ui)}
      </section>
    `;
  }

  function navigateTo(page, options = {}) {
    state.previousPage = state.page || 'home';
    state.page = page || 'home';
    state.sectionsMenuOpen = false;
    if (options.sectionId !== undefined) state.sectionId = options.sectionId;
    if (options.query !== undefined) state.query = options.query;
    persistMiniAppUiState(state);
    render();
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  function activeBanners(ui = normalizeMiniAppUi(state.miniappUi || state.miniappui || {})) {
    const banners = (ui.banners || []).filter(item => item.active !== false);
    return banners.length ? banners : MINIAPP_UI_DEFAULTS.banners;
  }

  function sectionsMenuEnabled(ui = normalizeMiniAppUi(state.miniappUi || state.miniappui || {})) {
    return ui.sectionsMenu?.enabled === true;
  }

  function bannerTargetSectionId(value = '') {
    const raw = String(value || '').trim();
    const section = state.sections.find(item =>
      String(item.id) === raw ||
      String(item.name || item.nome || '') === raw
    );
    return section?.id || raw;
  }

  function bannerTargetProductId(value = '') {
    const raw = String(value || '').trim();
    const product = state.products.find(item =>
      String(item.id) === raw ||
      String(item.produto_id || '') === raw ||
      String(item.name || item.nome || '') === raw ||
      String(item.sku || '') === raw
    );
    return product?.id || raw;
  }

  function runBannerAction(button) {
    const type = String(button?.dataset?.bannerAction || 'page').trim();
    const value = String(button?.dataset?.bannerTarget || '').trim();
    sendMiniAppEvent(state, 'banner_click', { type, value });
    if (type === 'section') {
      navigateTo('products', { sectionId: bannerTargetSectionId(value), query: '' });
      return;
    }
    if (type === 'product') {
      state.productId = bannerTargetProductId(value);
      navigateTo('product');
      return;
    }
    if (type === 'search') {
      navigateTo('home', { query: value });
      return;
    }
    if (type === 'url' && /^https?:\/\//i.test(value)) {
      window.Telegram?.WebApp?.openLink?.(value) || window.open(value, '_blank', 'noopener');
      return;
    }
    if (BANNER_PAGES.has(value || type)) {
      navigateTo(value || type);
    }
  }

  function renderBannerDots(banners = [], index = 0, extraClass = '') {
    if (banners.length <= 1) return '';
    const classes = ['miniapp-banner-dots', extraClass].filter(Boolean).join(' ');
    return `<div class="${escapeHtml(classes)}">${banners.map((item, dotIndex) => `<button class="${dotIndex === index ? 'active' : ''}" data-banner-jump="${dotIndex}" aria-label="Abrir banner ${dotIndex + 1}"></button>`).join('')}</div>`;
  }

  function renderBannerCarousel(ui = normalizeMiniAppUi(state.miniappUi || state.miniappui || {})) {
    const banners = activeBanners(ui);
    const index = Math.abs(Number(state.bannerIndex || 0)) % banners.length;
    const banner = banners[index] || banners[0];
    const image = banner.image ? resolveAssetUrl(banner.image, '') : '';
    const animation = BANNER_ANIMATIONS.has(String(ui.bannerCarousel?.animation || '').toLowerCase())
      ? String(ui.bannerCarousel.animation).toLowerCase()
      : MINIAPP_UI_DEFAULTS.bannerCarousel.animation;
    const imageOnly = Boolean(image && banner.imageOnly === true);
    const hasAction = banner.targetType !== 'none' && (banner.targetType === 'page' || banner.targetValue || banner.targetType === 'search');
    const actionAttrs = hasAction
      ? `data-banner-action="${escapeHtml(banner.targetType)}" data-banner-target="${escapeHtml(banner.targetValue)}"`
      : '';
    if (imageOnly) {
      const imageMarkup = `<img class="miniapp-banner-full-image" src="${escapeHtml(image)}" alt="${escapeHtml(banner.title || 'Banner')}" loading="lazy" referrerpolicy="no-referrer">`;
      return `
        <section class="miniapp-banner-carousel banner-animation-${escapeHtml(animation)}" id="promoBanners" data-banner-count="${banners.length}" aria-label="Banners promocionais">
          <article class="miniapp-banner-slide miniapp-banner-image-only" data-banner-id="${escapeHtml(banner.id)}">
            ${hasAction ? `<button class="miniapp-banner-image-button" ${actionAttrs} aria-label="${escapeHtml(banner.buttonText || banner.title || 'Abrir banner')}">${imageMarkup}</button>` : imageMarkup}
            ${renderBannerDots(banners, index, 'miniapp-banner-dots-overlay')}
          </article>
        </section>
      `;
    }
    return `
      <section class="miniapp-banner-carousel banner-animation-${escapeHtml(animation)}" id="promoBanners" data-banner-count="${banners.length}" aria-label="Banners promocionais">
        <article class="miniapp-banner-slide" data-banner-id="${escapeHtml(banner.id)}">
          <div class="miniapp-banner-copy">
            <small>${escapeHtml(banner.eyebrow || 'Mercadinho M&J')}</small>
            <h2>${escapeHtml(banner.title || 'Ofertas de hoje')}</h2>
            <p>${escapeHtml(banner.subtitle || '')}</p>
            ${hasAction ? `<button class="miniapp-banner-cta" ${actionAttrs}>${escapeHtml(banner.buttonText || 'Abrir')}</button>` : ''}
          </div>
          ${image ? `<img class="miniapp-banner-image" src="${escapeHtml(image)}" alt="${escapeHtml(banner.title || 'Banner')}" loading="lazy" referrerpolicy="no-referrer">` : `<span class="miniapp-banner-emoji">${escapeHtml(banner.emoji || '🎁')}</span>`}
        </article>
        ${renderBannerDots(banners, index)}
      </section>
    `;
  }

  function updateBannerCarouselOnly(ui = normalizeMiniAppUi(state.miniappUi || state.miniappui || {})) {
    const current = root.querySelector('#promoBanners');
    if (!current || state.page !== 'home') return;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderBannerCarousel(ui).trim();
    const next = wrapper.firstElementChild;
    if (!next) return;
    current.replaceWith(next);
    bindBannerControls(next);
    scheduleBannerAutoSlide(ui);
  }

  function scheduleBannerAutoSlide(ui = normalizeMiniAppUi(state.miniappUi || state.miniappui || {})) {
    if (state.__bannerAutoTimer) window.clearTimeout(state.__bannerAutoTimer);
    state.__bannerAutoTimer = null;
    const banners = activeBanners(ui);
    if (state.page !== 'home' || banners.length < 2 || ui.bannerCarousel?.autoplay === false) return;
    state.__bannerAutoTimer = window.setTimeout(() => {
      const nextUi = normalizeMiniAppUi(state.miniappUi || state.miniappui || {});
      const nextBanners = activeBanners(nextUi);
      state.bannerIndex = (Number(state.bannerIndex || 0) + 1) % nextBanners.length;
      updateBannerCarouselOnly(nextUi);
    }, clampBannerIntervalMs(ui.bannerCarousel?.intervalMs));
  }

  function setMainButton() {
    const webApp = window.Telegram?.WebApp;
    updateMainButton(webApp, {
      count: cartCount(state),
      totalText: formatMoney(cartTotal(state)),
      sending: Boolean(state.sending),
      checkoutStep: 'cart',
      currentPage: state.page,
      enabled: true,
      hasPix: Boolean(state.pix)
    });
    const button = webApp?.MainButton;
    if (button?.onClick && !button.__mjFinishInTelegramBound) {
      button.onClick(() => {
        if (state.page === 'cart' && cartCount(state)) finishInTelegram();
      });
      button.__mjFinishInTelegramBound = true;
    }
  }

  function hasTelegramMainButton() {
    return Boolean(globalThis?.Telegram?.WebApp?.MainButton || globalThis?.window?.Telegram?.WebApp?.MainButton);
  }

  function renderCustomerHeader(title = '') {
    const ui = normalizeMiniAppUi(state.miniappUi || state.miniappui || {});
    const header = ui.header || {};
    const name = customerName(state);
    const greeting = customerGreetingPrefix(new Date());
    const status = normalizeStoreStatus(state);
    const showSectionsMenu = sectionsMenuEnabled() && state.sections.length > 0;
    const headerLogo = logoSrc(state);
    const defaultTitle = 'Mercadinho M&J';
    const explicitTitle = String(title || '').trim();
    const titleText = explicitTitle ? formatHeaderText(explicitTitle, defaultTitle, {
      greeting,
      name,
      title: defaultTitle,
      store: state.store?.nome || defaultTitle
    }) : '';
    const greetingText = header.greetingText
      ? escapeHtml(formatHeaderText(header.greetingText, `${greeting}, ${name}`, {
        greeting,
        name,
        title: titleText || defaultTitle,
        store: state.store?.nome || defaultTitle
      }))
      : `${escapeHtml(greeting)}, <span class="customer-name">${escapeHtml(name)}</span>.`;
    const logoMarkup = header.logoEnabled === false ? '' : `
          <img class="brand-logo" src="${escapeHtml(headerLogo)}" alt="Mercadinho M&J" referrerpolicy="no-referrer" onerror="this.hidden=true">`;
    const greetingMarkup = header.greetingEnabled === false ? '' : `<p class="greeting" id="customerGreeting">${greetingText}</p>`;
    const titleMarkup = title && header.titleEnabled !== false ? `<h1>${escapeHtml(titleText)}</h1>` : '';
    return `
      <header class="market-hero app-header" id="marketHero">
        <div class="hero-top-row">
          ${showSectionsMenu ? `<button class="icon-button menu-button" type="button" data-open-sections aria-label="Abrir menu de secoes">${svgIcon('menu', 22)}</button>` : '<span class="hero-spacer" aria-hidden="true"></span>'}
          <div class="hero-brand-block">
            ${logoMarkup}
            <div class="hero-copy">
              ${greetingMarkup}
              ${titleMarkup}
            </div>
          </div>
          <button class="loyalty-shortcut" type="button" data-page="loyalty" aria-label="Abrir fidelidade. ${loyaltyPointsAvailable(state)} pontos disponiveis">⭐: ${loyaltyPointsAvailable(state)}</button>
        </div>
        <div class="store-status ${status.className}" id="storeStatus"><span class="store-status-dot" aria-hidden="true"></span><span>${escapeHtml(status.text)}</span></div>
      </header>
      ${renderSectionsDrawer()}
    `;
  }

  function searchBox(placeholder = 'Buscar produtos') {
    return `
      <label class="search-box">
        <span aria-hidden="true">${svgIcon('search', 18)}</span>
        <input id="search" type="search" value="${escapeHtml(state.query)}" placeholder="${escapeHtml(placeholder)}">
      </label>
    `;
  }

  function badgeColor(value = '') {
    const color = String(value || '').trim();
    return /^#[0-9a-f]{3,8}$/i.test(color) ? color : '';
  }

  function renderProductBadge(badge = {}) {
    const text = String(badge.text || badge.texto || badge.label || badge || '').trim();
    if (!text) return '';
    const color = badgeColor(badge.color || badge.cor);
    const background = badgeColor(badge.background || badge.fundo || badge.bg);
    const style = [color ? `color:${color}` : '', background ? `background:${background}` : ''].filter(Boolean).join(';');
    return `<span class="product-badge"${style ? ` style="${escapeHtml(style)}"` : ''}>${escapeHtml(text)}</span>`;
  }

  function renderProductPhotoBadge(badge = {}) {
    const text = String(badge.text || badge.texto || badge.label || badge || '').trim();
    if (!text) return '';
    const color = badgeColor(badge.color || badge.cor);
    const background = badgeColor(badge.background || badge.fundo || badge.bg);
    const style = [
      color ? `--badge-color:${color}` : '',
      background ? `--badge-bg:${background}` : ''
    ].filter(Boolean).join(';');
    return `<span class="product-photo-badge"${style ? ` style="${escapeHtml(style)}"` : ''}>${escapeHtml(text)}</span>`;
  }

  function renderProductPointsChip(product = {}) {
    const points = Number(product.points || 0);
    if (!points) return '';
    return `<span class="product-points-chip">+ ${points} ⭐</span>`;
  }

  function renderProductOverlayStack(product = {}, badges = productBadges(product).slice(0, 2)) {
    const items = [
      ...badges.map(renderProductPhotoBadge),
      renderProductPointsChip(product)
    ].filter(Boolean);
    return items.length ? `<div class="product-overlay-stack">${items.join('')}</div>` : '';
  }

  function cleanProductDetail(value = '') {
    const text = String(value ?? '').trim();
    if (!text || text === '0') return '';
    return text;
  }

  function renderProductDetailInfo(product = {}, sectionName = '') {
    const unit = cleanProductDetail(product.unit || product.unidadeVenda || product.unidadeMedida || product.tamanho);
    const stock = Number(product.stock ?? product.estoque_pronta_entrega ?? product.estoque_atual ?? product.estoque ?? 0);
    const points = Number(product.points || product.product_point_offer_points || product.productPointOffer?.points || 0);
    const group = cleanProductDetail(product.grupoNome || product.grupo_nome || product.nome_principal || product.produtoPaiNome);
    const code = cleanProductDetail(product.codigoInterno || product.codigo_interno || product.sku || product.codigoBarras || product.codigo_barras);
    const observation = cleanProductDetail(product.productObservation || product.observacaoProduto || product.observacao_produto);
    const size = cleanProductDetail(product.tamanho || product.peso);
    const flavor = cleanProductDetail(product.sabor);
    const saleMode = cleanProductDetail(product.modoVenda || product.saleMode);
    const validity = cleanProductDetail(product.validade);
    const stockText = stock > 0
      ? `${stock} ${unit || 'un'} disponiveis`
      : '';
    const rows = [
      ['Marca', product.marca || product.brand],
      ['Categoria', sectionName || product.section || product.secao],
      ['Grupo', group],
      ['Unidade', unit],
      ['Disponibilidade', stockText],
      ['Pontos', points > 0 ? `Ganhe +${points} pontos` : ''],
      ['Tamanho', size && size !== unit ? size : ''],
      ['Sabor', flavor],
      ['Venda', saleMode && !['unit', 'unidade'].includes(saleMode.toLowerCase()) ? saleMode : ''],
      ['Validade', validity],
      ['Codigo', code],
      ['Observacao', observation]
    ].map(([label, value]) => [label, cleanProductDetail(value)])
      .filter(([, value]) => value);

    if (!rows.length) return '';
    return `
      <div class="product-detail-info" aria-label="Informacoes do produto">
        ${rows.map(([label, value]) => `
          <div>
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
          </div>
        `).join('')}
      </div>
    `;
  }

  function productCard(product) {
    const quantity = cartQty(state, product.id);
    const badges = productBadges(product).slice(0, 2);
    const brand = String(product.marca || product.brand || '').trim();
    const description = String(product.descricao || product.description || product.unit || '').trim();
    const unit = String(product.unit || product.unidade || '').trim() || description || brand || 'un';
    return `
      <article class="product-card mini-product-card" data-product-id="${escapeHtml(product.id)}">
        <div class="product-media-frame product-media">
          <button class="product-image" data-product-open="${escapeHtml(product.id)}" aria-label="Abrir ${escapeHtml(product.name)}">
            ${productThumb(product)}
            ${renderProductOverlayStack(product, badges)}
          </button>
          <div class="product-actions${quantity ? ' product-actions--quantity product-stepper' : ''}">
            ${quantity ? `
              <button data-qty-minus="${escapeHtml(product.id)}" aria-label="Diminuir quantidade"><span class="product-action-symbol" aria-hidden="true">-</span></button>
              <b>${quantity}</b>
              <button class="product-quick-add" data-qty-plus="${escapeHtml(product.id)}" aria-label="Adicionar ao carrinho: ${escapeHtml(product.name)}"><span class="product-action-symbol" aria-hidden="true">+</span></button>
            ` : `
              <button class="add-button product-quick-add" data-qty-plus="${escapeHtml(product.id)}" aria-label="Adicionar ao carrinho: ${escapeHtml(product.name)}">
                <span class="product-action-symbol" aria-hidden="true">+</span>
              </button>
            `}
          </div>
        </div>
        <div class="product-info">
          <h3>${escapeHtml(product.name)}</h3>
          ${brand ? `<span class="product-brand">${escapeHtml(brand)}</span>` : ''}
          ${unit ? `<p class="product-description product-unit">${escapeHtml(unit)}</p>` : ''}
          <div class="product-buy-row${quantity ? ' product-buy-row--quantity' : ''}">
            <div class="product-price-block">${productPriceBlock(product)}</div>
          </div>
        </div>
      </article>
    `;
  }

  function renderSectionMenuIcon(section = {}) {
    const image = sectionImageSrc(section);
    const fallback = sectionEmoji(section);
    if (image) {
      return `
        <span class="section-menu-icon-image" aria-hidden="true">
          <img src="${escapeHtml(image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove();this.nextElementSibling.hidden=false">
          <span hidden>${escapeHtml(fallback)}</span>
        </span>
      `;
    }
    return `<span class="section-menu-icon-fallback" aria-hidden="true">${escapeHtml(fallback)}</span>`;
  }

  function renderDrawerSectionItem(section = {}, active = false) {
    const sectionId = section.id || '';
    return `
      <button class="drawer-section-item${active ? ' active' : ''}" type="button" data-section-open="${escapeHtml(sectionId)}">
        ${renderSectionMenuIcon(section)}
        <span>${escapeHtml(section.name || 'Secao')}</span>
        <small>${(section.products?.length || 0)} itens</small>
      </button>
    `;
  }

  function renderSectionsDrawer() {
    if (!sectionsMenuEnabled()) return '';
    const open = Boolean(state.sectionsMenuOpen);
    return `
      <nav class="section-menu" id="categoryRail" aria-label="Seções" hidden></nav>
      <div class="sections-menu-overlay${open ? ' open' : ''}" data-close-sections ${open ? '' : 'hidden'}>
        <aside class="sections-drawer" id="sectionsDrawer" role="dialog" aria-modal="true" aria-labelledby="sectionsDrawerTitle">
          <div class="sections-drawer-header">
            <div class="drawer-brand-lockup">
              <img class="drawer-logo" src="${escapeHtml(logoSrc(state))}" alt="Mercadinho M&J" referrerpolicy="no-referrer">
              <div>
                <h2 id="sectionsDrawerTitle">Mercadinho M&J</h2>
                <p>Menu de secoes</p>
              </div>
            </div>
            <button class="icon-button" type="button" data-close-sections aria-label="Fechar menu de secoes">${svgIcon('x', 18)}</button>
          </div>
          <div class="sections-drawer-list">
            <button class="drawer-section-item${!state.sectionId ? ' active' : ''}" type="button" data-all-products>
              ${renderSectionMenuIcon({ id: 'todos', name: 'Todos' })}
              <span>Todos</span>
              <small>${state.products.length} itens</small>
            </button>
            ${state.sections.map(section => renderDrawerSectionItem(section, state.sectionId === section.id)).join('')}
          </div>
        </aside>
      </div>
    `;
  }

  function renderSectionMenu() {
    const allCount = state.products.length;
    return `
      <nav class="section-menu" id="categoryRail" aria-label="Seções">
        <button class="${state.page === 'home' && !state.sectionId ? 'active' : ''}" data-all-products>
          ${renderSectionMenuIcon({ id: 'todos', name: 'Todos' })}
          <span>Todos</span>
          <strong>${allCount} itens</strong>
        </button>
        ${state.sections.map(section => `
          <button class="${state.sectionId === section.id ? 'active' : ''}" data-section-open="${escapeHtml(section.id)}">
            ${renderSectionMenuIcon(section)}
            <span>${escapeHtml(section.name)}</span>
            <strong>${(section.products?.length || 0)} itens</strong>
          </button>
        `).join('')}
      </nav>
    `;
  }

  function renderHomeSectionCarousel(section = {}) {
    return `
      <section class="product-section">
        <div class="product-section-header section-title">
          <h2>${escapeHtml(section.name || 'Seção')}</h2>
          <span>${(section.products?.length || 0)} itens</span>
        </div>
        <div class="product-rail" aria-label="${escapeHtml(section.name || 'Seção')}">
          ${section.products?.slice(0, 12).map(productCard).join('') || ''}
        </div>
      </section>
    `;
  }

  function renderSearchResults(products, title = 'Produtos') {
    if (!products.length) {
      return `
        <section class="empty-state">
          <strong>Não encontramos resultados</strong>
          <p>Tente outro termo ou navegue pelas seções.</p>
        </section>
      `;
    }
    return `
      <section class="product-grid-section">
        <div class="product-section-header section-title">
          <h2>${escapeHtml(title)}</h2>
        </div>
        <div class="product-grid">
          ${products.map(productCard).join('')}
        </div>
      </section>
    `;
  }

  function renderHome() {
    const filtered = state.query ? filterProducts(state.products, state.query) : null;
    return `
      ${renderCustomerHeader()}
      <main class="page home-page" data-page="home">
        ${searchBox('Buscar produtos')}
        ${renderBannerCarousel()}
        ${filtered ? renderSearchResults(filtered, 'Resultados da busca') : state.sections.map(renderHomeSectionCarousel).join('')}
      </main>
    `;
  }

  function renderCategories() {
    const query = (state.query || '').trim();
    const sections = query
      ? state.sections.filter(section => section.name.toLowerCase().includes(query.toLowerCase()))
      : state.sections;
    return `
      ${renderCustomerHeader('Categorias')}
      <main class="page categories-page" data-page="categories">
        ${searchBox('Buscar seção')}
        ${sections.length ? `
          <div class="category-list">
            ${sections.map(section => `
              <button class="category-row" data-section-open="${escapeHtml(section.id)}">
                ${renderSectionMenuIcon(section)}
                <strong>${escapeHtml(section.name)}</strong>
                <b>${(section.products?.length || 0)} itens</b>
              </button>
            `).join('')}
          </div>
        ` : `
          <div class="empty-state">
            <strong>Nenhuma seção encontrada</strong>
            <p>Use a busca para filtrar por nome da seção.</p>
          </div>
        `}
      </main>
    `;
  }

  function renderProducts() {
    const section = state.sections.find(item => item.id === state.sectionId) || state.sections[0];
    const products = filterProducts(state.products, state.query, section?.id || '');
    return `
      ${renderCustomerHeader(section?.name || 'Produtos')}
      <main class="page products-page" data-page="products">
        <div class="page-title-row">
          <button class="back-link" data-page="home">← Início</button>
          <button data-page="categories">Ver seções</button>
        </div>
        ${searchBox(`Buscar em ${section?.name || 'produtos'}`)}
        ${renderSearchResults(products, section?.name || 'Produtos')}
      </main>
    `;
  }

  function renderProductDetail() {
    const product = state.products.find(item => item.id === state.productId) || state.products[0];
    if (!product) return renderHome();
    const badges = productBadges(product).slice(0, 3);
    const section = state.sections.find(item => item.id === product.sectionId || item.id === product.secao || item.name === product.section);
    const description = String(product.descricao || product.description || product.detalhes || '').trim();
    return `
      ${renderCustomerHeader()}
      <main class="page product-page" data-page="product">
        <div class="topbar">
          <button data-page="${state.previousPage || 'home'}" aria-label="Voltar">${svgIcon('arrowLeft', 20)}</button>
          <strong>Detalhes</strong>
          <button data-page="cart" aria-label="Ver carrinho">${svgIcon('bag', 18)}</button>
        </div>
        <div class="detail-image">
          ${productThumb(product)}
          ${renderProductOverlayStack(product, badges)}
        </div>
        <section class="detail-content">
          <h1>${escapeHtml(product.name)}</h1>
          ${description ? `<p class="product-description">${escapeHtml(description)}</p>` : ''}
          ${renderProductDetailInfo(product, section?.name || section?.nome || '')}
          <div class="product-price-line">
            ${productPriceBlock(product)}
          </div>
          <div class="detail-buy">
            <strong>${formatMoney(product.price || 0)}</strong>
            <button data-qty-plus="${escapeHtml(product.id)}" aria-label="Adicionar ao carrinho">+</button>
          </div>
        </section>
      </main>
    `;
  }

  function renderCart() {
    const items = cartItems(state);
    const useNativeTelegramButton = hasTelegramMainButton();
    return `
      <main class="page cart-page" data-page="cart" id="cartDrawer">
        <div class="topbar page-brand-hero">
          <button data-page="${state.previousPage || 'home'}" aria-label="Voltar">${svgIcon('arrowLeft', 20)}</button>
          <div>
            <strong>Carrinho</strong>
            <small>Revise antes de finalizar no Telegram</small>
          </div>
          <img class="topbar-logo" src="${escapeHtml(logoSrc(state))}" alt="Mercadinho M&J" referrerpolicy="no-referrer">
          <button data-clear-cart aria-label="Limpar carrinho">${svgIcon('trash', 18)}</button>
        </div>
        ${items.length ? `
          <section class="cart-list">
            ${items.map(item => `
              <article class="cart-item">
              <div class="cart-thumb">
                  ${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" referrerpolicy="no-referrer" onerror="this.remove()">` : `<span class="cart-thumb-fallback" aria-hidden="true">${escapeHtml(String(item.name || 'P').slice(0, 1).toUpperCase())}</span>`}
                </div>
                <div class="cart-item-text">
                  <strong>${escapeHtml(item.name)}</strong>
                  <small>${escapeHtml(item.unit || 'un')}</small>
                  <span>${formatMoney(item.price)} un.</span>
                </div>
                <div class="qty">
                  <button data-qty-minus="${escapeHtml(item.id)}" aria-label="Diminuir quantidade">-</button>
                  <b>${item.quantity}</b>
                  <button data-qty-plus="${escapeHtml(item.id)}" aria-label="Adicionar ao carrinho">+</button>
                </div>
                <strong class="line-total">${formatMoney(item.price * item.quantity)}</strong>
              </article>
            `).join('')}
          </section>
          <section class="total-card">
            <div><span>Subtotal</span><strong>${formatMoney(cartTotal(state))}</strong></div>
            <div class="summary-total"><span>Total</span><strong>${formatMoney(cartTotal(state))}</strong></div>
            <p class="telegram-checkout-note">Pix preservado: recebedor, valor e numero do pedido aparecem na confirmacao pelo Telegram.</p>
            <div class="card-actions">
              <button id="continueShopping" data-page="${state.previousPage || 'home'}">Continuar comprando</button>
              ${useNativeTelegramButton ? '' : '<button id="finishInTelegram">Finalizar no Telegram</button>'}
            </div>
          </section>
        ` : `
          <div class="empty">Seu carrinho está vazio.</div>
          <button data-page="home" class="primary-wide">Continuar comprando</button>
        `}
      </main>
    `;
  }

  function renderTelegramCheckout() {
    const handoff = state.lastTelegramHandoff || {};
    const handoffFailed = handoff.ok === false && handoff.fallback !== true;
    const carrinho = handoff.carrinho || {};
    const itens = Array.isArray(carrinho.itens) && carrinho.itens.length ? carrinho.itens : cartItems(state);
    const total = Number(carrinho.total ?? cartTotal(state) ?? 0);
    const orderId = String(handoff.orderId || handoff.pedidoId || `MJ-${new Date().getFullYear()}-${String(Math.abs(Math.round(total * 100))).padStart(4, '0')}`).trim();
    return `
      <main class="page telegram-checkout-panel success-screen" id="telegramCheckoutPanel" data-page="telegram-checkout">
        <div class="topbar">
          <button data-page="cart" aria-label="Voltar">${svgIcon('arrowLeft', 20)}</button>
          <strong>Pagamento</strong>
          <span></span>
        </div>
        <section class="success-card telegram-handoff-card">
          <span class="success-icon" aria-hidden="true">${svgIcon('check', 44)}</span>
          <p class="greeting">Continue no Telegram</p>
          <h1>${handoffFailed ? 'Nao enviado ao Telegram' : 'Pedido enviado ao Telegram'}</h1>
          <strong class="order-id">${escapeHtml(orderId)}</strong>
          <p>${escapeHtml(state.checkoutMessage || `Total de ${formatMoney(total)} enviado para o Telegram. O Telegram conclui entrega e pagamento.`)}</p>
        </section>
        <section class="receipt">
          <h2>${svgIcon('receipt', 18)} Resumo</h2>
          ${itens.map(item => {
            const quantidade = Number(item.quantidade || item.quantity || 1);
            const preco = Number(item.price || item.preco || item.preco_unitario || 0);
            const subtotal = Number(item.subtotal ?? (preco * quantidade));
            return `
              <div>
                <span>${escapeHtml(quantidade)}x ${escapeHtml(item.nome || item.name || 'Produto')}</span>
                <strong>${formatMoney(subtotal)}</strong>
              </div>
            `;
          }).join('')}
        </section>
        <section class="telegram-success-actions">
          <button class="primary-wide" data-page="orders">Acompanhar pedido</button>
          <button id="retryTelegramHandoff">Enviar carrinho novamente</button>
          <button data-page="cart">Voltar ao carrinho</button>
        </section>
      </main>
    `;
  }

  function renderOrders() {
    return `
      ${renderCustomerHeader('Meus pedidos')}
      <main class="page orders-panel" id="ordersPanel" data-page="orders">
        <div class="topbar">
          <button data-page="home">←</button>
          <strong>Meus pedidos</strong>
          <span></span>
        </div>
        <section class="orders-list">
          ${state.orders.length ? state.orders.map(order => `
            <article class="order-card">
              <strong>Pedido #${escapeHtml(order.id || order.pedidoId || '')}</strong>
              <span>${escapeHtml(order.status || 'Em andamento')}</span>
              <p>${escapeHtml(order.pagamento?.status || order.status_pagamento || 'Aguardando pagamento')}</p>
              <button data-page="tracking">Acompanhar entrega</button>
            </article>
          `).join('') : '<div class="empty">Seus pedidos aparecerão aqui.</div>'}
        </section>
      </main>
    `;
  }

  function renderTracking() {
    const tracking = state.tracking || {};
    const mapaUrl = tracking?.mapaUrl || tracking?.mapUrl || '';
    const status = tracking?.status || 'Aguardando atualizacao do status.';
    return `
      <main class="page tracking-panel" id="trackingPanel" data-page="tracking">
        <div class="topbar page-brand-hero">
          <button data-page="orders" aria-label="Voltar">${svgIcon('arrowLeft', 20)}</button>
          <div>
            <strong>Acompanhar pedido</strong>
            <small>Acompanhamento publico seguro</small>
          </div>
          <img class="topbar-logo" src="${escapeHtml(logoSrc(state))}" alt="Mercadinho M&J" referrerpolicy="no-referrer">
        </div>
        <section class="tracking-status-card">
          <h2>${escapeHtml(status)}</h2>
          <p>${escapeHtml(tracking?.previsao || tracking?.mensagem || 'Previsao atualizada pelo painel quando o pedido avanca.')}</p>
        </section>
        <section class="tracking-summary-card">
          <h2>Resumo</h2>
          <p>${escapeHtml(tracking?.resumo || 'Status, pagamento e entrega continuam sincronizados com o pedido real.')}</p>
        </section>
        <section class="tracking-timeline">
          <div class="tracking-step done"><span>${svgIcon('check', 18)}</span><div><strong>Pedido recebido</strong><p>Carrinho enviado pelo Mini App</p></div></div>
          <div class="tracking-step done"><span>${svgIcon('check', 18)}</span><div><strong>Pix aprovado</strong><p>Valor e recebedor conferidos</p></div></div>
          <div class="tracking-step current"><span>3</span><div><strong>Em rota</strong><p>Cliente acompanha sem ver dados privados</p></div></div>
          <div class="tracking-step"><span>4</span><div><strong>Entregue</strong><p>Finalizacao pelo painel</p></div></div>
        </section>
        <section class="tracking-map-card">
          ${mapaUrl ? `<a class="track-map" href="${escapeHtml(mapaUrl)}" target="_blank" rel="noopener">Abrir rota no Maps</a>` : '<div class="map-road"></div><div class="map-pin"></div>'}
        </section>
      </main>
    `;
  }

  function renderLoyaltyChallengeCard(challenge = {}) {
    const name = challenge.nome || challenge.name || 'Desafio';
    const description = challenge.descricao || challenge.description || '';
    const progress = Math.max(0, Math.floor(Number(challenge.progresso ?? challenge.progress ?? challenge.progressValue ?? 0) || 0));
    const goal = Math.max(1, Math.floor(Number(challenge.meta ?? challenge.goal ?? challenge.goalValue ?? 1) || 1));
    const remaining = Math.max(0, Math.floor(Number(challenge.restante ?? (goal - progress)) || 0));
    const reward = Math.max(0, Math.floor(Number(challenge.recompensaPontos ?? challenge.rewardPoints ?? challenge.pontos ?? 0) || 0));
    const progressLabel = remaining > 0
      ? `Faltam ${remaining} ${remaining === 1 ? 'produto' : 'produtos'}`
      : 'Desafio concluido';
    return `
      <article class="loyalty-challenge-card">
        <div>
          <strong>${escapeHtml(name)}</strong>
          ${description ? `<p>${escapeHtml(description)}</p>` : ''}
        </div>
        <span>${escapeHtml(progressLabel)}</span>
        ${reward ? `<small>+${escapeHtml(reward)} pontos</small>` : ''}
      </article>
    `;
  }

  function renderLoyalty() {
    const pontos = Number(state.loyalty?.saldoPontos || 0);
    const saldoReais = Number(state.loyalty?.saldoReais || 0);
    const challenges = loyaltyChallenges(state);
    return `
      ${renderCustomerHeader('Fidelidade')}
      <main class="page loyalty-panel" id="loyaltyPanel" data-page="loyalty">
        <div class="topbar">
          <button data-page="home">←</button>
          <strong>Fidelidade</strong>
          <span></span>
        </div>
        <section class="loyalty-hero">
          <h2>Meus pontos</h2>
          <strong>⭐ ${pontos} pontos</strong>
          <p>Saldo convertido: ${formatMoney(saldoReais)} em vantagem de compra.</p>
          <button data-page="home">Ver produtos</button>
        </section>
        <section class="loyalty-challenges">
          <div class="section-title">
            <h2>Desafios</h2>
            <span>${challenges.length} ativos</span>
          </div>
          ${challenges.length ? challenges.map(renderLoyaltyChallengeCard).join('') : '<div class="empty">Os desafios cadastrados no painel aparecem aqui.</div>'}
        </section>
      </main>
    `;
  }

  function renderProfile() {
    const name = customerName(state);
    const cliente = state.cliente || {};
    const profileItem = (label, value) => `
      <div class="profile-detail-item">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value || 'Nao informado')}</strong>
      </div>
    `;
    const endereco = customerAddressSummary(state);
    return `
      ${renderCustomerHeader('Cadastro')}
      <main class="page profile-panel" data-page="profile">
        <section class="profile-card">
          <div class="avatar">${escapeHtml(name.slice(0, 1).toUpperCase())}</div>
          <h2>${escapeHtml(name)}</h2>
          <p>Conta sincronizada com o Telegram.</p>
          <div class="profile-details">
            ${profileItem('Nome', name)}
            ${profileItem('Telegram ID', customerTelegramId(state))}
            ${profileItem('Usuario Telegram', cliente.username || cliente.telegramUsername)}
            ${profileItem('Codigo de indicacao', customerReferralCode(state))}
            ${profileItem('Telefone', cliente.telefone || cliente.phone)}
            ${profileItem('CPF', cliente.cpf)}
            ${profileItem('Nascimento', cliente.dataNascimento)}
            ${profileItem('Endereco', endereco)}
          </div>
          <button data-page="loyalty">Programa de fidelidade</button>
          <button data-page="home">Sair para produtos</button>
        </section>
      </main>
    `;
}

  function stickyCart() {
    const count = cartCount(state);
    if (!count || ['cart', 'delivery', 'payment', 'telegram-checkout'].includes(state.page)) return '';
    return `
      <div class="catalog-checkout-bar sticky-cart" id="stickyCartBar">
        <div>
          <span>${count} ${count === 1 ? 'item' : 'itens'}</span>
          <strong>${formatMoney(cartTotal(state))}</strong>
        </div>
        <button id="reviewCart" data-page="cart">Ver carrinho</button>
      </div>
    `;
  }

  function bottomNav() {
    if (['home', 'categories', 'products', 'product', 'cart', 'telegram-checkout', 'loyalty'].includes(state.page)) return '';
    const item = (page, icon, label) => `
      <button class="${state.page === page ? 'active' : ''}" data-page="${page}">
        <span aria-hidden="true">${icon}</span>
        ${label}
      </button>
    `;
    return `
      <nav class="miniapp-bottom-nav">
        ${item('home', svgIcon('home', 20), 'Loja')}
        ${item('categories', svgIcon('menu', 20), 'Seções')}
        ${item('cart', svgIcon('bag', 20), 'Carrinho')}
        ${item('orders', svgIcon('package', 20), 'Pedidos')}
        ${item('profile', svgIcon('user', 20), 'Conta')}
      </nav>
    `;
  }

  function renderDebugOverlay() {
    const debugAtivo = new URLSearchParams(location.search).get('debug') === '1';
    if (!debugAtivo) return '';
    return `
      <aside class="miniapp-debug-overlay" id="miniappDebugOverlay">
        <strong>Debug Mini App</strong>
        <span>buildVersion: ${escapeHtml(state.webBuild || RUNTIME_LOGO_BUILD || resolveBuildFromHtml() || 'local')}</span>
        <span>apiBase: ${escapeHtml(state.apiBase || state.apiBaseUrl || 'same-origin/static')}</span>
        <span>Carregado em: ${escapeHtml(new Date().toLocaleString())}</span>
      </aside>
    `;
  }

  async function finishInTelegram() {
    if (state.sending) return;
    if (!cartCount(state)) {
      navigateTo('home');
      return;
    }
    state.sending = true;
    sendMiniAppEvent(state, 'checkout_telegram_handoff_start', { itemCount: cartCount(state), total: cartTotal(state) });
    const result = await telegramHandoff(state);
    state.lastTelegramHandoff = result || {};
    state.checkoutMessage = result?.telegram?.mensagem || result?.mensagem || result?.message || 'Carrinho enviado ao Telegram. Termine entrega, retirada e Pix pelo chat.';
    state.sending = false;
    renderer.navigateTo('telegram-checkout');
    const webApp = window.Telegram?.WebApp;
    if (webApp?.close && (result?.ok !== false || result?.fallback === true)) {
      webApp.close();
    }
  }

  async function loadTrackingForCurrentOrder() {
    const pedidoId = state.pedidoAtual?.id || state.pedidoAtual?.pedidoId;
    if (!pedidoId || state.page !== 'tracking') return;
    try {
      const data = await loadTracking(state, pedidoId);
      state.tracking = data || {};
      render();
    } catch {}
  }

  function bindBannerControls(scope = root) {
    scope.querySelectorAll('[data-banner-action]').forEach(button => {
      button.addEventListener('click', () => runBannerAction(button));
    });
    scope.querySelectorAll('[data-banner-jump]').forEach(button => {
      button.addEventListener('click', () => {
        state.bannerIndex = Number(button.dataset.bannerJump || 0) || 0;
        updateBannerCarouselOnly();
      });
    });
  }

  function bind() {
    root.querySelectorAll('button[data-page], a[data-page]').forEach(button => {
      button.addEventListener('click', () => navigateTo(button.dataset.page));
    });
    root.querySelectorAll('[data-open-sections]').forEach(button => {
      button.addEventListener('click', () => {
        state.sectionsMenuOpen = true;
        render();
      });
    });
    root.querySelectorAll('[data-section-open]').forEach(button => {
      button.addEventListener('click', () => {
        navigateTo('products', { sectionId: button.dataset.sectionOpen, query: '' });
      });
    });
    root.querySelectorAll('[data-all-products]').forEach(button => {
      button.addEventListener('click', () => navigateTo('home', { sectionId: '', query: '' }));
    });
    root.querySelectorAll('[data-close-sections]').forEach(element => {
      element.addEventListener('click', () => {
        state.sectionsMenuOpen = false;
        render();
      });
    });
    root.querySelector('#sectionsDrawer')?.addEventListener('click', event => event.stopPropagation());
    root.querySelectorAll('[data-product-open]').forEach(button => {
      button.addEventListener('click', () => {
        state.productId = button.dataset.productOpen;
        navigateTo('product');
      });
    });
    bindBannerControls(root);
    root.querySelectorAll('[data-qty-plus]').forEach(button => {
      button.addEventListener('click', () => {
        const product = state.products.find(item => item.id === button.dataset.qtyPlus);
        if (!product) return;
        changeQty(state, product, 1);
        syncCart(state, { itens: cartItems(state) });
        render();
      });
    });
    root.querySelectorAll('[data-qty-minus]').forEach(button => {
      button.addEventListener('click', () => {
        const product = state.products.find(item => item.id === button.dataset.qtyMinus);
        if (!product) return;
        changeQty(state, product, -1);
        syncCart(state, { itens: cartItems(state) });
        render();
      });
    });
    root.querySelector('[data-clear-cart]')?.addEventListener('click', () => {
      clearCart(state);
      render();
    });
    root.querySelector('#continueShopping')?.addEventListener('click', () => navigateTo(state.previousPage || 'home'));
    root.querySelector('#finishInTelegram')?.addEventListener('click', finishInTelegram);
    root.querySelector('#retryTelegramHandoff')?.addEventListener('click', finishInTelegram);
    root.querySelector('#search')?.addEventListener('input', event => {
      state.query = event.target.value;
      render();
    });

    root.querySelector('#goToTracking')?.addEventListener('click', () => {
      navigateTo('tracking');
    });

    root.querySelector('#trackingPanel')?.classList.add('active-page');
    if (state.page === 'tracking' && !state.tracking?.status) {
      loadTrackingForCurrentOrder();
    }
  }

  function render() {
    let html = '';
    const activeUi = normalizeMiniAppUi(state.miniappUi || state.miniappui || {});
    const splashDuration = clampMs(activeUi.splash?.durationMs, MINIAPP_UI_DEFAULTS.splash.durationMs);
    applyThemeVariables(activeUi);
    document.documentElement.style.setProperty('--mj-splash-duration', `${splashDuration}ms`);
    if (state.page === 'categories') html = renderCategories();
    else if (state.page === 'products') html = renderProducts();
    else if (state.page === 'product') html = renderProductDetail();
    else if (state.page === 'cart') html = renderCart();
    else if (['delivery', 'payment', 'telegram-checkout'].includes(state.page)) html = renderTelegramCheckout();
    else if (state.page === 'orders') html = renderOrders();
    else if (state.page === 'tracking') html = renderTracking();
    else if (state.page === 'loyalty') html = renderLoyalty();
    else if (state.page === 'profile') html = renderProfile();
    else html = renderHome();

    root.className = 'mj-fresh-app';
    root.innerHTML = `${renderSplash()}${html}${stickyCart()}${bottomNav()}${renderDebugOverlay()}<div id="productSheet" hidden></div>`;
    window.setTimeout(() => {
      root.querySelector('#miniappSplash')?.remove();
    }, splashDuration + 350);

    setMainButton();

    const cartDrawer = root.querySelector('#cartDrawer');
    const trackingPanel = root.querySelector('#trackingPanel');
    cartDrawer?.classList.add('open');
    trackingPanel?.classList.add('active-page');
    if (state.checkoutMessage && root.querySelector('#pixCopyText')) {
      const copyNode = root.querySelector('#pixCopyText');
      copyNode.insertAdjacentHTML(
        'afterbegin',
        `<p class="checkout-warning">${escapeHtml(state.checkoutMessage)}</p>`
      );
    }
    bind();
    scheduleBannerAutoSlide(activeUi);
  }

  const renderer = { render, navigateTo };
  return renderer;
}


