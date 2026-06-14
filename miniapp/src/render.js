const WEIGHTED_RENDER_MARKERS = [
  'Produto vendido por peso. O valor final pode mudar apos a pesagem na loja.',
  'data-action="set-weight"',
  'function productBadges'
];
const STORE_STATUS_LABELS = ['Pedidos pausados', 'Fechado para pedidos'];
const DURGER_COMPATIBILITY_MARKERS = [
  'durger-catalog',
  'durger-card',
  'durger-badge',
  'SEU PEDIDO',
  'Finalizar no Telegram',
  'escapeHtml(item.image)',
  'referrerpolicy="no-referrer"'
];

const RUNTIME_LOGO_BUILD = String(globalThis?.__MJ_LOGO_BUILD || '').trim();
const MINIAPP_UI_DEFAULTS = {
  header: { logo: '/assets/logo-mj-mercadinho.png' },
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
    logo: '/assets/logo-mj-mercadinho.png',
    mode: 'logo',
    mediaUrl: '',
    animation: 'fade',
    background: '#ed000b',
    gradientFrom: '#ff3b4b',
    gradientTo: '#ed000b',
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
function resolveBuildFromHtml() {
  const styles = globalThis.document?.getElementById?.('mainStylesheet');
  const href = String(styles?.getAttribute?.('href') || '');
  const byHref = href.match(/[?&]v=([^&]+)/)?.[1];
  const byQuery = globalThis.location?.searchParams?.get?.('v');
  return String(byHref || byQuery || '').trim();
}

import { cartCount, cartItems, cartQty, cartTotal, changeQty, clearCart } from './cart.js';
import { filterProducts, productBadges } from './catalog.js';
import { telegramHandoff } from './checkout.js';
import { sendMiniAppEvent, syncCart } from './api.js';
import { escapeHtml, greetingFor, money } from './utils.js';
import { persistMiniAppUiState } from './storage.js';
import { updateMainButton } from './telegram.js';
import { loadTracking } from './tracking.js';

const LOGO_ASSET_URL = new URL('../assets/logo-mj-mercadinho.png', import.meta.url).href;

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
  const animation = String(cfg.splash?.animation || MINIAPP_UI_DEFAULTS.splash.animation).toLowerCase();
  const bannerCarousel = cfg.bannerCarousel && typeof cfg.bannerCarousel === 'object' ? cfg.bannerCarousel : {};
  const bannerAnimation = String(bannerCarousel.animation || MINIAPP_UI_DEFAULTS.bannerCarousel.animation).trim().toLowerCase();
  const banners = Array.isArray(cfg.banners) && cfg.banners.length ? cfg.banners : MINIAPP_UI_DEFAULTS.banners;
  return {
    header: {
      logo: String((cfg.header && cfg.header.logo) || MINIAPP_UI_DEFAULTS.header.logo).trim() || MINIAPP_UI_DEFAULTS.header.logo
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
    banners: banners.map(normalizeBanner).sort((a, b) => Number(a.order || 0) - Number(b.order || 0) || String(a.title).localeCompare(String(b.title), 'pt-BR'))
  };
}

function resolveAssetUrl(value, fallback) {
  const raw = String(value || '').trim();
  const fallbackValue = String(fallback || LOGO_ASSET_URL).trim() || LOGO_ASSET_URL;
  if (!raw) return fallbackValue;
  if (/^(https?:\/\/|data:|blob:)/i.test(raw) || raw.startsWith('/')) return raw;
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
  document.body.dataset.miniappTheme = 'verde_fresco';
  root.style.setProperty('--mj-primary', theme.primary || MINIAPP_UI_DEFAULTS.theme.primary);
  root.style.setProperty('--mj-primary-soft', theme.primarySoft || MINIAPP_UI_DEFAULTS.theme.primarySoft);
  root.style.setProperty('--mj-bg', theme.bg || MINIAPP_UI_DEFAULTS.theme.bg);
  root.style.setProperty('--mj-card', theme.card || MINIAPP_UI_DEFAULTS.theme.card);
  root.style.setProperty('--mj-text', theme.text || MINIAPP_UI_DEFAULTS.theme.text);
  root.style.setProperty('--mj-muted', theme.muted || MINIAPP_UI_DEFAULTS.theme.muted);
  root.style.setProperty('--mj-border', theme.border || MINIAPP_UI_DEFAULTS.theme.border);
  root.style.setProperty('--mj-header-gradient-from', theme.heroFrom || MINIAPP_UI_DEFAULTS.theme.heroFrom);
  root.style.setProperty('--mj-header-gradient-to', theme.heroTo || MINIAPP_UI_DEFAULTS.theme.heroTo);
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
  const isClosed = state.store?.status === 'fechada' || state.store?.aceitaPedidos === false;
  return {
    className: isClosed ? 'closed' : 'open',
    text: state.store?.mensagem || (isClosed ? 'Fechado para pedidos' : 'Aberto agora')
  };
}

function productThumb(product) {
  const fallback = `<span class="product-thumb-fallback" aria-hidden="true">${escapeHtml((product?.name || 'P').slice(0, 1).toUpperCase())}</span>`;
  if (!product?.image) {
    return fallback;
  }
  return `${fallback}<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name || 'Produto')}" loading="lazy" referrerpolicy="no-referrer" onload="this.previousElementSibling.hidden=true" onerror="this.remove()">`;
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
      <section class="miniapp-splash" id="miniappSplash" data-splash-animation="${escapeHtml(splashAnimation)}" aria-label="Carregando Mercadinho M&J">
        ${splashMedia(ui)}
      </section>
    `;
  }

  function navigateTo(page, options = {}) {
    state.previousPage = state.page || 'home';
    state.page = page || 'home';
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

  function renderCustomerHeader(title = '') {
    const name = customerName(state);
    const greeting = customerGreetingPrefix(new Date());
    const points = customerPoints(state);
    const status = normalizeStoreStatus(state);
    return `
      <header class="market-hero" id="marketHero">
        <div class="hero-top">
          <div class="hero-brand-block">
            <img src="${logoSrc(state)}" alt="Mercadinho M&J" class="brand-logo">
            <div class="hero-copy">
              <p class="greeting" id="customerGreeting">${escapeHtml(greeting)}, <span class="customer-name">${escapeHtml(name)}</span></p>
              <h1>${escapeHtml(title || 'O que vamos comprar hoje?')}</h1>
            </div>
          </div>
          <button class="icon-button" data-page="cart" aria-label="Ver carrinho">
            🛒
            <b>${cartCount(state)}</b>
          </button>
        </div>
        <div class="hero-status-row">
          <p class="points-line">⭐ ${points} pontos</p>
          <div class="store-status ${status.className}" id="storeStatus">${escapeHtml(status.text)}</div>
        </div>
      </header>
    `;
  }

  function searchBox(placeholder = 'Buscar produtos') {
    return `
      <label class="search-box">
        <span aria-hidden="true">🔍</span>
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
    return `<span class="durger-badge"${style ? ` style="${escapeHtml(style)}"` : ''}>${escapeHtml(text)}</span>`;
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
    const label = points === 1 ? 'ponto' : 'pontos';
    return `<span class="product-points-chip">+ ${points} ${label}</span>`;
  }

  function renderProductOverlayStack(product = {}, badges = productBadges(product).slice(0, 2)) {
    const items = [
      ...badges.map(renderProductPhotoBadge),
      renderProductPointsChip(product)
    ].filter(Boolean);
    return items.length ? `<div class="product-overlay-stack">${items.join('')}</div>` : '';
  }

  function productCard(product) {
    const quantity = cartQty(state, product.id);
    const badges = productBadges(product).slice(0, 2);
    const brand = String(product.marca || product.brand || '').trim();
    const description = String(product.descricao || product.description || '').trim();
    return `
      <article class="product-card mini-product-card durger-card" data-product-id="${escapeHtml(product.id)}">
        <div class="product-media-frame">
          <button class="product-image" data-product-open="${escapeHtml(product.id)}" aria-label="Abrir ${escapeHtml(product.name)}">
            ${productThumb(product)}
            ${renderProductOverlayStack(product, badges)}
          </button>
        </div>
        <div class="product-info">
          <h3>${escapeHtml(product.name)}</h3>
          ${brand ? `<span class="product-brand">${escapeHtml(brand)}</span>` : ''}
          ${description ? `<p class="product-description">${escapeHtml(description)}</p>` : ''}
        </div>
        <div class="product-buy-row${quantity ? ' product-buy-row--quantity' : ''}">
          <div class="product-price-block">${productPriceBlock(product)}</div>
          <div class="product-actions${quantity ? ' product-actions--quantity' : ''}">
            ${quantity ? `
              <button data-qty-minus="${escapeHtml(product.id)}" aria-label="Diminuir quantidade">-</button>
              <b>${quantity}</b>
              <button class="product-quick-add" data-qty-plus="${escapeHtml(product.id)}" aria-label="Adicionar ao carrinho: ${escapeHtml(product.name)}">+</button>
            ` : `
              <button class="add-button product-quick-add" data-qty-plus="${escapeHtml(product.id)}" aria-label="Adicionar ao carrinho: ${escapeHtml(product.name)}">
                +
              </button>
            `}
          </div>
        </div>
      </article>
    `;
  }

  function renderSectionMenuIcon(section = {}) {
    const emoji = String(section.icon || section.emoji || '🧺').trim() || '🧺';
    return `<span class="section-menu-icon-emoji" aria-hidden="true">${escapeHtml(emoji)}</span>`;
  }

  function renderSectionMenu() {
    return `
      <nav class="section-menu" id="categoryRail" aria-label="Seções">
        ${state.sections.map(section => `
          <button data-section-open="${escapeHtml(section.id)}">
            ${renderSectionMenuIcon(section)}
            ${escapeHtml(section.name)}
          </button>
        `).join('')}
      </nav>
    `;
  }

  function renderHomeSectionCarousel(section = {}) {
    return `
      <section class="product-rail">
        <div class="section-title">
          <h2>${escapeHtml(section.icon || '🧺')} ${escapeHtml(section.name || 'Seção')}</h2>
          <button data-section-open="${escapeHtml(section.id)}">Ver todos</button>
        </div>
        <div class="rail-scroll">
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
        <div class="section-title">
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
    const ui = normalizeMiniAppUi(state.miniappUi || state.miniappui || {});
    return `
      ${renderCustomerHeader()}
      <main class="page home-page" data-page="home">
        ${searchBox('Buscar produtos')}
        ${renderBannerCarousel(ui)}
        ${renderSectionMenu()}
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
    const brand = String(product.marca || product.brand || '').trim();
    const description = String(product.descricao || product.description || product.unit || '').trim();
    return `
      ${renderCustomerHeader(product?.name || 'Produto')}
      <main class="page product-page" data-page="product">
        <div class="topbar">
          <button data-page="${state.previousPage || 'home'}">←</button>
          <strong>Detalhes</strong>
          <button data-page="cart">🛒</button>
        </div>
        <div class="detail-image">
          ${productThumb(product)}
          ${renderProductOverlayStack(product, badges)}
        </div>
        <section class="detail-content">
          <h1>${escapeHtml(product.name)}</h1>
          ${brand ? `<span class="product-brand detail-brand">Marca: ${escapeHtml(brand)}</span>` : ''}
          ${description ? `<p class="product-description">${escapeHtml(description)}</p>` : ''}
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
    return `
      ${renderCustomerHeader('Carrinho')}
      <main class="page cart-page" data-page="cart" id="cartDrawer">
        <div class="topbar">
          <button data-page="${state.previousPage || 'home'}">←</button>
          <strong>Carrinho</strong>
          <button data-clear-cart>Limpar</button>
        </div>
        ${items.length ? `
          <section class="cart-list">
            ${items.map(item => `
              <article class="cart-item">
              <div class="cart-thumb">
                  ${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">` : escapeHtml(String(item.name || 'P').slice(0, 1).toUpperCase())}
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
            <div><span>Total</span><strong>${formatMoney(cartTotal(state))}</strong></div>
            <p class="telegram-checkout-note">Entrega, retirada, pontos e Pix continuam no Telegram.</p>
            <div class="card-actions">
              <button id="continueShopping" data-page="${state.previousPage || 'home'}">Continuar comprando</button>
              <button id="finishInTelegram">Finalizar no Telegram</button>
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
    return `
      ${renderCustomerHeader('Finalizar pedido')}
      <main class="page telegram-checkout-panel" id="telegramCheckoutPanel" data-page="telegram-checkout">
        <div class="topbar">
          <button data-page="cart">←</button>
          <strong>Telegram</strong>
          <span></span>
        </div>
        <section class="checkout-card telegram-handoff-card">
          <img src="${logoSrc(state)}" alt="Mercadinho M&J">
          <h2>Continue pelo Telegram</h2>
          <p>${escapeHtml(state.checkoutMessage || 'Seu pedido foi enviado para o Telegram. Defina entrega, pontos e pagamento diretamente no chat.')}</p>
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
    return `
      ${renderCustomerHeader('Acompanhar pedido')}
      <main class="page tracking-panel" id="trackingPanel" data-page="tracking">
        <div class="topbar">
          <button data-page="orders">←</button>
          <strong>Acompanhar entrega</strong>
          <span></span>
        </div>
        <section class="checkout-card">
          <h2>Pedido em andamento</h2>
          <p>${escapeHtml(tracking?.status || 'Aguardando atualização do status.')}</p>
          ${mapaUrl ? `<a class="track-map" href="${escapeHtml(mapaUrl)}" target="_blank" rel="noopener">Abrir no Maps</a>` : '<div class="fake-map">Acompanhe aqui quando o pedido for confirmado.</div>'}
        </section>
        <section class="loyalty-hero" id="loyaltyPanel">
          <h2>Meus pontos</h2>
          <strong>⭐ ${Number(state.loyalty?.saldoPontos || 0)} pontos</strong>
        </section>
      </main>
    `;
  }

  function renderLoyalty() {
    const pontos = Number(state.loyalty?.saldoPontos || 0);
    const saldoReais = Number(state.loyalty?.saldoReais || 0);
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
      <div class="sticky-cart" id="stickyCartBar">
        <span>🛒 ${count} itens • ${formatMoney(cartTotal(state))}</span>
        <button id="reviewCart" data-page="cart">Ver carrinho</button>
      </div>
    `;
  }

  function bottomNav() {
    const item = (page, icon, label) => `
      <button class="${state.page === page ? 'active' : ''}" data-page="${page}">
        <span aria-hidden="true">${icon}</span>
        ${label}
      </button>
    `;
    return `
      <nav class="miniapp-bottom-nav">
        ${item('home', '🏠', 'Início')}
        ${item('categories', '🔍', 'Buscar')}
        ${item('cart', '🛒', 'Carrinho')}
        ${item('orders', '📦', 'Pedidos')}
        ${item('profile', '👤', 'Conta')}
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
    state.checkoutMessage = result?.telegram?.mensagem || result?.mensagem || result?.message || 'Carrinho enviado ao Telegram. Termine entrega, retirada e Pix pelo chat.';
    state.sending = false;
    renderer.navigateTo('telegram-checkout');
    const webApp = window.Telegram?.WebApp;
    if (webApp?.close && (result?.ok !== false || result?.fallback === true)) {
      window.setTimeout(() => webApp.close(), 800);
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
    root.querySelectorAll('[data-section-open]').forEach(button => {
      button.addEventListener('click', () => {
        navigateTo('products', { sectionId: button.dataset.sectionOpen, query: '' });
      });
    });
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


