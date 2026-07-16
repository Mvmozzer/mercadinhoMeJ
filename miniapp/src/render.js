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
  productDetails: {
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
const BANNER_PAGES = new Set(['home', 'categories', 'products', 'cart', 'orders', 'tracking', 'profile']);
const BANNER_ANIMATIONS = new Set(['slide', 'fade', 'none']);
function resolveBuildFromHtml() {
  const styles = globalThis.document?.getElementById?.('mainStylesheet');
  const href = String(styles?.getAttribute?.('href') || '');
  const byHref = href.match(/[?&]v=([^&]+)/)?.[1];
  const byQuery = globalThis.location?.searchParams?.get?.('v');
  return String(byHref || byQuery || '').trim();
}

import { cartCount, cartItems, cartLineSubtotal, cartQty, cartTotal, changeQty, clearCart, setQty, wholesaleProgress, wholesalePriceInfo } from './cart.js?v=2026.07.16.511';
import { emojiForSection, filterProducts, isWeightedProduct, looksLikeSectionEmoji, productAvailability, productBadges, weightedProductRules } from './catalog.js?v=2026.07.16.511';
import { checkoutCreate, completeCheckoutAttempt, isMiniAppPaymentEnabled, paymentMethodForCustomer, paymentModeForCustomer } from './checkout.js?v=2026.07.16.511';
import { sendMiniAppEvent, syncCart } from './api.js?v=2026.07.16.511';
import { escapeHtml, formatMeasure, greetingFor, money } from './utils.js?v=2026.07.16.511';
import { persistMiniAppUiState } from './storage.js?v=2026.07.16.511';
import { updateMainButton } from './telegram.js?v=2026.07.16.511';
import { loadOrderStatus, loadTracking } from './tracking.js?v=2026.07.16.511';
import { cancelOrder } from './orders.js?v=2026.07.16.511';
import { miniappStoreIsAvailable, storeAcceptsOrders } from './state.js?v=2026.07.16.511';
import {
  activeOrderId,
  applyOrderStatusToState,
  applyTrackingToState,
  awaitingFinalWeightState,
  isAwaitingFinalWeight,
  isFinalOrderStatus,
  mapFromTrackingPayload,
  orderFlowPollingMs,
  shouldOpenTrackingAfterPayment
} from './orderFlow.js?v=2026.07.16.511';

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
  const productDetailsEnabled = [
    cfg.productDetails?.enabled,
    cfg.product_details?.enabled,
    cfg.detalhesProduto?.enabled,
    cfg.detalhes_produto?.enabled,
    cfg.mostrarDetalhesProduto,
    cfg.showProductDetails
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
    productDetails: {
      enabled: productDetailsEnabled === undefined
        ? MINIAPP_UI_DEFAULTS.productDetails.enabled
        : productDetailsEnabled === true
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
  if (raw.startsWith('/uploads/')) {
    return new URL(raw.replace(/^\//, ''), new URL('../../', import.meta.url)).href;
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

function wholesaleConfig(state = {}) {
  return state.wholesale || state.atacado || {};
}

function wholesaleEnabled(state = {}) {
  return wholesaleConfig(state).ativo !== false;
}

function wholesaleProducts(state = {}) {
  return (state.products || []).filter(product => product.wholesaleActive === true || product.atacado_ativo === true || product.atacadoAtivo === true);
}

function wholesaleSection(state = {}) {
  const cfg = wholesaleConfig(state);
  const id = String(cfg.secaoVirtualId || 'atacado');
  return (state.sections || []).find(section => section.atacado === true || String(section.id) === id);
}

function wholesaleSectionId(state = {}) {
  return String(wholesaleConfig(state).secaoVirtualId || 'atacado');
}

function isWholesaleSection(section = {}, state = {}) {
  return section.atacado === true || String(section.id || '') === wholesaleSectionId(state);
}

function productElement(root, productId) {
  return Array.from(root?.querySelectorAll?.('[data-product-id]') || [])
    .find(element => String(element.dataset.productId || '') === String(productId || ''));
}

function customerName(state = {}) {
  const nameFromClient =
    state.cliente?.nome ||
    (state.telegramIdentity?.verificada === true ? state.telegramIdentity?.nome : '') ||
    state.cliente?.telegramNome ||
    state.cliente?.telegram_nome ||
    state.cliente?.first_name ||
    state.cliente?.telegramUsername ||
    state.cliente?.username ||
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

function formatCustomerGreetingText(template = '', fallback = '', values = {}) {
  const text = formatHeaderText(template, fallback, values);
  const name = String(values.name || '').trim();
  if (!name || name.toLowerCase() === 'cliente' || /\{nome\}/i.test(String(template || ''))) {
    return text;
  }
  return text.replace(/^((?:bom dia|boa tarde|boa noite|ol[aá]|oi)\s*,?\s*)cliente\b/i, `$1${name}`);
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
  const isClosed = !storeAcceptsOrders(state) && !isPaused;
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
  const imageUrl = resolveAssetUrl(product.image, '');
  if (!imageUrl) return fallback;
  return `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.name || 'Produto')}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`;
}

function productPriceBlock(product = {}, quantity = 0) {
  const priceInfo = wholesalePriceInfo(product, quantity);
  const precoAtual = Number(priceInfo.price || product.price || 0);
  const atacadoLinha = product.wholesaleActive === true && Number(product.wholesalePrice || product.preco_atacado || 0) > 0
    ? `<em class="wholesale-price-hint">Atacado ${formatMoney(product.wholesalePrice || product.preco_atacado)} a partir de ${Number(product.wholesaleMinQuantity || product.quantidade_atacado || 0)} un.</em>`
    : '';
  const weightRules = weightedProductRules(product);
  const unitSuffix = weightRules.weighted ? `<em class="weighted-unit-price">por ${escapeHtml(weightRules.unit)}</em>` : '';
  if (priceInfo.wholesaleApplied) {
    return `<strong>${formatMoney(precoAtual)}</strong>${unitSuffix}<small>${formatMoney(priceInfo.retailPrice)}</small><em class="wholesale-price-hint wholesale-price-hint--active">Atacado aplicado</em>`;
  }
  return `<strong>${formatMoney(precoAtual)}</strong>${unitSuffix}${atacadoLinha}`;
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
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    settings: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.42 1.1V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.42H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .42-1.1V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.4.2.75.52 1 .9.25.38.39.82.42 1.27V11a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z"/>'
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

  function renderStoreUnavailable() {
    const logo = appendBuildTag(logoSrc(state), state);
    return `
      <main class="store-unavailable" id="storeUnavailable" aria-labelledby="storeUnavailableTitle" aria-live="polite">
        <section class="store-unavailable-content">
          <img class="store-unavailable-logo" src="${escapeHtml(logo)}" alt="Mercadinho M&J">
          <h1 id="storeUnavailableTitle">Loja fechada</h1>
          <p>Assim que abrirmos, a loja aparecerá automaticamente.</p>
          <div class="store-unavailable-status" role="status">
            <span class="store-unavailable-status-dot" aria-hidden="true"></span>
            <span>Fechada agora</span>
          </div>
        </section>
      </main>
    `;
  }

  function navigateTo(page, options = {}) {
    const nextPage = page || 'home';
    if (nextPage === 'product' && !productDetailsEnabled()) {
      state.sectionsMenuOpen = false;
      state.pageMenuOpen = false;
      if (options.sectionId !== undefined) state.sectionId = options.sectionId;
      if (options.query !== undefined) state.query = options.query;
      if (state.page === 'product') state.page = state.previousPage || 'home';
      persistMiniAppUiState(state);
      render();
      return;
    }
    state.previousPage = state.page || 'home';
    state.page = nextPage;
    state.sectionsMenuOpen = false;
    state.pageMenuOpen = false;
    if (options.sectionId !== undefined) state.sectionId = options.sectionId;
    if (options.query !== undefined) state.query = options.query;
    persistMiniAppUiState(state);
    render();
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  function activeBanners(ui = normalizeMiniAppUi(state.miniappUi || state.miniappui || {})) {
    return (ui.banners || []).filter(item => item.active !== false);
  }

  function sectionsMenuEnabled(ui = normalizeMiniAppUi(state.miniappUi || state.miniappui || {})) {
    return ui.sectionsMenu?.enabled === true;
  }

  function productDetailsEnabled(ui = normalizeMiniAppUi(state.miniappUi || state.miniappui || {})) {
    return ui.productDetails?.enabled !== false;
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
    if (!banners.length) return '';
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
    if (!next) {
      current.remove();
      scheduleBannerAutoSlide(ui);
      return;
    }
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
      paymentMode: paymentModeForCustomer(state),
      paymentMethod: paymentMethodForCustomer(state),
      enabled: storeAcceptsOrders(state),
      hasPix: Boolean(state.pix)
    });
    const button = webApp?.MainButton;
    if (button?.onClick && !button.__mjFinishCheckoutBound) {
      button.onClick(() => {
        if (state.page === 'cart' && cartCount(state)) finishCheckout();
      });
      button.__mjFinishCheckoutBound = true;
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
      ? escapeHtml(formatCustomerGreetingText(header.greetingText, `${greeting}, ${name}`, {
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
    const sectionsButton = sectionsMenuEnabled() && state.sections.length > 0
      ? `<button class="icon-button menu-button" type="button" data-open-sections aria-label="Abrir seções">${svgIcon('menu', 22)}</button>`
      : '<span class="hero-spacer" aria-hidden="true"></span>';
    return `
      <header class="market-hero app-header" id="marketHero">
        <div class="hero-top-row">
          ${sectionsButton}
          <div class="hero-brand-block">
            ${logoMarkup}
            <div class="hero-copy">
              ${greetingMarkup}
              ${titleMarkup}
            </div>
          </div>
          <button class="icon-button pages-button" type="button" data-open-pages aria-label="Abrir páginas">${svgIcon('settings', 22)}</button>
        </div>
        <div class="store-status ${status.className}" id="storeStatus"><span class="store-status-dot" aria-hidden="true"></span><span>${escapeHtml(status.text)}</span></div>
      </header>
      ${renderPagesDrawer()}
      ${renderSectionsDrawer()}
    `;
  }

  function searchBox(placeholder = 'Buscar produtos') {
    return `
      <label class="search-box">
        <span aria-hidden="true">${svgIcon('search', 18)}</span>
        <input id="search" type="search" value="${escapeHtml(state.query)}" placeholder="${escapeHtml(placeholder)}" aria-label="${escapeHtml(placeholder)}">
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

  function renderProductOverlayStack(product = {}, badges = productBadges(product).slice(0, 2)) {
    const items = badges.map(renderProductPhotoBadge).filter(Boolean);
    return items.length ? `<div class="product-overlay-stack">${items.join('')}</div>` : '';
  }

  function cleanProductDetail(value = '') {
    const text = String(value ?? '').trim();
    if (!text || text === '0') return '';
    return text;
  }

  function productQuantityLabel(product = {}, quantity = 0) {
    const value = Number(quantity || 0);
    if (!isWeightedProduct(product)) return String(Math.max(0, Math.floor(value)));
    return formatMeasure(value, weightedProductRules(product).unit);
  }

  function weightedPresetValues(product = {}) {
    const rules = weightedProductRules(product);
    if (!rules.weighted) return [];
    const candidates = [
      rules.selectionMin,
      rules.selectionMin + rules.step,
      rules.selectionMin + (rules.step * 4),
      rules.selectionMin + (rules.step * 9),
      rules.max
    ];
    return Array.from(new Set(candidates
      .filter(value => Number.isFinite(value) && value >= rules.selectionMin && (!rules.max || value <= rules.max))
      .map(value => Number(value.toFixed(rules.precision)))))
      .slice(0, 4);
  }

  function renderWeightedProductControl(product = {}) {
    if (!isWeightedProduct(product)) return '';
    const rules = weightedProductRules(product);
    const quantity = cartQty(state, product.id);
    const subtotal = cartLineSubtotal({
      ...product,
      price: wholesalePriceInfo(product, quantity).price || product.price || 0
    }, quantity);
    return `
      <section class="weighted-product-control" data-weight-product="${escapeHtml(product.id)}">
        <div class="weighted-product-heading">
          <strong>Escolha o peso aproximado</strong>
          <span>${quantity > 0 ? escapeHtml(productQuantityLabel(product, quantity)) : 'Ainda nao escolhido'}</span>
        </div>
        <p>${escapeHtml(rules.notice)}</p>
        <div class="weighted-product-presets" aria-label="Pesos sugeridos">
          ${weightedPresetValues(product).map(value => `
            <button type="button" data-action="set-weight" data-weight-product-id="${escapeHtml(product.id)}" data-weight-value="${escapeHtml(value)}" class="${Math.abs(quantity - value) < 1e-6 ? 'active' : ''}">
              ${escapeHtml(formatMeasure(value, rules.unit))}
            </button>
          `).join('')}
        </div>
        <div class="weighted-product-stepper">
          <button type="button" data-qty-minus="${escapeHtml(product.id)}" aria-label="Diminuir peso de ${escapeHtml(product.name)}">-</button>
          <strong>${quantity > 0 ? escapeHtml(productQuantityLabel(product, quantity)) : escapeHtml(formatMeasure(rules.selectionMin, rules.unit))}</strong>
          <button type="button" data-qty-plus="${escapeHtml(product.id)}" aria-label="Aumentar peso de ${escapeHtml(product.name)}">+</button>
        </div>
        ${quantity > 0 ? `<small>Subtotal estimado: ${formatMoney(subtotal)}</small>` : ''}
      </section>
    `;
  }

  function productAvailabilityLine(product = {}) {
    const availability = productAvailability(product);
    if (availability.hidden) return 'Indisponivel';
    const stock = Number(product.stock ?? product.estoque_pronta_entrega ?? product.estoque_atual ?? product.estoque ?? 0);
    if (!availability.preorder && stock <= 0) return 'Sem estoque para pronta entrega';
    if (availability.preorder) {
      return availability.forecast
        ? `Somente sob encomenda • ${availability.forecast}`
        : 'Somente sob encomenda';
    }
    return product.previsao_retirada_texto || product.previsaoRetiradaTexto || availability.forecast;
  }

  function renderProductDetailInfo(product = {}, sectionName = '') {
    const unit = cleanProductDetail(product.unit || product.unidadeVenda || product.unidadeMedida || product.tamanho);
    const stock = Number(product.stock ?? product.estoque_pronta_entrega ?? product.estoque_atual ?? product.estoque ?? 0);
    const availability = productAvailability(product);
    const group = cleanProductDetail(product.grupoNome || product.grupo_nome || product.nome_principal || product.produtoPaiNome);
    const code = cleanProductDetail(product.codigoInterno || product.codigo_interno || product.sku || product.codigoBarras || product.codigo_barras);
    const observation = cleanProductDetail(product.productObservation || product.observacaoProduto || product.observacao_produto);
    const size = cleanProductDetail(product.tamanho || product.peso);
    const flavor = cleanProductDetail(product.sabor);
    const saleMode = cleanProductDetail(product.modoVenda || product.saleMode);
    const validity = cleanProductDetail(product.validade);
    const stockText = availability.preorder
      ? productAvailabilityLine(product)
      : stock > 0
      ? `${stock} ${unit || 'un'} disponiveis`
      : productAvailabilityLine(product);
    const rows = [
      ['Marca', product.marca || product.brand],
      ['Categoria', sectionName || product.section || product.secao],
      ['Grupo', group],
      ['Unidade', unit],
      ['Disponibilidade', stockText],
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

  function renderWholesaleProgress(product = {}, quantity = 0, options = {}) {
    const cfg = wholesaleConfig(state);
    const progress = wholesaleProgress(product, quantity);
    if (!wholesaleEnabled(state) || !progress.active || cfg.barraProgressoAtiva === false) return '';
    if (cfg.mostrarBarraNoVarejo === false && quantity <= 0) return '';
    const compact = options.compact === true;
    const text = progress.reached
      ? (cfg.mensagemMetaAtingida || 'Parabéns, você atingiu o desconto máximo.')
      : `Faltam ${progress.missing} un. para ${formatMoney(progress.wholesalePrice)} no atacado`;
    return `
      <div class="wholesale-progress-wrap${compact ? ' wholesale-progress-wrap--compact' : ''}${progress.reached ? ' wholesale-progress-complete' : ''}" data-wholesale-progress="${escapeHtml(product.id)}" data-wholesale-compact="${compact ? 'true' : 'false'}" style="--wholesale-progress:${progress.percent}%;--wholesale-color:${escapeHtml(cfg.corBarra || '#2563eb')};--wholesale-complete:${escapeHtml(cfg.corBarraCompleta || '#16a34a')};--wholesale-text:${escapeHtml(cfg.corTextoBarra || '#ffffff')}">
        <div class="wholesale-progress-head">
          <span>Atacado ativado</span>
          <strong>${progress.quantity}/${progress.minQuantity}</strong>
        </div>
        <div class="wholesale-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${progress.minQuantity}" aria-valuenow="${Math.min(progress.quantity, progress.minQuantity)}">
          <span></span>
        </div>
        ${compact && !progress.reached ? '' : `<small>${escapeHtml(text)}</small>`}
      </div>
    `;
  }

  function updateWholesaleProgress(productId) {
    const product = state.products.find(item => item.id === productId);
    const container = productElement(root, productId)?.querySelector('[data-wholesale-progress]');
    if (!product || !container) return;
    const next = renderWholesaleProgress(product, cartQty(state, productId), {
      compact: container.dataset.wholesaleCompact === 'true'
    });
    if (next) container.outerHTML = next;
  }

  function triggerWholesaleFireworks(target) {
    const cfg = wholesaleConfig(state);
    if (!target || cfg.tipoAnimacao === 'nenhuma' || cfg.animacaoFogosAtiva === false) return;
    const effect = document.createElement('div');
    effect.className = `wholesale-fireworks wholesale-fireworks--${cfg.tipoAnimacao || 'fogos'}`;
    effect.setAttribute('aria-hidden', 'true');
    effect.innerHTML = Array.from({ length: 10 }, (_, index) => `<span style="--i:${index}"></span>`).join('');
    target.appendChild(effect);
    window.setTimeout(() => effect.remove(), Number(cfg.duracaoAnimacaoMs || 1800));
  }

  function productCard(product) {
    const quantity = cartQty(state, product.id);
    const badges = productBadges(product).slice(0, 2);
    const brand = String(product.marca || product.brand || '').trim();
    const unit = cleanProductDetail(product.unit || product.unidade || product.unidadeVenda || product.unidadeMedida || product.tamanho) || 'un';
    const availabilityLine = productAvailabilityLine(product);
    const availability = productAvailability(product);
    const stock = Number(product.stock ?? product.estoque_pronta_entrega ?? product.estoque_atual ?? product.estoque ?? 0);
    const outOfStock = !availability.preorder && stock <= 0;
    const availabilityClass = availability.hidden || outOfStock
      ? ' product-availability-chip--danger'
      : availability.preorder
        ? ' product-availability-chip--warning'
        : '';
    const metaMarkup = [
      brand ? `<span class="product-brand">${escapeHtml(brand)}</span>` : '',
      unit ? `<span class="product-unit-chip">${escapeHtml(unit)}</span>` : ''
    ].filter(Boolean).join('');
    const productMedia = `
      ${productThumb(product)}
      ${renderProductOverlayStack(product, badges)}
    `;
    const productImage = productDetailsEnabled()
      ? `<button type="button" class="product-image" data-product-open="${escapeHtml(product.id)}" aria-label="Abrir ${escapeHtml(product.name)}">${productMedia}</button>`
      : `<div class="product-image">${productMedia}</div>`;
    return `
      <article class="product-card mini-product-card" data-product-id="${escapeHtml(product.id)}">
        <div class="product-media-frame product-media">
          ${productImage}
          <div class="product-actions${quantity ? ' product-actions--quantity product-stepper' : ''}">
            ${quantity ? `
              <button data-qty-minus="${escapeHtml(product.id)}" aria-label="Diminuir quantidade"><span class="product-action-symbol" aria-hidden="true">-</span></button>
              <b>${escapeHtml(productQuantityLabel(product, quantity))}</b>
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
          ${metaMarkup ? `<div class="product-meta-row">${metaMarkup}</div>` : ''}
          ${availabilityLine ? `<span class="product-availability-chip${availabilityClass}">${escapeHtml(availabilityLine)}</span>` : ''}
          <div class="product-buy-row${quantity ? ' product-buy-row--quantity' : ''}">
            <div class="product-price-block">${productPriceBlock(product, quantity)}</div>
          </div>
          ${renderWholesaleProgress(product, quantity, { compact: true })}
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

  function appMenuShortcut(page, icon, label, active = false) {
    return `
      <button class="drawer-app-item${active ? ' active' : ''}" type="button" data-menu-page="${escapeHtml(page)}">
        <span class="drawer-app-icon" aria-hidden="true">${icon}</span>
        <span>${escapeHtml(label)}</span>
      </button>
    `;
  }

  function renderAppMenuShortcuts() {
    const items = [
      ['home', svgIcon('home', 18), 'Loja'],
      ['categories', svgIcon('menu', 18), 'Seções'],
      ['cart', svgIcon('bag', 18), 'Carrinho'],
      ['orders', svgIcon('package', 18), 'Pedidos'],
      ['profile', svgIcon('user', 18), 'Conta']
    ];
    return `
      <div class="drawer-app-shortcuts" aria-label="Menu principal">
        ${items.map(([page, icon, label]) => appMenuShortcut(page, icon, label, state.page === page)).join('')}
      </div>
    `;
  }

  function renderPagesDrawer() {
    const open = Boolean(state.pageMenuOpen);
    return `
      <div class="sections-menu-overlay page-menu-overlay${open ? ' open' : ''}" data-close-pages ${open ? '' : 'hidden'}>
        <aside class="sections-drawer page-drawer" id="pagesDrawer" role="dialog" aria-modal="true" aria-labelledby="pagesDrawerTitle">
          <div class="sections-drawer-header">
            <div class="drawer-brand-lockup">
              <img class="drawer-logo" src="${escapeHtml(logoSrc(state))}" alt="Mercadinho M&J" referrerpolicy="no-referrer">
              <div>
                <h2 id="pagesDrawerTitle">Páginas</h2>
                <p>Atalhos do Mini App</p>
              </div>
            </div>
            <button class="icon-button" type="button" data-close-pages aria-label="Fechar páginas">${svgIcon('x', 18)}</button>
          </div>
          ${renderAppMenuShortcuts()}
        </aside>
      </div>
    `;
  }

  function renderSectionsDrawer() {
    const open = Boolean(state.sectionsMenuOpen);
    const mostrarSecoes = sectionsMenuEnabled() && state.sections.length > 0;
    return `
      <nav class="section-menu" id="categoryRail" aria-label="Seções" hidden></nav>
      <div class="sections-menu-overlay${open ? ' open' : ''}" data-close-sections ${open ? '' : 'hidden'}>
        <aside class="sections-drawer" id="sectionsDrawer" role="dialog" aria-modal="true" aria-labelledby="sectionsDrawerTitle">
          <div class="sections-drawer-header">
            <div class="drawer-brand-lockup">
              <img class="drawer-logo" src="${escapeHtml(logoSrc(state))}" alt="Mercadinho M&J" referrerpolicy="no-referrer">
              <div>
                <h2 id="sectionsDrawerTitle">Mercadinho M&J</h2>
                <p>Seções da loja</p>
              </div>
            </div>
            <button class="icon-button" type="button" data-close-sections aria-label="Fechar seções">${svgIcon('x', 18)}</button>
          </div>
          ${mostrarSecoes ? `
            <div class="sections-drawer-list" aria-label="Seções da loja">
              <button class="drawer-section-item${!state.sectionId ? ' active' : ''}" type="button" data-all-products>
                ${renderSectionMenuIcon({ id: 'todos', name: 'Todos' })}
                <span>Todos</span>
                <small>${state.products.length} itens</small>
              </button>
              ${state.sections.map(section => renderDrawerSectionItem(section, state.sectionId === section.id)).join('')}
            </div>
          ` : `
            <div class="empty-state">
              <strong>Nenhuma seção disponível</strong>
              <p>Use as páginas para navegar pela loja.</p>
            </div>
          `}
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

  function renderWholesaleSectionButton() {
    const cfg = wholesaleConfig(state);
    const products = wholesaleProducts(state);
    if (!wholesaleEnabled(state) || cfg.mostrarBotaoSecaoAtacado === false || !products.length) return '';
    return `
      <section class="wholesale-section-card">
        <button class="wholesale-section-button" type="button" data-wholesale-section>
          <span>💙</span>
          <strong>${escapeHtml(cfg.textoBotaoSecao || 'Compre em Atacado')}</strong>
          <small>${products.length} produto(s) com desconto por quantidade</small>
        </button>
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
    const homeSections = state.sections.filter(section => !isWholesaleSection(section, state));
    return `
      ${renderCustomerHeader()}
      <main class="page home-page" data-page="home">
        ${searchBox('Buscar produtos')}
        ${renderBannerCarousel()}
        ${filtered ? renderSearchResults(filtered, 'Resultados da busca') : homeSections.map(renderHomeSectionCarousel).join('')}
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
    const section = state.sectionId
      ? state.sections.find(item => item.id === state.sectionId)
      : null;
    const baseProducts = isWholesaleSection(section, state)
      ? (section?.products?.length ? section.products : wholesaleProducts(state))
      : state.products;
    const products = isWholesaleSection(section, state)
      ? filterProducts(baseProducts, state.query, '')
      : filterProducts(baseProducts, state.query, section?.id || '');
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
    const quantity = cartQty(state, product.id);
    const priceInfo = wholesalePriceInfo(product, quantity);
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
          ${renderWeightedProductControl(product)}
          <div class="product-price-line">
            ${productPriceBlock(product, quantity)}
          </div>
          ${renderWholesaleProgress(product, quantity)}
          <div class="detail-buy">
            <strong>${formatMoney(priceInfo.price || product.price || 0)}</strong>
            <button data-qty-plus="${escapeHtml(product.id)}" aria-label="Adicionar ao carrinho">+</button>
          </div>
        </section>
      </main>
    `;
  }

  function renderCart() {
    const items = cartItems(state);
    const itemCount = cartCount(state);
    const itemCountLabel = `${itemCount} ${itemCount === 1 ? 'item' : 'itens'}`;
    const useNativeTelegramButton = hasTelegramMainButton();
    const acceptsOrders = storeAcceptsOrders(state);
    const allowQuantityChange = state.checkout?.permitirAlterarQuantidade !== false;
    const allowClearCart = state.checkout?.permitirLimparCarrinho !== false;
    const miniAppPayment = isMiniAppPaymentEnabled(state);
    const paymentMethod = paymentMethodForCustomer(state);
    const finishLabel = miniAppPayment
      ? (paymentMethod === 'pix' ? 'Pagar com Pix' : 'Confirmar pedido')
      : 'Finalizar no Telegram';
    const checkoutSubtitle = acceptsOrders
      ? (miniAppPayment ? 'Revise antes de pagar no Mini App' : 'Revise antes de finalizar no Telegram')
      : 'Loja fechada para novos pedidos';
    const checkoutNote = acceptsOrders
      ? (miniAppPayment
          ? (paymentMethod === 'pix'
              ? 'Pix copia e cola, QR Code, recebedor, valor e numero do pedido aparecem no Mini App.'
              : 'Pagamento em dinheiro na entrega ou retirada. O painel recebera o pedido sem gerar Pix.')
          : 'Pix preservado: recebedor, valor e numero do pedido aparecem na confirmacao pelo Telegram.')
      : 'Loja fechada. A finalizacao sera liberada quando voltarmos a aceitar pedidos.';
    return `
      <main class="page cart-page" data-page="cart" id="cartDrawer">
        <div class="topbar page-brand-hero">
          <button data-page="${state.previousPage || 'home'}" aria-label="Voltar">${svgIcon('arrowLeft', 20)}</button>
          <div>
            <strong>Carrinho</strong>
            <small>${escapeHtml(checkoutSubtitle)}</small>
          </div>
          <img class="topbar-logo" src="${escapeHtml(logoSrc(state))}" alt="Mercadinho M&J" referrerpolicy="no-referrer">
          ${allowClearCart ? `<button data-clear-cart aria-label="Limpar carrinho">${svgIcon('trash', 18)}</button>` : '<span aria-hidden="true"></span>'}
        </div>
        ${items.length ? `
          <div class="cart-content">
            <section class="cart-products" aria-labelledby="cartItemsTitle">
              <div class="cart-section-heading">
                <div>
                  <strong id="cartItemsTitle">Itens do pedido</strong>
                  <small>Confira quantidades e valores</small>
                </div>
                <span>${escapeHtml(itemCountLabel)}</span>
              </div>
              <div class="cart-list">
                ${items.map(item => `
                  <article class="cart-item">
                    <div class="cart-thumb">
                      ${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" referrerpolicy="no-referrer" onerror="this.remove()">` : `<span class="cart-thumb-fallback" aria-hidden="true">${escapeHtml(String(item.name || 'P').slice(0, 1).toUpperCase())}</span>`}
                    </div>
                    <div class="cart-item-body">
                      <div class="cart-item-text">
                        <strong>${escapeHtml(item.name)}</strong>
                        <small>${escapeHtml(item.unit || 'un')} • ${formatMoney(item.price)} por ${escapeHtml(isWeightedProduct(item) ? (item.unit || 'kg') : 'unidade')}</small>
                        ${isWeightedProduct(item) ? `<small class="weighted-cart-notice">${escapeHtml(item.textoPesoAproximado || 'Peso aproximado; o valor final pode mudar apos a pesagem.')}</small>` : ''}
                        ${item.wholesaleApplied || item.atacado_aplicado ? `<small class="wholesale-cart-label">Atacado aplicado</small>` : ''}
                        ${item.sob_encomenda || item.sobEncomenda ? `<small class="wholesale-cart-label">${escapeHtml(item.previsao_retirada_texto ? `Somente sob encomenda • ${item.previsao_retirada_texto}` : 'Somente sob encomenda')}</small>` : ''}
                      </div>
                      <div class="cart-item-controls">
                        ${allowQuantityChange ? `
                          <div class="qty" aria-label="Quantidade de ${escapeHtml(item.name)}">
                            <button data-qty-minus="${escapeHtml(item.id)}" aria-label="Diminuir quantidade de ${escapeHtml(item.name)}">-</button>
                            <b>${escapeHtml(productQuantityLabel(item, item.quantity))}</b>
                            <button data-qty-plus="${escapeHtml(item.id)}" aria-label="Adicionar ${escapeHtml(item.name)} ao carrinho">+</button>
                          </div>
                        ` : `<div class="qty qty-readonly" aria-label="Quantidade ${escapeHtml(productQuantityLabel(item, item.quantity))}"><b>${escapeHtml(productQuantityLabel(item, item.quantity))}</b></div>`}
                        <div class="cart-item-total">
                          <small>${isWeightedProduct(item) ? 'Subtotal estimado' : 'Total do item'}</small>
                          <strong class="line-total">${formatMoney(cartLineSubtotal(item))}</strong>
                        </div>
                      </div>
                    </div>
                  </article>
                `).join('')}
              </div>
            </section>
          </div>
          <section class="total-card" aria-labelledby="cartSummaryTitle">
            <div class="cart-summary-heading">
              <strong id="cartSummaryTitle">Resumo do pedido</strong>
              <small>${escapeHtml(itemCountLabel)}</small>
            </div>
            ${miniAppPayment ? `
              <fieldset class="checkout-payment-method" aria-label="Forma de pagamento">
                <legend>Forma de pagamento</legend>
                <button type="button" class="checkout-payment-option${paymentMethod === 'pix' ? ' active' : ''}" data-payment-method="pix" aria-pressed="${paymentMethod === 'pix' ? 'true' : 'false'}">
                  <strong>Pix</strong><small>Copie o codigo ou use o QR Code</small>
                </button>
                <button type="button" class="checkout-payment-option${paymentMethod === 'dinheiro' ? ' active' : ''}" data-payment-method="dinheiro" aria-pressed="${paymentMethod === 'dinheiro' ? 'true' : 'false'}">
                  <strong>Dinheiro</strong><small>Pague na entrega ou retirada</small>
                </button>
              </fieldset>
            ` : ''}
            <div class="cart-summary-values">
              <div class="cart-summary-row"><span>Subtotal</span><strong>${formatMoney(cartTotal(state))}</strong></div>
              <div class="cart-summary-row summary-total"><span>Total</span><strong>${formatMoney(cartTotal(state))}</strong></div>
            </div>
            <p class="telegram-checkout-note">${escapeHtml(checkoutNote)}</p>
            <div class="card-actions${acceptsOrders && !useNativeTelegramButton ? '' : ' card-actions--single'}">
              <button id="continueShopping" data-page="${state.previousPage || 'home'}">Continuar comprando</button>
              ${acceptsOrders && !useNativeTelegramButton ? `<button id="finishInTelegram">${escapeHtml(finishLabel)}</button>` : ''}
            </div>
          </section>
        ` : `
          <section class="cart-empty-state">
            <span class="cart-empty-icon" aria-hidden="true">${svgIcon('bag', 28)}</span>
            <strong>Seu carrinho está vazio</strong>
            <small>Adicione produtos para montar seu pedido.</small>
            <button data-page="home" class="primary-wide">Continuar comprando</button>
          </section>
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
            const subtotal = Number(item.subtotal ?? cartLineSubtotal({ ...item, price: preco }, quantidade));
            return `
              <div>
                <span>${escapeHtml(productQuantityLabel(item, quantidade))}${isWeightedProduct(item) ? '' : 'x'} ${escapeHtml(item.nome || item.name || 'Produto')}</span>
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

  function renderMiniAppPayment() {
    const checkout = state.lastMiniAppCheckout || {};
    const pedido = state.pedidoAtual || checkout.pedido || checkout.ordem || checkout.order || {};
    const paymentMethod = String(
      pedido.formaPagamento || pedido.forma_pagamento || pedido.pagamento?.metodo || checkout.formaPagamento || state.selectedPaymentMethod || 'pix'
    ).trim().toLowerCase() === 'dinheiro' ? 'dinheiro' : 'pix';
    const orderAwaitingWeight = awaitingFinalWeightState(pedido);
    const awaitingWeight = orderAwaitingWeight === null
      ? isAwaitingFinalWeight(checkout)
      : orderAwaitingWeight;
    const pix = state.pix || checkout.pix || {};
    const itens = Array.isArray(pedido.itens) && pedido.itens.length
      ? pedido.itens
      : Array.isArray(checkout.itens) && checkout.itens.length
        ? checkout.itens
        : cartItems(state);
    const total = Number(pedido.total ?? pix.valor ?? cartTotal(state) ?? 0);
    const estimatedTotal = Number(
      pedido.totalEstimado ??
      pedido.total_estimado ??
      pedido.subtotalEstimado ??
      pedido.subtotal_estimado ??
      pedido.subtotal ??
      checkout.totalEstimado ??
      checkout.total_estimado ??
      pedido.total ??
      0
    );
    const pedidoId = String(pedido.id || checkout.pedidoId || '').trim();
    const copiaCola = String(pix.copiaCola || pix.pix || '').trim();
    const qrCodeDataUrl = String(pix.qrCodeDataUrl || pix.qrCode || '').trim();
    const receipt = `
      <section class="receipt">
        <h2>${svgIcon('receipt', 18)} Resumo</h2>
        ${itens.map(item => {
          const quantidade = Number(item.quantidade || item.qtd || item.quantity || 1);
          const subtotal = Number(item.subtotal ?? cartLineSubtotal(item, quantidade));
          return `
            <div>
              <span>${escapeHtml(productQuantityLabel(item, quantidade))}${isWeightedProduct(item) ? '' : 'x'} ${escapeHtml(item.nome || item.name || 'Produto')}</span>
              <strong>${formatMoney(subtotal)}</strong>
            </div>
          `;
        }).join('')}
      </section>
    `;
    if (awaitingWeight) {
      return `
        <main class="page telegram-checkout-panel success-screen" id="miniAppPaymentPanel" data-page="payment" data-awaiting-final-weight="true">
          <div class="topbar">
            <button data-page="orders" aria-label="Voltar">${svgIcon('arrowLeft', 20)}</button>
            <strong>Aguardando pesagem</strong>
            <span></span>
          </div>
          <section class="success-card telegram-handoff-card awaiting-weight-card">
            <span class="success-icon" aria-hidden="true">${svgIcon('clock', 38)}</span>
            <p class="greeting">Pedido recebido</p>
            <h1>Aguardando pesagem e valor final</h1>
            ${pedidoId ? `<strong class="order-id">Pedido ${escapeHtml(pedidoId)}</strong>` : ''}
            <p>${paymentMethod === 'dinheiro'
              ? 'A loja vai pesar os itens e confirmar o valor final antes do pagamento em dinheiro na entrega ou retirada.'
              : 'A loja vai pesar os itens e confirmar o valor final. O pagamento sera liberado somente depois dessa conferencia.'}</p>
            ${estimatedTotal > 0 ? `<p><strong>Estimativa atual: ${formatMoney(estimatedTotal)}</strong></p>` : ''}
          </section>
          ${receipt}
          <section class="telegram-success-actions">
            ${pedidoId
              ? `<button class="primary-wide" data-tracking-order="${escapeHtml(pedidoId)}">Acompanhar pedido</button>`
              : '<button class="primary-wide" data-page="orders">Acompanhar pedido</button>'}
            <button data-page="home">Voltar aos produtos</button>
          </section>
        </main>
      `;
    }
    if (paymentMethod === 'dinheiro') {
      return `
        <main class="page telegram-checkout-panel success-screen" id="miniAppPaymentPanel" data-page="payment" data-payment-method="dinheiro">
          <div class="topbar">
            <button data-page="orders" aria-label="Voltar">${svgIcon('arrowLeft', 20)}</button>
            <strong>Pedido confirmado</strong>
            <span></span>
          </div>
          <section class="success-card telegram-handoff-card">
            <span class="success-icon" aria-hidden="true">${svgIcon('check', 38)}</span>
            <p class="greeting">Pagamento em dinheiro</p>
            <h1>Pague na ${pedido.modalidadeEntrega === 'entrega' ? 'entrega' : 'retirada'}</h1>
            ${pedidoId ? `<strong class="order-id">Pedido ${escapeHtml(pedidoId)}</strong>` : ''}
            <p>${escapeHtml(state.checkoutMessage || `Pedido de ${formatMoney(total)} confirmado. Separe o valor para pagar quando receber ou retirar.`)}</p>
          </section>
          <section class="payment-cash-card">
            <div><span>Forma de pagamento</span><strong>Dinheiro</strong></div>
            <div><span>Total do pedido</span><strong>${formatMoney(total)}</strong></div>
            <small>Se precisar de troco, combine com a loja pelo Telegram.</small>
          </section>
          ${receipt}
          <section class="telegram-success-actions">
            <button class="primary-wide" data-page="orders">Acompanhar pedido</button>
            <button data-page="home">Voltar aos produtos</button>
          </section>
        </main>
      `;
    }
    return `
      <main class="page telegram-checkout-panel success-screen" id="miniAppPaymentPanel" data-page="payment">
        <div class="topbar">
          <button data-page="cart" aria-label="Voltar">${svgIcon('arrowLeft', 20)}</button>
          <strong>Pagamento</strong>
          <span></span>
        </div>
        <section class="success-card telegram-handoff-card">
          <span class="success-icon" aria-hidden="true">${svgIcon('receipt', 38)}</span>
          <p class="greeting">Pagamento no Mini App</p>
          <h1>Pix copia e cola</h1>
          ${pedidoId ? `<strong class="order-id">Pedido ${escapeHtml(pedidoId)}</strong>` : ''}
          <p>${escapeHtml(state.checkoutMessage || `Total de ${formatMoney(total)} gerado com recebedor e valor conferidos pelo backend.`)}</p>
        </section>
        <section class="payment-pix-card">
          ${qrCodeDataUrl ? `<img class="pix-qr-image" src="${escapeHtml(qrCodeDataUrl)}" alt="QR Code Pix">` : ''}
          <label for="pixCopyText">Pix copia e cola</label>
          <textarea id="pixCopyText" class="pix-copy-text" readonly rows="6">${escapeHtml(copiaCola)}</textarea>
          <div class="payment-details">
            <div><span>Valor</span><strong>${formatMoney(total)}</strong></div>
            <div><span>Recebedor</span><strong>${escapeHtml(pix.recebedor || 'Mercadinho M&J')}</strong></div>
            ${pix.txid ? `<div><span>TXID</span><strong>${escapeHtml(pix.txid)}</strong></div>` : ''}
          </div>
        </section>
        ${receipt}
        <section class="telegram-success-actions">
          <button class="primary-wide" id="copyPixPayment">Copiar Pix</button>
          <button data-page="orders">Acompanhar pedido</button>
          <button data-page="cart">Voltar ao carrinho</button>
        </section>
      </main>
    `;
  }

  function orderActionCapabilities(order = {}) {
    const actions = order.acoes || order.actions || {};
    const status = String(order.status || '').trim().toLowerCase();
    const explicitCancel = [actions.podeCancelar, actions.canCancel, order.podeCancelar, order.canCancel]
      .find(value => typeof value === 'boolean');
    return {
      canCancel: explicitCancel === undefined
        ? ['novo', 'recebido', 'pendente', 'aguardando_pesagem', 'aguardando_pagamento'].includes(status)
        : explicitCancel
    };
  }

  function renderOrderCustomerActions(order = {}) {
    const pedidoId = String(order.id || order.pedidoId || '').trim();
    if (!pedidoId) return '';
    const capabilities = orderActionCapabilities(order);
    const pending = state.orderActionPending === pedidoId;
    const actionMessage = state.orderActionMessageOrderId === pedidoId ? state.orderActionMessage : '';
    if (!capabilities.canCancel && !actionMessage) return '';
    return `
      <section class="order-customer-actions" aria-labelledby="orderActionsTitle">
        <div class="section-title">
          <h2 id="orderActionsTitle">Acoes do pedido</h2>
        </div>
        ${actionMessage ? `<p class="order-action-message" role="status">${escapeHtml(actionMessage)}</p>` : ''}
        ${capabilities.canCancel ? `
          <button type="button" class="order-cancel-button" id="cancelCurrentOrder" data-order-id="${escapeHtml(pedidoId)}" ${pending ? 'disabled' : ''}>
            ${pending ? 'Processando...' : 'Cancelar pedido'}
          </button>
          <small>Disponivel somente antes da separacao. O sistema confirma a situacao novamente antes de cancelar.</small>
        ` : ''}
      </section>
    `;
  }

  function renderOrders() {
    const orderId = order => String(order?.id || order?.pedidoId || '').trim();
    return `
      ${renderCustomerHeader('Meus pedidos')}
      <main class="page orders-panel" id="ordersPanel" data-page="orders">
        <div class="topbar">
          <button data-page="home">←</button>
          <strong>Meus pedidos</strong>
          <span></span>
        </div>
        <section class="orders-list">
          ${state.orders.length ? state.orders.map(order => {
            const awaitingWeight = isAwaitingFinalWeight(order);
            return `
            <article class="order-card"${awaitingWeight ? ' data-awaiting-final-weight="true"' : ''}>
              <strong>Pedido #${escapeHtml(orderId(order))}</strong>
              <span>${escapeHtml(awaitingWeight ? 'Aguardando pesagem e valor final' : (order.status || 'Em andamento'))}</span>
              <p>${escapeHtml(awaitingWeight ? 'O pagamento sera liberado apos a conferencia da loja.' : (order.pagamento?.status || order.status_pagamento || 'Aguardando pagamento'))}</p>
              <button data-tracking-order="${escapeHtml(orderId(order))}">${awaitingWeight ? 'Acompanhar pedido' : 'Acompanhar entrega'}</button>
            </article>
          `;
          }).join('') : '<div class="empty">Seus pedidos aparecerão aqui.</div>'}
        </section>
      </main>
    `;
  }

  function trackingModeForCustomer(tracking = state.tracking || {}) {
    const checkout = state.checkout || {};
    const raw = tracking.acompanhamentoModo ||
      tracking.modoAcompanhamentoCliente ||
      checkout.acompanhamentoModo ||
      checkout.modoAcompanhamentoCliente ||
      checkout.modo_acompanhamento_cliente ||
      'telegram';
    return String(raw).trim().toLowerCase() === 'miniapp' ? 'miniapp' : 'telegram';
  }

  function trackingPedidoAtual(tracking = state.tracking || {}) {
    const pedidoTracking = tracking?.pedido || tracking?.order || {};
    return {
      ...(state.pedidoAtual || {}),
      ...(pedidoTracking || {})
    };
  }

  function statusTrackingAtual(tracking = state.tracking || {}) {
    const pedido = trackingPedidoAtual(tracking);
    return String(pedido.status || tracking.status || '').trim().toLowerCase();
  }

  function trackingStatusLabel(status) {
    const labels = {
      aguardando_pesagem: 'Aguardando pesagem e valor final',
      aguardando_pagamento: 'Aguardando pagamento',
      pago: 'Pagamento confirmado',
      preparando: 'Em preparacao',
      pronto: 'Pedido pronto',
      saiu_entrega: 'Saiu para entrega',
      entregue: 'Entregue',
      cancelado: 'Cancelado'
    };
    return labels[status] || status || 'Aguardando atualizacao';
  }

  function trackingStepsForStatus(status = '', pagamentoStatus = '', awaitingWeight = false) {
    const atual = String(status || '').trim().toLowerCase();
    if (atual === 'cancelado') {
      return [{
        key: 'cancelado',
        title: 'Pedido cancelado',
        text: 'Status atualizado pelo painel',
        state: 'current'
      }];
    }
    if (awaitingWeight) {
      return [
        { key: 'recebido', title: 'Pedido recebido', text: 'Pedido registrado na loja', state: 'done' },
        { key: 'aguardando_pesagem', title: 'Pesagem dos itens', text: 'Aguardando conferencia e valor final', state: 'current' },
        { key: 'aguardando_pagamento', title: 'Pagamento', text: 'Sera liberado depois da pesagem', state: '' },
        { key: 'preparando', title: 'Em preparacao', text: 'Separacao dos produtos', state: '' },
        { key: 'entregue', title: 'Pedido finalizado', text: 'Retirada ou entrega concluida', state: '' }
      ];
    }
    const ordem = ['aguardando_pagamento', 'pago', 'preparando', 'pronto', 'saiu_entrega', 'entregue'];
    const indice = Math.max(0, ordem.indexOf(atual));
    const pagamentoOk = ['pago', 'confirmado', 'aprovado', 'paid'].includes(String(pagamentoStatus || '').trim().toLowerCase());
    return [
      { key: 'aguardando_pagamento', title: 'Pedido recebido', text: 'Pedido registrado na loja' },
      { key: 'pago', title: 'Pagamento confirmado', text: pagamentoOk || indice >= 1 ? 'Pagamento liberado' : 'Aguardando confirmacao' },
      { key: 'preparando', title: 'Em preparacao', text: 'Separacao dos produtos' },
      { key: 'pronto', title: 'Pedido pronto', text: 'Aguardando retirada ou entrega' },
      { key: 'saiu_entrega', title: 'Saiu para entrega', text: 'Entrega em andamento' },
      { key: 'entregue', title: 'Entregue', text: 'Pedido finalizado' }
    ].map((step, stepIndex) => ({
      ...step,
      state: stepIndex < indice ? 'done' : stepIndex === indice ? 'current' : ''
    }));
  }

  function renderTrackingStep(step, index) {
    const marker = step.state === 'done' ? svgIcon('check', 18) : String(index + 1);
    const classe = ['tracking-step', step.state].filter(Boolean).join(' ');
    return `<div class="${escapeHtml(classe)}"><span>${marker}</span><div><strong>${escapeHtml(step.title)}</strong><p>${escapeHtml(step.text)}</p></div></div>`;
  }

  function renderTracking() {
    const tracking = state.tracking || {};
    const pedido = trackingPedidoAtual(tracking);
    const statusAtual = statusTrackingAtual(tracking);
    const awaitingWeight = isAwaitingFinalWeight(pedido, tracking);
    const detalhe = pedido.statusDetalhe || tracking.statusDetalhe || {};
    const mapa = mapFromTrackingPayload(tracking);
    const mapaUrl = mapa.mapaUrl || '';
    const status = awaitingWeight ? 'Aguardando pesagem e valor final' : (detalhe.label || trackingStatusLabel(statusAtual));
    const modo = trackingModeForCustomer(tracking);
    const pagamentoStatus = pedido.pagamento?.status || pedido.statusPagamento || pedido.status_pagamento || '';
    const resumo = modo === 'miniapp'
      ? 'Status sincronizado com o painel.'
      : 'Atualizacoes seguem pelo Telegram.';
    const entregaAtiva = String(pedido.modalidadeEntrega || pedido.modalidade_entrega || '').toLowerCase() === 'entrega' || pedido.retiradaNoLocal === false;
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
          <p>${escapeHtml(awaitingWeight
            ? 'A loja esta pesando os itens. O pagamento sera liberado quando o valor final estiver confirmado.'
            : (detalhe.mensagem || tracking?.previsao || tracking?.mensagem || resumo))}</p>
        </section>
        <section class="tracking-summary-card">
          <h2>Resumo</h2>
          <p>${escapeHtml(tracking?.resumo || `Pedido #${pedido.id || pedido.pedidoId || ''} - ${resumo}`)}</p>
        </section>
        <section class="tracking-timeline">
          ${trackingStepsForStatus(statusAtual, pagamentoStatus, awaitingWeight).map(renderTrackingStep).join('')}
        </section>
        ${renderOrderCustomerActions(pedido)}
        <section class="tracking-map-card">
          ${mapaUrl ? `
            <a class="track-map" href="${escapeHtml(mapaUrl)}" target="_blank" rel="noopener">Abrir localizacao ao vivo do entregador</a>
            <p>${escapeHtml(mapa.mensagem || 'Mesmo mapa compartilhado pelo entregador no Telegram.')}</p>
            ${mapa.atualizadaEm ? `<small>Atualizada em ${escapeHtml(mapa.atualizadaEm)}</small>` : ''}
          ` : `
            <div class="map-road"></div><div class="map-pin"></div>
            <p>${escapeHtml(entregaAtiva ? 'Aguardando o entregador compartilhar a localizacao ao vivo.' : 'Pedido sem entrega ao vivo no momento.')}</p>
          `}
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
            ${profileItem('Telefone', cliente.telefone || cliente.phone)}
            ${profileItem('CPF', cliente.cpf)}
            ${profileItem('Nascimento', cliente.dataNascimento)}
            ${profileItem('Endereco', endereco)}
          </div>
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

  async function finishCheckout() {
    if (state.sending) return;
    if (!storeAcceptsOrders(state)) {
      state.sending = false;
      state.checkoutMessage = 'Loja fechada. A finalizacao sera liberada quando voltarmos a aceitar pedidos.';
      if (state.page !== 'cart') navigateTo('cart');
      else render();
      return;
    }
    if (!cartCount(state)) {
      navigateTo('home');
      return;
    }
    state.sending = true;
    const modoPagamento = paymentModeForCustomer(state);
    sendMiniAppEvent(state, modoPagamento === 'miniapp' ? 'checkout_miniapp_payment_start' : 'checkout_telegram_handoff_start', { itemCount: cartCount(state), total: cartTotal(state) });
    const result = await checkoutCreate(state);
    const resultOrder = result?.pedido || result?.ordem || result?.order || null;
    const resultPaymentMethod = String(
      resultOrder?.formaPagamento || resultOrder?.forma_pagamento || resultOrder?.pagamento?.metodo || state.selectedPaymentMethod || 'pix'
    ).trim().toLowerCase() === 'dinheiro' ? 'dinheiro' : 'pix';
    const resultAwaitingWeight = isAwaitingFinalWeight(result, result?.checkout, resultOrder);
    const resultMode = String(result?.checkout?.modo || result?.modo || '').trim().toLowerCase();
    const resultModeMiniApp = resultMode === 'miniapp' || resultAwaitingWeight || (!resultMode && Boolean(result?.pix));
    if (resultModeMiniApp) {
      state.lastMiniAppCheckout = result || {};
      state.pedidoAtual = resultOrder || state.pedidoAtual || null;
      state.pix = resultAwaitingWeight ? null : (result?.pix || null);
      if (state.pedidoAtual) applyOrderStatusToState(state, { pedido: state.pedidoAtual });
      clearCart(state);
      completeCheckoutAttempt(state);
      state.checkoutMessage = resultAwaitingWeight
        ? 'Pedido recebido. Aguardando pesagem e confirmacao do valor final.'
        : (result?.mensagem || result?.message || (resultPaymentMethod === 'dinheiro'
            ? 'Pedido confirmado. O pagamento em dinheiro sera feito na entrega ou retirada.'
            : 'Pix gerado no Mini App. Copie o codigo ou use o QR Code para pagar.'));
      state.sending = false;
      renderer.navigateTo('payment');
      return;
    }
    state.lastTelegramHandoff = result || {};
    state.checkoutMessage = result?.telegram?.mensagem || result?.mensagem || result?.message || 'Carrinho enviado ao Telegram. Escolha a forma de pagamento pelo chat.';
    state.sending = false;
    renderer.navigateTo('telegram-checkout');
    const webApp = window.Telegram?.WebApp;
    if (webApp?.close && (result?.ok !== false || result?.fallback === true)) {
      webApp.close();
    }
  }

  function applyCustomerOrderAction(pedidoId, result = {}, extra = {}) {
    const current = trackingPedidoAtual(state.tracking || {});
    const pedido = {
      ...current,
      ...(result.pedido || {}),
      ...extra,
      id: String(result.pedido?.id || current.id || pedidoId)
    };
    applyOrderStatusToState(state, { ...result, pedido });
    state.tracking = {
      ...(state.tracking || {}),
      pedido: {
        ...(state.tracking?.pedido || {}),
        ...pedido
      }
    };
    return pedido;
  }

  async function handleCancelCurrentOrder(button) {
    const pedidoId = String(button?.dataset?.orderId || '').trim();
    if (!pedidoId || state.orderActionPending) return;
    if (typeof window.confirm === 'function' && !window.confirm('Cancelar este pedido? A loja confirmara se ele ainda pode ser cancelado.')) return;
    state.orderActionPending = pedidoId;
    state.orderActionMessage = '';
    state.orderActionMessageOrderId = pedidoId;
    render();
    try {
      const result = await cancelOrder(state, pedidoId);
      applyCustomerOrderAction(pedidoId, result, { status: result?.pedido?.status || 'cancelado' });
      state.orderActionMessage = result?.mensagem || 'Pedido cancelado com sucesso.';
    } catch (error) {
      state.orderActionMessage = error?.message || 'Nao foi possivel cancelar o pedido.';
    } finally {
      state.orderActionPending = '';
      render();
    }
  }

  async function refreshActiveOrderFlow() {
    const pedidoId = activeOrderId(state);
    if (!pedidoId || !['payment', 'tracking'].includes(state.page) || state.__orderFlowRefreshing) return;
    state.__orderFlowRefreshing = true;
    try {
      if (state.page === 'payment') {
        const status = await loadOrderStatus(state, pedidoId);
        if (!status) return;
        const previousPix = JSON.stringify(state.pix || null);
        const result = applyOrderStatusToState(state, status);
        const refreshedWeightState = awaitingFinalWeightState(status, result.order);
        if (refreshedWeightState === true) state.pix = null;
        else if (refreshedWeightState === false) {
          if (state.lastMiniAppCheckout?.checkout) {
            state.lastMiniAppCheckout.checkout = {
              ...state.lastMiniAppCheckout.checkout,
              aguardandoPesagem: false
            };
          }
          if (state.lastMiniAppCheckout) state.lastMiniAppCheckout.aguardandoPesagem = false;
          if (status.pix || result.order?.pix) state.pix = status.pix || result.order.pix;
        } else if (status.pix || result.order?.pix) state.pix = status.pix || result.order.pix;
        if (shouldOpenTrackingAfterPayment(state, result.order)) {
          state.tracking = null;
          navigateTo('tracking');
          return;
        }
        if (result.changed || previousPix !== JSON.stringify(state.pix || null)) render();
        return;
      }

      const tracking = await loadTracking(state, pedidoId);
      const result = applyTrackingToState(state, tracking || {});
      if (result.changed) render();
      const finalStatus = result.order?.status || state.tracking?.pedido?.status || state.tracking?.status || '';
      if (isFinalOrderStatus(finalStatus)) stopOrderFlowPolling();
    } catch {
      // The Mini App keeps the last known status and retries on the next cycle.
    } finally {
      state.__orderFlowRefreshing = false;
    }
  }

  function stopOrderFlowPolling() {
    if (state.__orderFlowTimer) {
      window.clearInterval(state.__orderFlowTimer);
      state.__orderFlowTimer = null;
    }
    state.__orderFlowTimerKey = '';
    state.__orderFlowTimerMs = 0;
  }

  function syncOrderFlowPolling() {
    const pedidoId = activeOrderId(state);
    const active = Boolean(pedidoId && ['payment', 'tracking'].includes(state.page));
    if (!active) {
      stopOrderFlowPolling();
      return;
    }
    const ms = orderFlowPollingMs(state);
    const key = `${state.page}:${pedidoId}`;
    if (state.__orderFlowTimer && state.__orderFlowTimerKey === key && state.__orderFlowTimerMs === ms) return;
    stopOrderFlowPolling();
    state.__orderFlowTimerKey = key;
    state.__orderFlowTimerMs = ms;
    state.__orderFlowTimer = window.setInterval(() => refreshActiveOrderFlow(), ms);
    window.setTimeout(() => refreshActiveOrderFlow(), 0);
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
    root.querySelectorAll('[data-menu-page]').forEach(button => {
      button.addEventListener('click', () => {
        const page = button.dataset.menuPage || 'home';
        state.sectionsMenuOpen = false;
        state.pageMenuOpen = false;
        navigateTo(page);
      });
    });
    root.querySelectorAll('[data-tracking-order]').forEach(button => {
      button.addEventListener('click', () => {
        const pedidoId = String(button.dataset.trackingOrder || '').trim();
        const order = (state.orders || []).find(item => String(item.id || item.pedidoId || '').trim() === pedidoId) || null;
        if (order) state.pedidoAtual = order;
        state.tracking = null;
        state.orderActionMessage = '';
        state.orderActionMessageOrderId = '';
        navigateTo('tracking');
      });
    });
    root.querySelectorAll('[data-open-sections]').forEach(button => {
      button.addEventListener('click', () => {
        if (!sectionsMenuEnabled()) return;
        state.sectionsMenuOpen = true;
        state.pageMenuOpen = false;
        render();
      });
    });
    root.querySelectorAll('[data-open-pages]').forEach(button => {
      button.addEventListener('click', () => {
        state.sectionsMenuOpen = false;
        state.pageMenuOpen = true;
        render();
      });
    });
    root.querySelectorAll('[data-section-open]').forEach(button => {
      button.addEventListener('click', () => {
        navigateTo('products', { sectionId: button.dataset.sectionOpen, query: '' });
      });
    });
    root.querySelectorAll('[data-wholesale-section]').forEach(button => {
      button.addEventListener('click', () => {
        navigateTo('products', { sectionId: wholesaleSection(state)?.id || wholesaleSectionId(state), query: '' });
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
    root.querySelectorAll('[data-close-pages]').forEach(element => {
      element.addEventListener('click', () => {
        state.pageMenuOpen = false;
        render();
      });
    });
    root.querySelector('#sectionsDrawer')?.addEventListener('click', event => event.stopPropagation());
    root.querySelector('#pagesDrawer')?.addEventListener('click', event => event.stopPropagation());
    root.querySelectorAll('[data-product-open]').forEach(button => {
      button.addEventListener('click', () => {
        state.productId = button.dataset.productOpen;
        navigateTo('product');
      });
    });
    bindBannerControls(root);
    root.querySelectorAll('[data-action="set-weight"]').forEach(button => {
      button.addEventListener('click', () => {
        const product = state.products.find(item => item.id === button.dataset.weightProductId);
        if (!product) return;
        setQty(state, product, Number(button.dataset.weightValue || 0));
        syncCart(state, { itens: cartItems(state) });
        render();
      });
    });
    root.querySelectorAll('[data-qty-plus]').forEach(button => {
      button.addEventListener('click', () => {
        const product = state.products.find(item => item.id === button.dataset.qtyPlus);
        if (!product) return;
        const before = wholesaleProgress(product, cartQty(state, product.id));
        const nextQuantity = changeQty(state, product, 1);
        const after = wholesaleProgress(product, nextQuantity);
        syncCart(state, { itens: cartItems(state) });
        updateWholesaleProgress(product.id);
        render();
        if (after.active && after.reached && !before.reached) {
          state.wholesaleCelebrated = state.wholesaleCelebrated || {};
          state.wholesaleCelebrated[product.id] = Date.now();
          window.setTimeout(() => {
            triggerWholesaleFireworks(productElement(root, product.id) || root.querySelector('.detail-content'));
          }, 0);
        }
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
      if (state.checkout?.permitirLimparCarrinho === false) return;
      if (typeof window.confirm === 'function' && !window.confirm('Limpar todos os itens do carrinho?')) return;
      clearCart(state);
      render();
    });
    root.querySelector('#continueShopping')?.addEventListener('click', () => navigateTo(state.previousPage || 'home'));
    root.querySelectorAll('[data-payment-method]').forEach(button => {
      button.addEventListener('click', () => {
        state.selectedPaymentMethod = button.dataset.paymentMethod === 'dinheiro' ? 'dinheiro' : 'pix';
        state.clientOrderId = '';
        state.clientOrderFingerprint = '';
        render();
      });
    });
    root.querySelector('#finishInTelegram')?.addEventListener('click', finishCheckout);
    root.querySelector('#retryTelegramHandoff')?.addEventListener('click', finishCheckout);
    root.querySelector('#cancelCurrentOrder')?.addEventListener('click', event => {
      handleCancelCurrentOrder(event.currentTarget);
    });
    root.querySelector('#copyPixPayment')?.addEventListener('click', () => {
      const pix = state.pix?.copiaCola || state.lastMiniAppCheckout?.pix?.copiaCola || '';
      if (!pix) return;
      navigator.clipboard?.writeText(pix).catch(() => null);
    });
    root.querySelector('#search')?.addEventListener('input', event => {
      state.query = event.target.value;
      state.searchInputFocus = {
        start: Number(event.target.selectionStart ?? state.query.length),
        end: Number(event.target.selectionEnd ?? state.query.length)
      };
      render();
    });

    root.querySelector('#goToTracking')?.addEventListener('click', () => {
      navigateTo('tracking');
    });

    root.querySelector('#trackingPanel')?.classList.add('active-page');
  }

  function render() {
    let html = '';
    const activeUi = normalizeMiniAppUi(state.miniappUi || state.miniappui || {});
    if (!miniappStoreIsAvailable(state)) {
      if (state.__bannerAutoTimer) window.clearTimeout(state.__bannerAutoTimer);
      state.__bannerAutoTimer = null;
      root.className = 'mj-fresh-app store-unavailable-app';
      root.innerHTML = renderStoreUnavailable();
      window.Telegram?.WebApp?.MainButton?.hide?.();
      return;
    }
    if (state.page === 'product' && !productDetailsEnabled(activeUi)) {
      state.page = state.previousPage || 'home';
      if (state.page === 'product') state.page = 'home';
      state.productId = '';
      persistMiniAppUiState(state);
    }
    const splashDuration = clampMs(activeUi.splash?.durationMs, MINIAPP_UI_DEFAULTS.splash.durationMs);
    applyThemeVariables(activeUi);
    document.documentElement.style.setProperty('--mj-splash-duration', `${splashDuration}ms`);
    if (state.page === 'categories') html = renderCategories();
    else if (state.page === 'products') html = renderProducts();
    else if (state.page === 'product') html = renderProductDetail();
    else if (state.page === 'cart') html = renderCart();
    else if (state.page === 'payment') html = renderMiniAppPayment();
    else if (['delivery', 'telegram-checkout'].includes(state.page)) html = renderTelegramCheckout();
    else if (state.page === 'orders') html = renderOrders();
    else if (state.page === 'tracking') html = renderTracking();
    else if (state.page === 'profile') html = renderProfile();
    else html = renderHome();

    root.className = 'mj-fresh-app';
    root.innerHTML = `${renderSplash()}${html}${stickyCart()}${renderDebugOverlay()}<div id="productSheet" hidden></div>`;
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
      const warningTarget = copyNode.closest('.payment-pix-card') || copyNode.parentElement;
      warningTarget?.insertAdjacentHTML(
        'afterbegin',
        `<p class="checkout-warning">${escapeHtml(state.checkoutMessage)}</p>`
      );
    }
    bind();
    if (state.searchInputFocus) {
      const searchInput = root.querySelector('#search');
      if (searchInput) {
        const { start, end } = state.searchInputFocus;
        searchInput.focus({ preventScroll: true });
        searchInput.setSelectionRange?.(start, end);
      }
      state.searchInputFocus = null;
    }
    scheduleBannerAutoSlide(activeUi);
    syncOrderFlowPolling();
  }

  const renderer = { render, navigateTo, finishCheckout, refreshActiveOrderFlow };
  return renderer;
}


