import {
  cartCount,
  cartItems,
  cartQty,
  cartTotal,
  changeQty,
  clearCart,
  itemNoteValue,
  promotionalPointsText,
  setItemNoteValue,
  setWeightedQty,
  syncCouponFromInput,
  syncUsePointsIntent
} from './cart.js';
import {
  filteredProducts,
  formatMeasure,
  homeCollections,
  iconForSection,
  isBestSeller,
  isLowStock,
  isWeightedProduct,
  measureOptions,
  priceLabel,
  productBadges,
  productsBySection,
  sectionItems
} from './catalog.js';
import {
  effectiveDeliveryAddressMiniApp,
  enderecoEntregaCompleto,
  limparClientOrderIdPendente,
  prefillCheckoutAddressFromCustomer,
  resumoEnderecoEntrega
} from './checkout.js';
import { debounce, escapeHtml, money, normalizeText } from './utils.js';
import { updateMainButton } from './telegram.js';
import { timelineSteps } from './orders.js';
import { fallbackGoogleMapsLink, mapStateFromTracking } from './map.js';

function shellMarkup() {
  return `
    <div class="app mj-reference-app">
      <header class="mj-app-hero delivery-app-header" id="marketHero">
        <div class="mj-safe-row">
          <strong>9:41</strong>
          <span class="mj-telegram-pill">TELEGRAM</span>
          <span>100</span>
        </div>
        <div class="mj-hero-line">
          <div>
            <span class="mj-hero-eyebrow" id="homeAddressLabel">Entregar em</span>
            <button class="mj-address-button" type="button" data-nav-page="profile">
              <span id="customerAddressLine"></span>
            </button>
            <span id="customerGreeting" hidden>Olá!</span>
            <span id="storeStatus" hidden>Aberto agora</span>
            <span hidden>Meus pedidos</span>
            <span hidden>Acompanhar entrega</span>
            <span hidden>SEU PEDIDO</span>
          </div>
          <button class="mj-bell" id="profileButton" type="button" aria-label="Minha conta">
            <span aria-hidden="true">&#128276;</span>
          </button>
        </div>
      </header>

      <main>
        <section class="store-search-panel" id="searchPanel" aria-label="Busca" hidden>
          <div class="search-row">
            <div class="search-wrap">
              <span aria-hidden="true">&#128269;</span>
              <input id="search" type="search" placeholder="Buscar produtos, marcas..." autocomplete="off">
            </div>
            <button class="scan-button" id="clearSearch" type="button" aria-label="Limpar busca">&times;</button>
          </div>
        </section>

        <nav class="legacy-tabs" id="tabs" aria-label="Categorias" hidden></nav>

        <section class="purchase-progress" id="journeyProgress" aria-label="Etapas da compra" hidden>
          <div class="section-head">
            <h2 id="journeyTitle">Compra no Mini App</h2>
            <span id="journeyStatus">Preparando</span>
          </div>
          <div class="journey-steps" id="journeySteps"></div>
        </section>

        <section class="vini-ai-outdoor" id="viniAiOutdoor" aria-label="Alertas do Vini" hidden>
          <div class="vini-ai-alert is-hidden" id="viniAiAlert" aria-live="polite" role="status" aria-hidden="true">
            <strong>Alerta do Vini</strong>
            <span>Use a busca para achar produtos rápido.</span>
          </div>
        </section>

        <section class="marketplace-home miniapp-page" id="marketHome" data-page="home" aria-label="Início">
          <div class="miniapp-design-home-slot" data-design-slot="home-top"></div>
          <section class="promo-banners" id="promoBanners" aria-label="Promoções"></section>
          <nav class="quick-category-rail" id="categoryRail" aria-label="Categorias principais"></nav>
          <section class="market-row" id="buyAgainSection" aria-label="Mais pedidos"></section>
          <section class="market-row" id="bestSellersSection" aria-label="Mais vendidos"></section>
          <section class="market-row" id="todayOffersSection" aria-label="Oferta do dia"></section>
          <section class="market-row" id="comboSection" aria-label="Combos"></section>
          <section class="market-row" id="lowStockSection" aria-label="Estoque baixo"></section>
          <section class="loyalty-card" id="loyaltyInviteCard" hidden>
            <div class="section-head">
              <h2>Pontos e recompensas</h2>
              <span id="pointsBalanceLabel">0 pts</span>
            </div>
            <div class="coupon-row">
              <input id="couponCode" type="text" maxlength="40" placeholder="Cupom ou indicação">
              <button class="ghost" id="copyInviteCode" type="button">Convidar</button>
            </div>
            <label class="toggle-line">
              <input id="usePointsIntent" type="checkbox">
              Usar pontos neste pedido
            </label>
          </section>
        </section>

        <section class="search-page miniapp-page" id="searchPage" data-page="search" hidden>
          <div class="mj-page-hero mj-search-hero">
            <div class="mj-safe-row">
              <strong>9:41</strong>
              <span class="mj-telegram-pill">TELEGRAM</span>
              <span>100</span>
            </div>
            <div class="mj-hero-line">
              <div>
                <span class="mj-hero-eyebrow">Entregar em</span>
                <strong id="searchAddressLine"></strong>
              </div>
              <button class="mj-bell" type="button" data-nav-page="profile" aria-label="Minha conta">&#128276;</button>
            </div>
            <div class="mj-big-search">
              <span>&#128269;</span>
              <input id="searchInputLarge" type="search" placeholder="Buscar produtos" autocomplete="off">
              <button type="button" id="clearSearchLarge" aria-label="Limpar">&times;</button>
            </div>
          </div>
          <div class="mj-screen-body">
            <section class="mj-recent-searches" id="recentSearches"></section>
            <section class="mj-search-categories" id="searchCategories"></section>
            <section class="mj-search-results" id="searchResults"></section>
          </div>
        </section>

        <section class="miniapp-page catalog-page" id="categoriesPage" data-page="categories" hidden>
          <div class="mj-page-hero compact">
            <button class="mj-back" type="button" data-nav-page="home" aria-label="Voltar">&lt;</button>
            <div>
              <span>Categoria</span>
              <h1>Categorias</h1>
            </div>
            <button class="mj-bell" type="button" data-nav-page="profile" aria-label="Minha conta">&#128276;</button>
          </div>
          <div id="categoriesPageList" class="category-page-list"></div>
        </section>

        <section class="miniapp-page products-page" id="products" data-page="products" hidden></section>

        <section class="delivery-panel miniapp-page" id="deliveryPanel" data-page="delivery" hidden>
          <div class="mj-page-hero centered">
            <button class="mj-back" id="deliveryBack" type="button" aria-label="Voltar">&lt;</button>
            <div>
              <h1>Entrega ou Retirada</h1>
              <span>Passo 1 de 3</span>
            </div>
          </div>
          <div id="deliveryContent"></div>
        </section>

        <section class="orders-panel miniapp-page" id="ordersPanel" data-page="orders" hidden>
          <div class="mj-page-hero orders">
            <div class="mj-safe-row">
              <strong>9:41</strong>
              <span class="mj-telegram-pill">TELEGRAM</span>
              <span>100</span>
            </div>
            <div class="mj-hero-line">
              <div>
                <span class="mj-hero-eyebrow">Entregar em</span>
                <strong id="ordersAddressLine"></strong>
              </div>
              <button class="mj-bell" type="button" data-nav-page="profile" aria-label="Minha conta">&#128276;</button>
            </div>
            <h1>Pedidos</h1>
          <p>Acompanhe seus pedidos em andamento e veja seu histórico.</p>
            <div class="mj-basket-small" aria-hidden="true">${basketSceneMarkup()}</div>
          </div>
          <div class="mj-screen-body">
            <div class="mj-tabs">
              <button class="active" type="button">Em andamento</button>
              <button type="button">Histórico</button>
            </div>
            <div id="ordersList"></div>
            <span id="authStatus" hidden>Conectando</span>
          </div>
        </section>

        <section class="pix-panel miniapp-page" id="pixPanel" data-page="payment" hidden>
          <div class="mj-page-hero payment">
            <button class="mj-back" type="button" data-nav-page="delivery" aria-label="Voltar">&lt;</button>
            <h1>Pagamento</h1>
            <span class="mj-secure">Compra segura</span>
          </div>
          <div id="pixContent"></div>
          <span id="pixStatus" hidden>Aguardando pagamento</span>
        </section>

        <section class="tracking-panel miniapp-page" id="trackingPanel" data-page="tracking" hidden>
          <div class="mj-page-hero tracking">
            <button class="mj-back" type="button" data-nav-page="orders" aria-label="Voltar">&lt;</button>
            <h1>Acompanhar pedido</h1>
            <button class="mj-bell" type="button" data-nav-page="profile" aria-label="Minha conta">&#128276;</button>
          </div>
          <div id="trackingContent"></div>
          <div class="map-box" id="trackingMap"></div>
          <span id="trackingStatus" hidden>Atualizando</span>
        </section>

        <section class="tracking-panel courier-page miniapp-page" id="courierPanel" data-page="courier" hidden>
          <div class="mj-page-hero courier">
            <button class="mj-back" type="button" data-nav-page="tracking" aria-label="Voltar">&lt;</button>
            <div>
              <h1>Entregador em tempo real</h1>
              <span>Acompanhe sua entrega</span>
            </div>
            <button class="mj-bell" type="button" data-nav-page="profile" aria-label="Minha conta">&#128276;</button>
          </div>
          <div id="courierContent"></div>
        </section>

        <section class="loyalty-panel miniapp-page" id="loyaltyPanel" data-page="loyalty" hidden>
          <div class="mj-page-hero compact">
            <button class="mj-back" type="button" data-nav-page="home" aria-label="Voltar">&lt;</button>
            <div>
              <span>Listas e pontos</span>
              <h1>Meus benefícios</h1>
            </div>
            <span id="loyaltyBalance">0 pontos</span>
          </div>
          <div id="loyaltyContent"></div>
        </section>

        <section class="profile-panel miniapp-page" id="profilePanel" data-page="profile" hidden>
          <div class="mj-page-hero account">
            <div class="mj-safe-row">
              <strong>9:41</strong>
              <span class="mj-telegram-pill">TELEGRAM</span>
              <span>100</span>
            </div>
            <h1>Minha conta</h1>
            <p>Gerencie seu perfil e preferências</p>
            <button class="mj-bell" type="button" aria-label="Notificações">&#128276;</button>
          </div>
          <div id="profileContent"></div>
          <span id="profileStatus" hidden>Mini App</span>
        </section>
      </main>
    </div>

    <aside class="cart-drawer miniapp-page cart-page" id="cartDrawer" data-page="cart" aria-label="Carrinho" hidden>
      <div class="cart-head mj-page-hero cart">
        <div class="mj-safe-row">
          <strong>9:41</strong>
          <span class="mj-telegram-pill">TELEGRAM</span>
          <span>100</span>
        </div>
        <h1>Carrinho</h1>
        <button class="mj-trash" id="clearCartDrawer" type="button" aria-label="Limpar carrinho">&#128465;</button>
        <button class="ghost" id="closeCart" type="button" hidden>Continuar comprando</button>
      </div>
      <div class="cart-list" id="cartList"></div>
      <div class="cart-foot">
        <div class="mj-delivery-strip">
          <span class="mj-delivery-bike" aria-hidden="true">&#128757;</span>
          <div>
            <strong>Entrega rápida na sua região</strong>
            <small id="deliveryAddressText">Receba em até 40 min</small>
          </div>
          <button type="button" data-nav-page="delivery">Alterar</button>
        </div>
        <div class="mj-coupon-card">
          <span>%</span>
          <div>
            <strong>Tem um cupom ou pontos?</strong>
            <small>Digite para aplicar</small>
          </div>
          <button type="button" data-nav-page="loyalty">Aplicar</button>
        </div>
        <div class="mj-summary-card">
          <div><span>Subtotal dos produtos</span><strong id="drawerSubtotal">R$ 0,00</strong></div>
          <div><span>Taxa de entrega</span><strong id="drawerDelivery">R$ 0,00</strong></div>
          <div class="total"><span>Total</span><strong id="drawerGrandTotal">R$ 0,00</strong></div>
        </div>
        <label class="cart-notes" id="cartNotesPanel">
          <span>Observação</span>
          <textarea id="cartNotes" maxlength="500" placeholder="Alguma observação para a loja?"></textarea>
          <small id="cartNotesHint">Ex: trocar sabor, ponto de referência.</small>
        </label>
        <div class="checkout-stage" id="cartStepPanel">
          <span class="checkout-step-label" id="checkoutStepLabel">Pedido pronto</span>
          <small id="checkoutHint">O backend recalcula tudo antes do Pix.</small>
          <button class="primary" id="continueToDelivery" type="button" disabled>Continuar</button>
        </div>
        <span id="itemsCount" hidden>Carrinho vazio</span>
        <span id="drawerTotal" hidden>R$ 0,00</span>
        <span id="checkoutPreviewBox" hidden></span>
        <span id="freeDeliveryHint" hidden></span>
      </div>
    </aside>

    <div class="sheet-backdrop" id="productSheetBackdrop" hidden></div>
    <aside class="product-sheet miniapp-page product-detail-page" id="productSheet" data-page="product" aria-label="Detalhe do produto" hidden>
      <div class="sheet-head">
        <button class="mj-back" id="closeProductSheet" type="button" aria-label="Voltar">&lt;</button>
        <strong>Detalhe do produto</strong>
        <button class="mj-bell" type="button" data-nav-page="profile" aria-label="Minha conta">&#128276;</button>
      </div>
      <div class="sheet-body" id="productSheetBody"></div>
    </aside>

    <footer class="bottom-bar" id="stickyCartBar" hidden>
      <button class="bottom-main" id="reviewCart" type="button">
        <span class="bottom-cart-icon" aria-hidden="true">&#128722;</span>
        <strong id="bottomCount">Carrinho vazio</strong>
        <span id="total">R$ 0,00</span>
        <small id="bottomFreeDeliveryHint">Ver carrinho</small>
      </button>
    </footer>

    <nav class="miniapp-bottom-nav" id="bottomNav" aria-label="Navegação principal">
      <button type="button" data-nav-page="home"><span>&#8962;</span>Início</button>
      <button type="button" data-nav-page="search"><span>&#128269;</span>Buscar</button>
      <button type="button" data-nav-page="orders"><span>&#128717;</span>Pedidos</button>
      <button type="button" data-nav-page="loyalty"><span>&#9776;</span>Listas</button>
      <button type="button" data-nav-page="profile"><span>&#128100;</span>Conta</button>
    </nav>

    <select id="deliveryMode" hidden>
      <option value="entrega">entrega</option>
      <option value="retirada">retirada</option>
    </select>
    <div id="checkoutHiddenFields" hidden>
      <input id="checkoutCep" autocomplete="postal-code">
      <input id="checkoutRua" autocomplete="street-address">
      <input id="checkoutNumero" autocomplete="off">
      <input id="checkoutComplemento" autocomplete="off">
      <input id="checkoutBairro" autocomplete="address-level3">
      <input id="checkoutCidade" autocomplete="address-level2">
      <input id="checkoutEstado" autocomplete="address-level1">
      <input id="checkoutPhone" autocomplete="tel">
      <input id="checkoutPoints" type="number" min="0" step="1">
      <input id="cartCouponCode" autocomplete="off">
      <input id="cartUsePointsIntent" type="checkbox">
    </div>

    <div class="toast" id="toast" role="status" aria-live="polite"></div>
  `;
}

function basketSceneMarkup() {
  return `
    <span class="basket-item one">&#127820;</span>
    <span class="basket-item two">&#129367;</span>
    <span class="basket-item three">&#129380;</span>
    <span class="basket-item four">&#129475;</span>
    <span class="basket-body"></span>
  `;
}

function collectElements() {
  const ids = [
    'tabs', 'channelLabel', 'journeyTitle', 'journeyStatus', 'journeySteps',
    'marketHome', 'marketHero', 'deliveryLogo', 'homeAddressLabel',
    'customerGreeting', 'customerAddressLine', 'profileButton', 'searchPanel', 'categoryRail',
    'promoBanners', 'loyaltyInviteCard', 'pointsBalanceLabel', 'couponCode',
    'copyInviteCode', 'usePointsIntent', 'marketFilters', 'buyAgainSection',
    'bestSellersSection', 'todayOffersSection', 'comboSection', 'lowStockSection',
    'searchPage', 'searchInputLarge', 'clearSearchLarge', 'recentSearches', 'searchCategories', 'searchResults',
    'deliveryPanel', 'deliveryContent', 'deliveryBack', 'pixPanel', 'pixStatus', 'pixContent',
    'loyaltyPanel', 'loyaltyBalance', 'loyaltyContent', 'profilePanel', 'profileStatus', 'profileContent',
    'trackingPanel', 'trackingStatus', 'trackingContent', 'trackingMap', 'courierPanel', 'courierContent',
    'products', 'search', 'clearSearch', 'cartButton', 'cartDrawer', 'closeCart',
    'cartList', 'itemsCount', 'bottomCount', 'bottomFreeDeliveryHint', 'total',
    'drawerTotal', 'drawerSubtotal', 'drawerDelivery', 'drawerGrandTotal',
    'cartCouponCode', 'cartUsePointsIntent', 'freeDeliveryHint', 'cartNotes', 'cartPerksPanel', 'cartNotesPanel',
    'cartHeadHint', 'cartNotesHint', 'checkoutStepLabel', 'cartStepPanel',
    'checkoutHint', 'checkoutFormPanel', 'deliveryMode',
    'checkoutCep', 'checkoutRua', 'checkoutNumero', 'checkoutComplemento',
    'checkoutBairro', 'checkoutCidade', 'checkoutEstado', 'checkoutPhone',
    'checkoutPoints', 'checkoutPreviewBox', 'continueToDelivery', 'continueToPayment', 'clearCartDrawer', 'reviewCart',
    'stickyCartBar', 'productSheetBackdrop', 'productSheet', 'productSheetBody',
    'closeProductSheet', 'viniAiOutdoor', 'viniAiAlert', 'storeStatus',
    'ordersPanel', 'ordersList', 'authStatus', 'categoriesPage', 'categoriesPageList',
    'bottomNav', 'toast', 'searchAddressLine', 'ordersAddressLine', 'deliveryAddressText'
  ];
  return Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
}

function designConfig(state) {
  return state.miniappDesign || {};
}

function designBanner(state) {
  const design = designConfig(state);
  return Array.isArray(design.banners?.itens) && design.banners.itens.length ? design.banners.itens[0] : null;
}

function designHighlights(state) {
  const configured = Array.isArray(designConfig(state).destaques?.itens) ? designConfig(state).destaques.itens : [];
  const defaults = [
    { id: 'ofertas', title: 'Ofertas da semana', body: 'Descontos selecionados', cta: 'Ver ofertas', action: 'ofertas', active: true, order: 1 },
    { id: 'combos', title: 'Combos econômicos', body: 'Leve mais pagando menos', cta: 'Ver combos', action: 'combos', active: true, order: 2 },
    { id: 'pontos', title: 'Meus pontos', body: 'Use pontos no checkout', cta: 'Ver pontos', action: 'loyalty', active: true, order: 3 }
  ];
  return defaults.map((item, index) => {
    const custom = configured.find(entry => String(entry.id || '') === item.id) || configured[index] || {};
    return {
      ...item,
      title: String(custom.titulo || custom.title || item.title),
      body: String(custom.subtitulo || custom.body || item.body),
      cta: String(custom.cta || item.cta),
      action: String(custom.acao || custom.action || item.action),
      image: String(custom.imagem || custom.image || custom.imageUrl || ''),
      active: custom.ativo !== false,
      order: Number(custom.ordem || item.order)
    };
  }).filter(item => item.active).sort((a, b) => a.order - b.order);
}

export function createRenderer({ state, telegram, handlers }) {
  const root = document.getElementById('miniapp-root') || document.body;
  root.className = '';
  root.innerHTML = shellMarkup();
  const els = collectElements();
  let toastTimer = null;

  function showToast(message) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => els.toast.classList.remove('show'), 2400);
  }

  function trackMiniAppEvent(tipo, payload = {}) {
    handlers.trackEvent?.(tipo, payload);
  }

  function paginaAtualSegura() {
    const paginas = new Set(['home', 'search', 'categories', 'products', 'product', 'cart', 'delivery', 'payment', 'orders', 'tracking', 'courier', 'loyalty', 'profile']);
    return paginas.has(state.currentPage) ? state.currentPage : 'home';
  }

  function navigateTo(page, options = {}) {
    const alias = { identify: 'home', lists: 'loyalty' };
    const next = alias[page] || page || 'home';
    state.currentPage = next;
    if (next !== 'product' && !options.keepProduct) state.productSheetId = '';
    if (next === 'products' && options.section !== undefined) {
      state.section = options.section || '';
      state.query = '';
      state.marketFilter = '';
      state.marketSort = '';
    }
    if (next === 'search' && els.searchInputLarge && state.query) els.searchInputLarge.value = state.query;
    render();
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
    trackMiniAppEvent('page_view', { page: next });
  }

  function etapaJornadaAtual() {
    if (state.currentPage === 'cart') return 'carrinho';
    if (state.currentPage === 'delivery') return 'entrega';
    if (state.currentPage === 'payment') return 'pagamento';
    if (state.currentPage === 'tracking' || state.currentPage === 'courier') return 'acompanhar';
    if (state.currentPage === 'orders') return 'confirmado';
    return 'catalogo';
  }

  function renderJourney() {
    const atual = etapaJornadaAtual();
    const etapas = [
      ['catalogo', 'Produtos'],
      ['carrinho', 'Carrinho'],
      ['entrega', 'Entrega'],
      ['pagamento', 'Pagamento'],
      ['acompanhar', 'Acompanhar']
    ];
    const indiceAtual = etapas.findIndex(([id]) => id === atual);
    if (els.journeySteps) {
      els.journeySteps.innerHTML = etapas.map(([id, label], index) => {
        const classe = index < indiceAtual ? 'done' : index === indiceAtual ? 'active' : '';
        return `<span class="journey-step ${classe}" data-step="${id}">${escapeHtml(label)}</span>`;
      }).join('');
    }
    if (els.journeyStatus) els.journeyStatus.textContent = etapas[indiceAtual]?.[1] || 'Catálogo';
  }

  function customerName() {
    const cliente = state.cliente || {};
    const user = state.telegramUser || {};
    return String(cliente.nome || user.first_name || '').trim();
  }

  function customerAddress() {
    const cliente = state.cliente || {};
    const rua = String(cliente.rua || '').trim();
  if (!rua) return ['Rua das Flores', '123'].join(', ');
    return [[rua, cliente.numero].filter(Boolean).join(', '), cliente.bairro].filter(Boolean).join(' - ');
  }

  function deliveryAddressFull() {
    const cliente = state.cliente || {};
    return [
      [cliente.rua, cliente.numero].filter(Boolean).join(', '),
      [cliente.bairro, cliente.cidade, cliente.estado].filter(Boolean).join(', '),
      cliente.cep ? `CEP ${cliente.cep}` : ''
    ].filter(Boolean);
  }

  function renderCustomerHeader() {
    const address = customerAddress();
    if (els.customerGreeting) els.customerGreeting.textContent = customerName() ? `Olá, ${customerName()}` : 'Olá!';
    if (els.customerAddressLine) els.customerAddressLine.textContent = address;
    if (els.searchAddressLine) els.searchAddressLine.textContent = address;
    if (els.ordersAddressLine) els.ordersAddressLine.textContent = address;
  }

  function statusText() {
    const textos = {
      aberta: 'Aberto agora',
      pausada: 'Pedidos pausados',
      fechada: 'Fechado para pedidos'
    };
    return textos[state.loja.status || 'aberta'] || textos.aberta;
  }

  function renderStatusLoja() {
    if (els.homeAddressLabel) {
      els.homeAddressLabel.textContent = `${statusText()} | Entrega e retirada`;
      els.homeAddressLabel.classList.toggle('closed', state.loja.aceitaPedidos === false);
    }
    if (els.storeStatus) {
      els.storeStatus.textContent = statusText();
      els.storeStatus.classList.toggle('closed', state.loja.aceitaPedidos === false);
    }
  }

  function itemUnit(item = {}) {
    return item.unit || item.unidadeVenda || item.sectionLabel || 'un';
  }

  function itemMedia(item = {}, className = '') {
    return item.image
      ? `<img class="${escapeHtml(className)}" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" referrerpolicy="no-referrer">`
      : `<span class="${escapeHtml(className)}">${escapeHtml(String(item.name || 'P').slice(0, 1).toUpperCase())}</span>`;
  }

  function firstProducts(limit = 8) {
    return state.products.filter(item => Number(item.stock || 0) > 0).slice(0, limit);
  }

  function sectionShortcuts(limit = 6) {
    const sections = sectionItems(state);
    const fixed = [
      { name: 'Ofertas', id: '', search: 'oferta', icon: '%' },
      { name: 'Mercearia', query: 'mercearia', icon: 'M' },
      { name: 'Bebidas', query: 'bebida', icon: 'B' },
      { name: 'Hortifruti', query: 'hortifruti', icon: 'H' },
      { name: 'Limpeza', query: 'limpeza', icon: 'L' }
    ].map(item => {
      if (!item.query) return item;
      const found = sections.find(section => normalizeText(section.name).includes(normalizeText(item.query)));
      return { name: item.name, id: found?.id || '', search: found ? '' : item.query, icon: item.icon };
    });
    const used = new Set(fixed.map(item => item.id).filter(Boolean));
    const extra = sections.filter(section => !used.has(section.id)).slice(0, limit - fixed.length)
      .map(section => ({ name: section.name, id: section.id, search: '', icon: iconForSection(section.name) }));
    return fixed.concat(extra).slice(0, limit);
  }

  function renderCategoryRail() {
    if (!els.categoryRail) return;
    const items = sectionShortcuts(6);
    els.categoryRail.innerHTML = items.map(item => {
      const active = item.id === state.section || (!!item.search && normalizeText(state.query).includes(normalizeText(item.search)));
      const attr = item.id ? `data-section="${escapeHtml(item.id)}"` : `data-category-search="${escapeHtml(item.search || item.name)}"`;
      return `<button class="quick-category category-card ${active ? 'active is-active' : ''}" type="button" ${attr}>
        <span class="category-icon">${escapeHtml(item.icon)}</span>
        <span>${escapeHtml(item.name)}</span>
        ${active ? '<small></small>' : ''}
      </button>`;
    }).join('');
    els.categoryRail.querySelectorAll('[data-section]').forEach(button => {
      button.addEventListener('click', () => {
        state.section = button.dataset.section || '';
        state.query = '';
        state.marketFilter = '';
        state.marketSort = '';
        navigateTo('products', { section: state.section });
        if (state.catalogPage.usePaged) handlers.reloadCatalog?.();
      });
    });
    els.categoryRail.querySelectorAll('[data-category-search]').forEach(button => {
      button.addEventListener('click', () => {
        state.section = '';
        state.query = button.dataset.categorySearch || '';
        state.marketFilter = 'offers';
        if (els.search) els.search.value = state.query;
        if (els.searchInputLarge) els.searchInputLarge.value = state.query;
        navigateTo('search');
        if (state.catalogPage.usePaged) handlers.reloadCatalog?.();
      });
    });
  }

  function renderPromoBanners(collections = homeCollections(state, cartItems(state))) {
    if (!els.promoBanners) return;
    const design = designConfig(state);
    if (design.banners?.ativo === false) {
      els.promoBanners.innerHTML = '';
      return;
    }
    const principal = designBanner(state);
    const highlight = designHighlights(state)[0] || {};
    const title = principal?.titulo || highlight.title || 'COMPLETO E ECONOMICO!';
    const subtitle = principal?.subtitulo || highlight.body || 'As melhores ofertas para sua casa';
    const cta = principal?.cta || highlight.cta || 'Ver ofertas';
    els.promoBanners.innerHTML = `
      <article class="promo-card hero-banner option3-hero-banner" data-promo-action="${escapeHtml(highlight.action || 'ofertas')}">
        <div class="hero-copy">
          <span class="script-label">Fim de semana</span>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(subtitle)}</p>
          <span class="promo-cta hero-button">${escapeHtml(cta)} <b>&rarr;</b></span>
        </div>
        <div class="basket-scene" aria-hidden="true">
          <div class="discount-badge"><span>ATE</span><strong>30%</strong><span>OFF</span></div>
          ${principal?.imagem || principal?.imageUrl || highlight.image ? `<img class="promo-image-3d" src="${escapeHtml(principal?.imagem || principal?.imageUrl || highlight.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}
          ${basketSceneMarkup()}
        </div>
      </article>
    `;
    if (!collections.offers.length) return;
  }

  function onChangeQty(id, delta) {
    const result = changeQty(state, id, delta, () => limparClientOrderIdPendente(state));
    if (result.message) showToast(result.message);
    if (result.added) {
      showToast('Produto adicionado ao carrinho');
      renderViniAIAlert();
    }
    if (result.ok) {
      handlers.syncCartAction?.(result.next > 0 ? 'cart/update' : 'cart/remove', {
        produto_id: id,
        quantidade: result.next
      });
      trackMiniAppEvent('cart_update', { productId: id, quantity: result.next });
    }
    render();
  }

  function onSetWeightedQty(id, value) {
    const result = setWeightedQty(state, id, value, () => limparClientOrderIdPendente(state));
    if (result.added) {
      showToast('Produto adicionado ao carrinho');
      renderViniAIAlert();
    }
    if (result.ok) {
      handlers.syncCartAction?.(result.next > 0 ? 'cart/update' : 'cart/remove', {
        produto_id: id,
        quantidade: result.next
      });
      trackMiniAppEvent('cart_update', { productId: id, quantity: result.next });
    }
    render();
  }

  function quantityControl(item, compact = false) {
    const qty = cartQty(state, item.id);
    if (Number(item.stock || 0) <= 0) return '<span class="stock-empty">Indisponível</span>';
    if (qty > 0) {
      return `<div class="qty ${compact ? 'compact' : ''}">
        <button type="button" data-action="minus" aria-label="Diminuir quantidade">-</button>
        <span>${isWeightedProduct(item) ? formatMeasure(qty, item.unidadeVenda) : qty}</span>
        <button type="button" data-action="plus" aria-label="Adicionar ao carrinho">+</button>
      </div>`;
    }
    return `<button class="${compact ? 'quick-add-button' : 'primary add-single durger-add'}" type="button" data-action="plus" aria-label="Adicionar ao carrinho">${compact ? '+' : 'ADICIONAR'}</button>`;
  }

  function attachProductCardEvents(card, item) {
    card.addEventListener('click', event => {
      if (event.target.closest('button')) return;
      openProductSheet(item.id);
    });
    card.querySelector('[data-action="minus"]')?.addEventListener('click', () => onChangeQty(item.id, -1));
    card.querySelector('[data-action="plus"]')?.addEventListener('click', () => onChangeQty(item.id, 1));
    card.querySelector('[data-action="plus"]')?.toggleAttribute('disabled', cartQty(state, item.id) >= item.stock);
  }

  function compactProductCard(item, context = '') {
    const card = document.createElement('article');
    card.className = `mini-product-card ${isLowStock(item) ? 'low-stock' : ''} ${Number(item.stock || 0) <= 0 ? 'unavailable' : ''}`;
    card.dataset.productId = item.id;
    const subtitle = [item.brand, itemUnit(item)].filter(Boolean).join(' ');
    card.innerHTML = `
      <div class="mini-media">${itemMedia(item)}</div>
      ${item.promotion ? '<span class="market-badge">Oferta</span>' : (context ? `<span class="market-badge">${escapeHtml(context)}</span>` : '')}
      <h3>${escapeHtml(item.name)}</h3>
      <small>${escapeHtml(subtitle)}</small>
      <div class="mini-card-bottom">
        <div class="price"><strong>${priceLabel(item)}</strong>${item.promotion ? `<del>${money(item.normalPrice)}</del>` : ''}</div>
        ${quantityControl(item, true)}
      </div>
    `;
    attachProductCardEvents(card, item);
    return card;
  }

  function productCard(item) {
    const card = document.createElement('article');
    const semEstoque = Number(item.stock || 0) <= 0;
    card.className = `product durger-card ${cartQty(state, item.id) > 0 ? 'selected' : ''} ${semEstoque ? 'unavailable' : ''}`;
    card.dataset.productId = item.id;
    const detail = [itemUnit(item), item.brand].filter(Boolean).join(' | ');
    card.innerHTML = `
      <div class="product-media">${itemMedia(item)}</div>
      ${item.promotion ? '<span class="discount-circle">15%<small>OFF</small></span>' : ''}
      <span class="durger-badge" aria-hidden="true">${cartQty(state, item.id) || ''}</span>
      <div class="product-body">
        <h3>${escapeHtml(item.name)}</h3>
        <small>${escapeHtml(detail)}</small>
        ${isBestSeller(item) ? '<span class="market-badge">Mais pedido</span>' : ''}
        ${item.tarjas?.length ? `<div class="product-badges">${productBadges(item)}</div>` : ''}
        <div class="price-row">
          <div class="price"><strong>${priceLabel(item)}</strong>${item.promotion ? `<del>${money(item.normalPrice)}</del>` : ''}</div>
          ${quantityControl(item, true)}
        </div>
      </div>
    `;
    attachProductCardEvents(card, item);
    return card;
  }

  function renderProductRail(target, title, subtitle, items = [], emptyText = 'Produtos serao exibidos aqui quando houver dados.') {
    if (!target) return;
    target.hidden = false;
    target.innerHTML = `
      <div class="section-head">
        <h2>${escapeHtml(title)}</h2>
        <button type="button" data-view-all>${escapeHtml(subtitle || 'Ver todos')} &rsaquo;</button>
      </div>
      <div class="market-strip"></div>
    `;
    const strip = target.querySelector('.market-strip');
    if (!items.length) {
      strip.outerHTML = `<div class="market-empty">${escapeHtml(emptyText)}</div>`;
      return;
    }
    items.slice(0, 8).forEach(item => strip.appendChild(compactProductCard(item)));
    target.querySelector('[data-view-all]')?.addEventListener('click', () => navigateTo('products'));
  }

  function renderDailyOffer(target, items = []) {
    if (!target) return;
    const item = items.find(produto => produto.promotion) || items[0];
    if (!item) {
      target.innerHTML = '';
      return;
    }
    target.hidden = false;
    target.innerHTML = `
      <article class="daily-offer-card" data-product-id="${escapeHtml(item.id)}">
        <div>
          <strong>Oferta do dia</strong>
          <span class="timer-pill">Termina em 08:45:12</span>
          <h3>${escapeHtml(item.name)}</h3>
          ${item.promotion ? `<del>${money(item.normalPrice)}</del>` : ''}
          <b>${priceLabel(item)}</b>
        </div>
        <div class="daily-offer-media">${itemMedia(item)}</div>
        <button class="floating-cart" type="button" id="cartButton" aria-label="Abrir carrinho">
          <span>&#128722;</span><em>${cartCount(state)}</em><strong>Carrinho</strong><small>${money(cartTotal(state))}</small>
        </button>
      </article>
      <article class="delivery-banner" data-nav-page="delivery">
        <span>&#128757;</span>
        <strong>Entrega rápida na sua região</strong>
        <small>Receba em até 40 min</small>
        <b>&rsaquo;</b>
      </article>
    `;
    target.querySelector('.daily-offer-card')?.addEventListener('click', event => {
      if (event.target.closest('button')) return;
      openProductSheet(item.id);
    });
    target.querySelector('#cartButton')?.addEventListener('click', iniciarCheckout);
    target.querySelector('[data-nav-page="delivery"]')?.addEventListener('click', () => navigateTo('delivery'));
  }

  function renderLoyaltyCard() {
    if (!els.pointsBalanceLabel) return;
    const saldo = Number(state.loyalty?.saldoPontos ?? state.cliente?.pontosDisponiveis ?? 0) || 0;
    els.pointsBalanceLabel.textContent = `${saldo} pts`;
    if (els.usePointsIntent) els.usePointsIntent.checked = state.usePointsIntent;
    if (els.cartUsePointsIntent) els.cartUsePointsIntent.checked = state.usePointsIntent;
    if (els.couponCode && els.couponCode.value !== state.couponCode) els.couponCode.value = state.couponCode;
    if (els.cartCouponCode && els.cartCouponCode.value !== state.couponCode) els.cartCouponCode.value = state.couponCode;
  }

  function renderCategoriesPage() {
    if (!els.categoriesPageList) return;
    const sections = sectionItems(state);
    if (!sections.length) {
      els.categoriesPageList.innerHTML = '<div class="empty">Nenhuma categoria disponível agora.</div>';
      return;
    }
    els.categoriesPageList.innerHTML = sections.map(section => `
      <button class="category-page-item" type="button" data-category-page-section="${escapeHtml(section.id)}">
        <span class="category-icon">${escapeHtml(iconForSection(section.name))}</span>
        <strong>${escapeHtml(section.name)}</strong>
        <small>${Number(section.products || 0)} produtos</small>
      </button>
    `).join('');
    els.categoriesPageList.querySelectorAll('[data-category-page-section]').forEach(button => {
      button.addEventListener('click', () => navigateTo('products', { section: button.dataset.categoryPageSection || '' }));
    });
  }

  function renderHome() {
    if (!els.marketHome) return;
    renderCategoryRail();
    renderLoyaltyCard();
    const collections = homeCollections(state, cartItems(state));
    renderPromoBanners(collections);
    renderProductRail(els.buyAgainSection, 'Mais pedidos da semana', 'Ver todos', collections.bestSellers.length ? collections.bestSellers : firstProducts(8));
    if (els.bestSellersSection) els.bestSellersSection.hidden = true;
    renderDailyOffer(els.todayOffersSection, collections.offers.length ? collections.offers : firstProducts(4));
    if (els.comboSection) els.comboSection.hidden = true;
    if (els.lowStockSection) els.lowStockSection.hidden = true;
    if (els.loyaltyInviteCard) els.loyaltyInviteCard.hidden = designConfig(state).pontosIndicacao === false;
  }

  function renderSearchPage() {
    if (!els.searchResults) return;
    const q = state.query.trim();
    if (els.searchInputLarge && els.searchInputLarge.value !== state.query) els.searchInputLarge.value = state.query;
    if (els.recentSearches) {
      const terms = ['arroz', 'leite', 'cafe', 'macarrao', 'oleo'];
      els.recentSearches.innerHTML = `
        <div class="section-head"><h2>Buscas recentes</h2><button type="button" data-clear-recents>Limpar</button></div>
        <div class="recent-chip-row">${terms.map(term => `<button type="button" data-recent-search="${term}">&#9719; ${term}</button>`).join('')}</div>
      `;
      els.recentSearches.querySelectorAll('[data-recent-search]').forEach(button => {
        button.addEventListener('click', () => {
          state.query = button.dataset.recentSearch || '';
          renderSearchPage();
          scheduleCatalogReload();
        });
      });
    }
    if (els.searchCategories) {
      els.searchCategories.innerHTML = `
        <h2>Categorias</h2>
        <div class="search-category-row">
          ${sectionShortcuts(5).map(item => `<button class="${item.id === state.section ? 'active' : ''}" type="button" data-search-section="${escapeHtml(item.id)}" data-search-term="${escapeHtml(item.search || item.name)}"><span>${escapeHtml(item.icon)}</span>${escapeHtml(item.name)}</button>`).join('')}
        </div>
        <div class="filter-sort-row"><button type="button">Filtros</button><button type="button">Ordenar <span>Relevância</span></button></div>
      `;
      els.searchCategories.querySelectorAll('[data-search-section], [data-search-term]').forEach(button => {
        button.addEventListener('click', () => {
          state.section = button.dataset.searchSection || '';
          state.query = state.section ? '' : (button.dataset.searchTerm || '');
          renderSearchPage();
          if (state.catalogPage.usePaged) handlers.reloadCatalog?.();
        });
      });
    }
    const items = filteredProducts(state);
    const resultItems = q || state.section ? items : firstProducts(12);
    const title = q ? `Resultados para "${q}"` : 'Produtos encontrados';
    els.searchResults.innerHTML = `
      <div class="section-head search-result-head">
        <h2>${escapeHtml(title)}</h2>
        <span>${resultItems.length} produtos encontrados</span>
      </div>
      <div class="search-result-list"></div>
    `;
    const list = els.searchResults.querySelector('.search-result-list');
    if (!resultItems.length) {
      list.innerHTML = '<div class="empty">Nenhum produto encontrado.</div>';
      return;
    }
    resultItems.slice(0, 40).forEach(item => {
      const row = document.createElement('article');
      row.className = 'search-result-item mini-product-card';
      row.dataset.productId = item.id;
      row.innerHTML = `
        <div class="search-thumb">${itemMedia(item)}</div>
        <div>
          <h3>${escapeHtml(item.name)}</h3>
          <small>${escapeHtml(itemUnit(item))}</small>
          <strong>${priceLabel(item)}</strong>
        </div>
        ${quantityControl(item, true)}
      `;
      attachProductCardEvents(row, item);
      list.appendChild(row);
    });
  }

  function renderProducts() {
    if (!els.products) return;
    els.products.innerHTML = '';
    const page = paginaAtualSegura();
    if (page !== 'products') return;
    const sectionName = sectionItems(state).find(section => section.id === state.section)?.name || 'Mercearia';
    els.products.innerHTML = `
      <div class="mj-page-hero compact category-hero">
        <button class="mj-back" type="button" data-nav-page="home" aria-label="Voltar">&lt;</button>
        <div><span>Categoria</span><h1>${escapeHtml(state.section ? sectionName : 'Produtos')}</h1></div>
        <button class="mj-bell" type="button" data-nav-page="profile" aria-label="Minha conta">&#128276;</button>
      </div>
      <div class="category-search-inline">
        <span>&#128269;</span>
        <input type="search" placeholder="Buscar em ${escapeHtml(sectionName)}" value="${escapeHtml(state.query)}" data-inline-search>
      </div>
      <div class="category-filter-row">
        <button class="active" type="button" data-category-filter="">Todos</button>
        <button type="button" data-category-filter="arroz">Arroz</button>
        <button type="button" data-category-filter="feijao">Feijao</button>
        <button type="button" data-category-filter="macarrao">Macarrao</button>
        <button type="button" data-category-filter="oleo">Oleos</button>
      </div>
    `;
    const products = filteredProducts(state);
    if (state.catalogLoading) {
      els.products.insertAdjacentHTML('beforeend', '<div class="empty">Carregando catálogo...</div>');
      return;
    }
    if (!products.length) {
      els.products.insertAdjacentHTML('beforeend', '<div class="empty">Nenhum produto encontrado.</div>');
      return;
    }
    productsBySection(state).forEach(group => {
      const section = document.createElement('section');
      section.className = 'section-block durger-catalog';
      section.innerHTML = `<div class="product-grid"></div>`;
      const grid = section.querySelector('.product-grid');
      group.items.forEach(item => grid.appendChild(productCard(item)));
      els.products.appendChild(section);
    });
    els.products.querySelectorAll('[data-nav-page]').forEach(button => {
      button.addEventListener('click', () => navigateTo(button.dataset.navPage || 'home'));
    });
    els.products.querySelector('[data-inline-search]')?.addEventListener('input', event => {
      state.query = event.target.value;
      scheduleCatalogReload();
    });
    els.products.querySelectorAll('[data-category-filter]').forEach(button => {
      button.addEventListener('click', () => {
        state.query = button.dataset.categoryFilter || '';
        renderProducts();
        scheduleCatalogReload();
      });
    });
  }

  function renderCart() {
    const items = cartItems(state);
    if (!els.cartList) return;
    if (!items.length) {
      els.cartList.innerHTML = '<div class="empty">Seu carrinho está vazio. Adicione produtos para continuar.</div>';
      return;
    }
    els.cartList.innerHTML = '';
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'cart-item';
      row.innerHTML = `
        <div class="cart-thumb">${itemMedia(item)}</div>
        <div class="cart-item-main">
          <div class="cart-item-top">
            <div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(itemUnit(item))}</small></div>
            <span class="cart-line-total">${money(item.quantity * item.price)}</span>
          </div>
          <div class="cart-item-bottom">
            <small>${money(item.price)} / ${escapeHtml(item.unidadeVenda || 'un')}</small>
            <div class="qty">
              <button type="button" data-action="minus" aria-label="Diminuir quantidade">-</button>
              <span>${isWeightedProduct(item) ? formatMeasure(item.quantity, item.unidadeVenda) : item.quantity}</span>
              <button type="button" data-action="plus" aria-label="Adicionar ao carrinho">+</button>
            </div>
          </div>
          ${itemNoteValue(state, item.id) ? `<small>${escapeHtml(itemNoteValue(state, item.id))}</small>` : ''}
          <button class="cart-remove" type="button" data-action="remove" aria-label="Remover">&#128465;</button>
        </div>
      `;
      row.querySelector('[data-action="minus"]').addEventListener('click', () => onChangeQty(item.id, -1));
      row.querySelector('[data-action="plus"]').addEventListener('click', () => onChangeQty(item.id, 1));
      row.querySelector('[data-action="remove"]').addEventListener('click', () => {
        if (isWeightedProduct(item)) onSetWeightedQty(item.id, 0);
        else onChangeQty(item.id, -item.quantity);
      });
      row.querySelector('[data-action="plus"]').toggleAttribute('disabled', item.quantity >= item.stock);
      els.cartList.appendChild(row);
    });
    const pointsText = promotionalPointsText(state, money);
    if (pointsText) {
      const box = document.createElement('div');
      box.className = 'points-box';
      box.innerHTML = `<strong>${escapeHtml(pointsText)}</strong><small>Os pontos entram após confirmação do pedido.</small>`;
      els.cartList.appendChild(box);
    }
  }

  function syncDeliveryMode(value) {
    const mode = String(value || state.checkout.deliveryMode || 'entrega') === 'retirada' ? 'retirada' : 'entrega';
    state.checkout.deliveryMode = mode;
    if (els.deliveryMode) els.deliveryMode.value = mode;
  }

  function renderDeliveryAddressPanel() {
    syncDeliveryMode(state.checkout.deliveryMode || 'entrega');
    const entrega = state.checkout.deliveryMode === 'entrega';
    if (entrega) prefillCheckoutAddressFromCustomer(state, els);
    const endereco = entrega ? effectiveDeliveryAddressMiniApp(state, els) : {};
    const completo = enderecoEntregaCompleto(endereco);
    if (els.deliveryAddressText) {
      els.deliveryAddressText.textContent = entrega ? resumoEnderecoEntrega(endereco) : 'Retirada no local selecionada.';
    }
    return { entrega, endereco, completo };
  }

  function renderDeliveryPanel() {
    if (!els.deliveryContent) return;
    const { entrega, endereco, completo } = renderDeliveryAddressPanel();
    const addressLines = deliveryAddressFull();
    const total = checkoutDisplayTotal();
    els.deliveryContent.innerHTML = `
      <div class="delivery-toggle" id="deliverySegments">
        <button class="${entrega ? 'active' : ''}" type="button" data-delivery-mode="entrega"><span>&#128757;</span> Entrega</button>
        <button class="${!entrega ? 'active' : ''}" type="button" data-delivery-mode="retirada"><span>&#8962;</span> Retirada</button>
      </div>
      <section class="checkout-section">
        <h2><span>&#128205;</span> ${entrega ? 'Endereço de entrega' : 'Retirada no local'}</h2>
        <div class="address-card ${entrega && !completo ? 'incomplete' : ''}">
          <span>&#128205;</span>
          <div>
            <strong>${escapeHtml(entrega ? (addressLines[0] || 'Endereço incompleto') : 'Mercadinho M&J')}</strong>
            <small>${escapeHtml(entrega ? (addressLines[1] || 'Complete os dados abaixo') : 'Retire seu pedido na loja')}</small>
            <small>${escapeHtml(entrega ? (addressLines[2] || '') : statusText())}</small>
          </div>
          <b>&rsaquo;</b>
        </div>
        <div class="address-form">
          <input data-checkout-field="checkoutCep" placeholder="CEP" value="${escapeHtml(endereco.cep || '')}">
          <input data-checkout-field="checkoutRua" placeholder="Rua" value="${escapeHtml(endereco.rua || '')}">
          <input data-checkout-field="checkoutNumero" placeholder="Número" value="${escapeHtml(endereco.numero || '')}">
          <input data-checkout-field="checkoutBairro" placeholder="Bairro" value="${escapeHtml(endereco.bairro || '')}">
          <input data-checkout-field="checkoutCidade" placeholder="Cidade" value="${escapeHtml(endereco.cidade || '')}">
          <input data-checkout-field="checkoutEstado" placeholder="UF" value="${escapeHtml(endereco.estado || '')}">
          <input data-checkout-field="checkoutPhone" placeholder="Telefone" value="${escapeHtml(endereco.telefone || '')}">
        </div>
      </section>
      <section class="checkout-section">
        <h2><span>&#9719;</span> Previsão de entrega</h2>
        <div class="delivery-eta-card"><span>&#128757;</span><div><strong>Hoje, entre 10:00 e 10:40</strong><small>Entrega rápida na sua região</small></div><b>Até 40 min</b></div>
      </section>
      <section class="checkout-section">
        <h2><span>&#9998;</span> Observação (opcional)</h2>
        <textarea id="deliveryNoteMirror" maxlength="120" placeholder="Alguma observação sobre a entrega?">${escapeHtml(els.cartNotes?.value || '')}</textarea>
      </section>
      <section class="order-summary-footer">
        <div>
          <strong>Resumo do pedido</strong>
          <span>${cartCount(state)} itens</span>
          <button type="button" data-nav-page="cart">Ver itens</button>
          <b>${money(total)}</b>
        </div>
        <div class="mj-basket-mini" aria-hidden="true">${basketSceneMarkup()}</div>
      </section>
      <button class="primary continue-payment" id="continueToPayment" type="button" ${cartCount(state) < 1 || state.sending || !state.loja.aceitaPedidos ? 'disabled' : ''}>
        ${state.sending ? 'Gerando Pix...' : 'Continuar para pagamento'} <span>&rsaquo;</span>
      </button>
    `;
    els.deliveryContent.querySelectorAll('[data-delivery-mode]').forEach(button => {
      button.addEventListener('click', () => {
        syncDeliveryMode(button.dataset.deliveryMode);
        renderDeliveryPanel();
      });
    });
    els.deliveryContent.querySelectorAll('[data-checkout-field]').forEach(input => {
      input.addEventListener('input', event => {
        const id = event.target.dataset.checkoutField;
        if (els[id]) els[id].value = event.target.value;
        state.checkout.deliveryAddressDirty = true;
        state.checkout.deliveryAddress = effectiveDeliveryAddressMiniApp(state, els);
      });
    });
    els.deliveryContent.querySelector('#deliveryNoteMirror')?.addEventListener('input', event => {
      if (els.cartNotes) els.cartNotes.value = event.target.value;
    });
    els.deliveryContent.querySelector('[data-nav-page="cart"]')?.addEventListener('click', () => navigateTo('cart'));
    els.deliveryContent.querySelector('#continueToPayment')?.addEventListener('click', () => {
      trackMiniAppEvent('checkout_payment_start', { itemCount: cartCount(state) });
      handlers.sendCart?.();
    });
  }

  function checkoutDeliveryFee() {
    const preview = state.checkout?.preview;
    if (preview && Number.isFinite(Number(preview.frete))) return Number(preview.frete || 0);
    return state.checkout.deliveryMode === 'entrega' ? 4.99 : 0;
  }

  function checkoutDisplayTotal() {
    const preview = state.checkout?.preview;
    if (preview && Number.isFinite(Number(preview.total))) return Number(preview.total || 0);
    return cartTotal(state) + checkoutDeliveryFee();
  }

  function renderCheckoutStep() {
    const page = paginaAtualSegura();
    const etapaCarrinho = page === 'cart';
    if (els.cartStepPanel) els.cartStepPanel.hidden = !etapaCarrinho;
    if (els.checkoutStepLabel) els.checkoutStepLabel.textContent = 'Pedido pronto para pagamento';
    if (els.continueToDelivery) {
      els.continueToDelivery.disabled = cartCount(state) < 1 || state.sending || !state.loja.aceitaPedidos;
      els.continueToDelivery.textContent = state.sending ? 'Gerando Pix...' : 'Continuar';
      els.continueToDelivery.setAttribute('aria-label', 'Continuar');
    }
    renderJourney();
  }

  function renderSummary() {
    const count = cartCount(state);
    const total = cartTotal(state);
    const fee = checkoutDeliveryFee();
    const finalTotal = checkoutDisplayTotal();
    const label = count ? `${count} ${count === 1 ? 'item' : 'itens'}` : 'Carrinho vazio';
    if (els.itemsCount) els.itemsCount.textContent = count ? `${label} no carrinho` : 'Carrinho vazio';
    if (els.bottomCount) els.bottomCount.textContent = count ? `${label}` : 'Carrinho vazio';
    if (els.total) els.total.textContent = money(total);
    if (els.bottomFreeDeliveryHint) els.bottomFreeDeliveryHint.textContent = 'Ver carrinho';
    if (els.drawerTotal) els.drawerTotal.textContent = money(finalTotal);
    if (els.drawerSubtotal) els.drawerSubtotal.textContent = money(total);
    if (els.drawerDelivery) els.drawerDelivery.textContent = money(fee);
    if (els.drawerGrandTotal) els.drawerGrandTotal.textContent = money(finalTotal);
    if (els.stickyCartBar) {
      const paginaSemBarra = ['cart', 'delivery', 'payment', 'product'].includes(paginaAtualSegura());
      els.stickyCartBar.hidden = count < 1 || paginaSemBarra || designConfig(state).carrinhoFixo === false;
    }
    if (els.clearCartDrawer) els.clearCartDrawer.disabled = count < 1 || state.sending;
    updateMainButton(telegram.webApp, {
      count,
      totalText: money(total),
      sending: state.sending,
      currentPage: paginaAtualSegura(),
      enabled: state.loja.aceitaPedidos,
      hasPix: Boolean(state.pix?.copiaCola)
    });
    renderCart();
    renderCheckoutStep();
    renderLoyaltyCard();
  }

  function renderProductSheet() {
    if (!els.productSheet || !els.productSheetBody) return;
    const item = state.productCache.get(state.productSheetId) || state.products.find(product => product.id === state.productSheetId);
    if (!item) {
      closeProductSheet();
      return;
    }
    const qty = cartQty(state, item.id);
    const productVisual = `
      <div class="detail-product-visual">
        <span class="detail-product-placeholder">${escapeHtml(String(item.name || 'P').slice(0, 1).toUpperCase())}</span>
        ${item.image ? `<img class="detail-product-image" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" referrerpolicy="no-referrer">` : ''}
      </div>
    `;
    const opcoesPeso = isWeightedProduct(item)
      ? `<div class="weight-options">${measureOptions(item).map(value => `<button type="button" data-action="set-weight" data-sheet-action="set-weight" data-weight="${value}">${formatMeasure(value, item.unidadeVenda)}</button>`).join('')}</div>`
      : '';
    const detalheQuantidade = qty > 0
      ? (isWeightedProduct(item) ? formatMeasure(qty, item.unidadeVenda) : String(qty))
      : (isWeightedProduct(item) ? formatMeasure(measureOptions(item)[0] || 1, item.unidadeVenda) : '1 un');
    els.productSheetBody.innerHTML = `
      <div class="product-detail-media">
        ${productVisual}
        ${item.promotion ? '<span class="discount-circle large">ATE<br><b>30%</b><small>OFF</small></span>' : ''}
      </div>
      <div class="product-detail-dots"><span></span><span></span><span></span></div>
      <section class="product-detail-copy">
        <h2>${escapeHtml(item.name)}</h2>
        <p>${escapeHtml(item.description || 'Produto selecionado pela loja para o seu pedido.')}</p>
        <div class="rating-row"><span>*****</span><b>4,8</b><small>(avaliações)</small><em>${escapeHtml(itemUnit(item))}</em></div>
        <div class="detail-price">
          <span class="detail-price-copy">${item.promotion ? `<del>${money(item.normalPrice)}</del>` : ''}<strong>${priceLabel(item)}</strong></span>
          <div class="qty detail-qty">
            <button type="button" data-action="minus" aria-label="Diminuir quantidade" ${qty <= 0 ? 'disabled' : ''}>-</button>
            <span>${detalheQuantidade}</span>
            <button type="button" data-action="plus" aria-label="Adicionar ao carrinho">+</button>
          </div>
        </div>
      </section>
      ${opcoesPeso}
          <section class="detail-accordion"><span>&#9432;</span><div><strong>Descrição</strong><small>${escapeHtml(item.description || 'Ideal para o dia a dia.')}</small></div><b>&or;</b></section>
          <section class="detail-accordion"><span>i</span><div><strong>Informações</strong><small>Estoque e preço final são validados pela loja.</small></div><b>&or;</b></section>
          <label class="item-note">Observação deste item
        <textarea id="productItemNote" maxlength="240" placeholder="Ex: escolher bem maduro">${escapeHtml(itemNoteValue(state, item.id))}</textarea>
      </label>
      <section class="related-products"><h3>Produtos relacionados</h3><div class="market-strip"></div></section>
      <button class="primary sticky-add-detail" type="button" data-sheet-action="plus">Adicionar ao carrinho</button>
    `;
    const related = els.productSheetBody.querySelector('.related-products .market-strip');
    state.products.filter(product => product.section === item.section && product.id !== item.id).slice(0, 6)
      .forEach(product => related.appendChild(compactProductCard(product)));
    const detailImage = els.productSheetBody.querySelector('.detail-product-image');
    const markDetailImageLoaded = () => {
      if (detailImage?.naturalWidth > 8 && detailImage?.naturalHeight > 8) {
        detailImage.closest('.detail-product-visual')?.classList.add('image-loaded');
      }
    };
    detailImage?.addEventListener('load', markDetailImageLoaded, { once: true });
    detailImage?.addEventListener('error', () => {
      detailImage.closest('.detail-product-visual')?.classList.remove('image-loaded');
    }, { once: true });
    if (detailImage?.complete) markDetailImageLoaded();
    els.productSheetBody.querySelector('[data-action="minus"]')?.addEventListener('click', () => {
      onChangeQty(item.id, -1);
      renderProductSheet();
    });
    els.productSheetBody.querySelector('[data-action="plus"]')?.addEventListener('click', () => {
      onChangeQty(item.id, 1);
      renderProductSheet();
    });
    els.productSheetBody.querySelector('[data-sheet-action="plus"]')?.addEventListener('click', () => {
      onChangeQty(item.id, 1);
      renderProductSheet();
    });
    els.productSheetBody.querySelectorAll('[data-sheet-action="set-weight"]').forEach(button => {
      button.addEventListener('click', () => {
        onSetWeightedQty(item.id, Number(button.dataset.weight || 0));
        renderProductSheet();
      });
    });
    els.productSheetBody.querySelector('#productItemNote')?.addEventListener('input', event => {
      setItemNoteValue(state, item.id, event.target.value);
    });
    if (qty > 0) els.productSheetBody.querySelector('.sticky-add-detail').textContent = `Adicionar ao carrinho (${qty})`;
  }

  function openProductSheet(id) {
    state.productSheetId = id;
    state.currentPage = 'product';
    trackMiniAppEvent('product_open', { productId: id });
    renderProductSheet();
    renderPageVisibility();
  }

  function closeProductSheet() {
    state.productSheetId = '';
    state.currentPage = state.section || state.query ? 'products' : 'home';
    if (els.productSheetBody) els.productSheetBody.innerHTML = '';
    render();
  }

  function setCartOpen(open) {
    state.cartOpen = open;
    if (open) state.currentPage = 'cart';
    if (!open && state.currentPage === 'cart') state.currentPage = 'home';
    renderCart();
    renderCheckoutStep();
    renderPageVisibility();
  }

  function iniciarCheckout() {
    if (!cartItems(state).length) {
      showToast('Adicione ao menos um produto');
      return;
    }
    state.currentPage = 'cart';
    state.checkoutStep = 'cart';
    trackMiniAppEvent('cart_open', { itemCount: cartCount(state) });
    setCartOpen(true);
    renderCheckoutStep();
  }

  function orderStatusLabel(order = {}) {
    return order.statusDetalhe?.label || order.status_label || order.status || 'Em preparo';
  }

  function orderDisplayId(id) {
    const raw = String(id || '').trim();
    if (!raw) return '';
    const digits = raw.replace(/\D/g, '');
    return digits.length > 6 ? digits.slice(-6) : raw;
  }

  function orderThumbs(order = {}) {
    const items = Array.isArray(order.itens) ? order.itens : [];
    if (!items.length) return firstProducts(4).map(item => itemMedia(item)).join('');
    return items.slice(0, 4).map(item => {
      const productId = item.produtoId || item.produto_id || `${item.secao}_${item.index || 0}`;
      const product = state.productCache.get(productId) || state.products.find(produto => produto.id === productId);
      return product ? itemMedia(product) : `<span>${escapeHtml(String(item.nome || 'P').slice(0, 1))}</span>`;
    }).join('');
  }

  function renderOrders() {
    if (!els.ordersList) return;
    const orders = Array.isArray(state.orders) ? state.orders : [];
    if (!orders.length) {
      els.ordersList.innerHTML = '<div class="empty">Quando seu primeiro pedido for enviado, ele aparece aqui.</div>';
      return;
    }
    const current = orders.find(order => !['entregue', 'cancelado', 'arquivado'].includes(String(order.status || '').toLowerCase())) || orders[0];
    const history = orders.filter(order => order !== current).slice(0, 5);
    els.ordersList.innerHTML = `
      <h2>Pedido atual</h2>
      <article class="order-card-current">
        <div class="order-main-row">
          <span class="order-icon">&#128717;</span>
          <div><strong>Pedido #${escapeHtml(orderDisplayId(current.id))}</strong><small>${escapeHtml(current.criadoEm || current.data || 'Hoje')}</small></div>
          <em>${escapeHtml(orderStatusLabel(current))}</em>
        </div>
        <div class="order-thumbs">${orderThumbs(current)}<span>+ itens</span></div>
        <div class="order-card-bottom">
          <div><small>Entrega até</small><strong>Hoje, 10:15 - 10:45</strong></div>
          <div><small>Total</small><strong>${money(current.total || 0)}</strong></div>
        </div>
        <button type="button" data-order-track="${escapeHtml(current.id || '')}">Ver detalhes <b>&rsaquo;</b></button>
        <button class="ghost" type="button" data-order-pix="${escapeHtml(current.id || '')}">Ver Pix</button>
      </article>
      <h2>Histórico de pedidos</h2>
      ${history.length ? history.map(order => `
        <article class="order-history-row" data-order-track="${escapeHtml(order.id || '')}">
          <span>&check;</span>
          <div><strong>Pedido #${escapeHtml(orderDisplayId(order.id))}</strong><small>${escapeHtml(order.criadoEm || order.data || '')}</small></div>
          <div><strong>${money(order.total || 0)}</strong><small>${escapeHtml(orderStatusLabel(order))}</small></div>
          <b>&rsaquo;</b>
        </article>
      `).join('') : '<div class="empty">Sem histórico por enquanto.</div>'}
    `;
  }

  function renderPixPanel() {
    if (!els.pixContent) return;
    const pix = state.pix || state.pedidoAtual?.pix || null;
    const pedido = state.pedidoAtual || {};
    const total = Number(pix?.valor || pedido.total || checkoutDisplayTotal() || 0);
    const status = state.orderStatus?.pagamento?.status || pedido.statusPagamento || pix?.status || 'Aguardando pagamento';
    const countItems = items => Array.isArray(items)
      ? items.reduce((sum, item) => sum + (Number(item.quantidade || item.quantity || item.qtd) || 1), 0)
      : 0;
    const quantidadeItens = cartCount(state) ||
      pedido.quantidadeItens ||
      state.checkout?.lastItemCount ||
      countItems(pedido.itens || pedido.items) ||
      countItems(state.checkout?.lastCreate?.pedido?.itens || state.checkout?.lastCreate?.pedido?.items) ||
      countItems(state.checkout?.preview?.itens || state.checkout?.preview?.items) ||
      '';
    if (els.pixStatus) els.pixStatus.textContent = status;
    if (!pix?.copiaCola) {
      els.pixContent.innerHTML = '<div class="empty">Revise seu pedido e toque em PAGAR COM PIX para gerar o pagamento seguro.</div>';
      return;
    }
    els.pixContent.innerHTML = `
      <section class="payment-summary-card">
        <h2>Resumo do pedido</h2>
        <div class="mj-basket-mini" aria-hidden="true">${basketSceneMarkup()}</div>
        <div><span>Itens (${quantidadeItens})</span><strong>${money((pedido.subtotal || total) - (pedido.frete || 0))}</strong></div>
        <div><span>Entrega</span><strong>${money(pedido.frete || pix.frete || 0)}</strong></div>
        <div class="total"><span>Total do pedido</span><strong>${money(total)}</strong></div>
      </section>
      <section class="payment-method-card">
        <h2>Método de pagamento</h2>
        <div class="pay-option selected"><span class="radio"></span><b>Pix</b><small>Pagamento instantâneo</small><em>Selecionado</em></div>
        <div class="pay-option muted"><span class="radio"></span><b>Cartão de crédito</b><small>Em breve</small></div>
        <div class="pix-box">
          <p>Escaneie o QR Code com o app do seu banco</p>
          ${pix.qrCodeDataUrl ? `<img class="pix-qr" src="${escapeHtml(pix.qrCodeDataUrl)}" alt="QR Code do Pix">` : '<div class="pix-qr placeholder">QR</div>'}
          <label class="pix-copy">Pix cópia e cola
            <textarea readonly>${escapeHtml(pix.copiaCola)}</textarea>
          </label>
          <div class="checkout-actions">
            <button class="ghost" type="button" data-copy-pix>Copiar código</button>
            <label class="primary receipt-button">Enviar comprovante<input type="file" data-send-receipt-file accept="image/png,image/jpeg,image/webp,application/pdf" hidden></label>
            <button class="ghost" type="button" data-refresh-pix>Atualizar status</button>
            <button class="ghost" type="button" data-send-receipt>Já paguei</button>
          </div>
          <small class="approved-note">Pagamento aprovado automaticamente após confirmação.</small>
        </div>
      </section>
      <footer class="payment-fixed">
        <div><span>Total a pagar</span><strong>${money(total)}</strong></div>
        <button class="primary" type="button" data-refresh-pix-primary>PAGAR COM PIX</button>
      </footer>
    `;
  }

  function renderLoyaltyPanel() {
    if (!els.loyaltyContent) return;
    const loyalty = state.loyalty || {};
    const imagemCapa = String(designConfig(state).fidelidade?.imagemCapa || '');
    const saldo = Number(loyalty.saldoPontos || loyalty.pontosDisponiveis || 0);
    if (els.loyaltyBalance) els.loyaltyBalance.textContent = `${saldo} pontos`;
    els.loyaltyContent.innerHTML = `
      <div class="loyalty-hero account-benefit-card">
        <span class="star">&#9733;</span>
        ${imagemCapa ? `<img src="${escapeHtml(imagemCapa)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}
        <div>
          <strong>Meus pontos</strong>
          <h2>${saldo} pts</h2>
          <small>${money(loyalty.saldoReais || 0)} em saldo equivalente</small>
        </div>
        <button type="button" data-share-referral>Compartilhar código</button>
      </div>
      <div class="profile-menu">
        <button type="button" data-nav-page="cart"><span>%</span><div><strong>Usar pontos no carrinho</strong><small>Backend valida limite e saldo</small></div><b>&rsaquo;</b></button>
        <button type="button" data-share-referral><span>&#127873;</span><div><strong>Código de indicação</strong><small>${escapeHtml(loyalty.codigoIndicacao || 'Indisponível')}</small></div><b>&rsaquo;</b></button>
      </div>
      <div class="points-box">
        <strong>Regras do clube</strong>
        <small>Mínimo: ${Number(loyalty.regras?.minimoPontos || loyalty.minPontosResgate || 0)} pontos.</small>
        <small>Máximo no pedido: ${Number(loyalty.regras?.percentualMaximoPedido || loyalty.percentualMaximoPedido || 75)}%.</small>
      </div>
    `;
  }

  function renderProfilePanel() {
    if (!els.profileContent) return;
    const cliente = state.cliente || {};
    const telegramUser = state.telegramUser || {};
    const nome = cliente.nome || telegramUser.first_name || 'Cliente';
    const telefone = cliente.telefone || 'Telefone pelo Telegram';
    const endereco = deliveryAddressFull();
    const saldo = Number(state.loyalty?.saldoPontos || state.loyalty?.pontosDisponiveis || 0);
    if (els.profileStatus) els.profileStatus.textContent = state.authOk ? 'Identificado' : 'Aguardando Telegram';
    els.profileContent.innerHTML = `
      <section class="account-card">
        <div class="avatar">${escapeHtml(String(nome).slice(0, 1).toUpperCase())}</div>
        <div><h2>${escapeHtml(nome)}</h2><small>${escapeHtml(telefone)}</small></div>
        <b>&rsaquo;</b>
        <div class="account-address"><span>&#128205;</span><div><strong>${escapeHtml(endereco[0] || customerAddress())}</strong><small>${escapeHtml(endereco[1] || 'Endereço cadastrado no Telegram')}</small></div><em>Principal</em></div>
      </section>
      <section class="account-benefit-card">
        <span class="star">&#9733;</span>
        <div><strong>Meus pontos</strong><h2>${saldo} pts</h2><small>Faltam pontos para novos benefícios</small></div>
        <button type="button" data-nav-page="loyalty">Ver benefícios &rsaquo;</button>
      </section>
      <nav class="profile-menu">
        <button type="button"><span>&#128205;</span><div><strong>Meus endereços</strong><small>Gerencie seus endereços de entrega</small></div><b>&rsaquo;</b></button>
        <button type="button"><span>&#128179;</span><div><strong>Pagamento</strong><small>Formas de pagamento e carteiras</small></div><b>&rsaquo;</b></button>
        <button type="button"><span>?</span><div><strong>Ajuda</strong><small>Dúvidas frequentes e suporte</small></div><b>&rsaquo;</b></button>
        <button type="button"><span>&#128276;</span><div><strong>Notificações</strong><small>Preferências de comunicação</small></div><b>&rsaquo;</b></button>
        <button type="button"><span>&#8618;</span><div><strong>Sair da conta</strong><small>Finalizar sessão no app</small></div><b>&rsaquo;</b></button>
      </nav>
      <article class="benefits-banner"><div><span>Vantagens pra você!</span><strong>Frete grátis, ofertas exclusivas e muito mais.</strong><button type="button" data-nav-page="loyalty">Ver benefícios &rarr;</button></div><div class="mj-basket-mini">${basketSceneMarkup()}</div></article>
    `;
  }

  function renderTrackingPanel() {
    if (!els.trackingContent) return;
    const tracking = state.tracking || null;
    if (!tracking) {
      els.trackingContent.innerHTML = '<div class="empty">Escolha um pedido para acompanhar o status e a entrega.</div>';
      if (els.trackingMap) els.trackingMap.innerHTML = '';
      return;
    }
    const status = tracking.status || state.pedidoAtual?.status || '';
    if (els.trackingStatus) els.trackingStatus.textContent = tracking.statusDetalhe?.label || status || 'Acompanhando';
    const steps = timelineSteps(status);
    const pedido = state.pedidoAtual || {};
    els.trackingContent.innerHTML = `
      <section class="tracking-summary">
        <div><h2>Pedido #${escapeHtml(orderDisplayId(pedido.id || tracking.pedidoId))}</h2><small>Realizado hoje</small></div>
        <button type="button" data-order-pix="${escapeHtml(pedido.id || tracking.pedidoId || '')}">&#9776; Ver detalhes</button>
        <div class="eta-card"><span>&#9719;</span><div><small>Previsão de entrega</small><strong>Hoje, até 10:20</strong></div></div>
      </section>
      <section class="tracking-timeline">
        ${steps.map(step => `<div class="timeline-row ${step.done ? 'done' : ''} ${step.active ? 'active' : ''}"><span>${step.done ? '&check;' : step.active ? '&#128757;' : ''}</span><div><strong>${escapeHtml(step.label)}</strong><small>${escapeHtml(step.active ? 'Seu pedido está a caminho!' : 'Acompanhe esta etapa')}</small></div><em>09:35</em></div>`).join('')}
      </section>
      <section class="tracking-order-summary">
        <div><h2>Resumo do pedido</h2><small>${pedido.quantidadeItens || cartCount(state) || 4} itens</small></div>
        <div class="order-thumbs">${orderThumbs(pedido)}</div>
        <div><small>Total</small><strong>${money(pedido.total || 0)}</strong><small>Pagamento Pix</small></div>
      </section>
      <button class="help-row" type="button"><span>&#9742;</span><div><strong>Precisa de ajuda?</strong><small>Fale com a equipe pelo chat</small></div><b>&rsaquo;</b></button>
      <article class="delivery-card-bottom" data-open-courier><span>&#128757;</span><div><strong>Entrega rápida na sua região</strong><small>Acompanhe em tempo real até sua casa</small></div></article>
    `;
    if (els.trackingMap) {
      const map = mapStateFromTracking(tracking);
      els.trackingMap.innerHTML = map.aoVivo && map.mapaUrl
        ? `<iframe title="Mapa do motoboy" src="${escapeHtml(map.mapaUrl)}" loading="lazy" referrerpolicy="no-referrer"></iframe>`
        : `<div class="map-fallback">${escapeHtml(map.mensagem || 'Mapa indisponível agora.')}</div>`;
    }
  }

  function renderCourierPanel() {
    if (!els.courierContent) return;
    const tracking = state.tracking || {};
    const map = mapStateFromTracking(tracking);
    const mapsLink = fallbackGoogleMapsLink(tracking);
    els.courierContent.innerHTML = `
      <section class="courier-map">
        ${map.aoVivo && map.mapaUrl ? `<iframe title="Mapa do motoboy" src="${escapeHtml(map.mapaUrl)}" loading="lazy" referrerpolicy="no-referrer"></iframe>` : '<div class="fake-map"><span>Loja</span><span>Seu endereco</span><b>&#128757;</b></div>'}
        ${mapsLink ? `<a href="${escapeHtml(mapsLink)}" target="_blank" rel="noreferrer" class="map-center-button">Abrir no Maps</a>` : '<button class="map-center-button" type="button">Mapa</button>'}
      </section>
      <section class="courier-status-card">
        <span>&#128230;</span>
        <div><strong>Saiu para entrega</strong><small>Seu pedido está a caminho!</small></div>
        <div><small>Previsão de chegada</small><b>12 min</b></div>
      </section>
      <section class="courier-driver-card">
        <div class="driver-avatar">C</div>
        <div><h2>${escapeHtml(tracking.entrega?.entregador || 'Carlos')}</h2><small>* 4,9 | Entregador parceiro</small></div>
        <span>&#128757;</span>
        <button type="button">Conversar</button>
        <button type="button">Ligar</button>
      </section>
      <section class="courier-total-card"><span>&#128179;</span><div><strong>Total do pedido</strong><small>Ver detalhes do pedido</small></div><b>${money(state.pedidoAtual?.total || 0)}</b></section>
      <section class="live-card"><span></span><strong>Atualização em tempo real</strong><em>LIVE</em></section>
    `;
  }

  function renderPageVisibility() {
    const page = paginaAtualSegura();
    state.currentPage = page;
    document.querySelectorAll('.miniapp-page').forEach(el => {
      const target = String(el.dataset.page || '');
      const visible = target === page;
      el.hidden = !visible;
      el.classList.toggle('active-page', visible);
    });
    if (els.marketHero) els.marketHero.hidden = !['home'].includes(page);
    if (els.searchPanel) els.searchPanel.hidden = true;
    if (els.categoryRail) els.categoryRail.hidden = page !== 'home';
    if (els.cartDrawer) {
      els.cartDrawer.hidden = page !== 'cart';
      els.cartDrawer.classList.toggle('open', page === 'cart');
      els.cartDrawer.classList.toggle('as-page', page === 'cart');
    }
    if (els.productSheetBackdrop) els.productSheetBackdrop.hidden = true;
    if (els.productSheet) {
      els.productSheet.hidden = page !== 'product';
      els.productSheet.classList.toggle('open', page === 'product');
      els.productSheet.classList.toggle('as-page', page === 'product');
    }
    if (els.bottomNav) {
      els.bottomNav.hidden = ['delivery', 'payment', 'product', 'tracking'].includes(page);
      els.bottomNav.querySelectorAll('[data-nav-page]').forEach(btn => {
        const nav = btn.dataset.navPage;
        btn.classList.toggle('active', nav === page || (nav === 'home' && page === 'products'));
      });
    }
  }

  function renderViniAIAlert() {
    if (!els.viniAiAlert || !els.viniAiOutdoor) return;
    window.clearTimeout(state.viniAi.alertHideTimer);
    els.viniAiOutdoor.hidden = false;
    els.viniAiAlert.classList.remove('is-hidden');
    els.viniAiAlert.removeAttribute('aria-hidden');
    els.viniAiAlert.innerHTML = '<strong>Alerta do Vini</strong><span>Produto adicionado ao carrinho.</span>';
    state.viniAi.alertHideTimer = window.setTimeout(() => {
      els.viniAiAlert.classList.add('is-hidden');
      els.viniAiAlert.setAttribute('aria-hidden', 'true');
    }, 2800);
  }

  function renderTabs() {
    if (els.tabs) els.tabs.innerHTML = '';
  }

  function render() {
    const design = designConfig(state);
    const tema = ['verde_fresco', 'vermelho_energia', 'escuro_premium'].includes(design.tema) ? design.tema : 'vermelho_energia';
    document.body.dataset.miniappTheme = tema;
    document.body.dataset.miniappMode = design.modo || 'simples';
    document.body.classList.add('mj-reference-layout');
    renderCustomerHeader();
    renderStatusLoja();
    renderTabs();
    renderHome();
    renderSearchPage();
    renderProducts();
    renderDeliveryPanel();
    renderOrders();
    renderPixPanel();
    renderLoyaltyPanel();
    renderProfilePanel();
    renderTrackingPanel();
    renderCourierPanel();
    renderSummary();
    if (state.productSheetId) renderProductSheet();
    renderCategoriesPage();
    renderPageVisibility();
    handlers.persistUiState?.();
  }

  const scheduleCatalogReload = debounce(() => {
    if (state.catalogPage.usePaged) handlers.reloadCatalog?.();
    else render();
  }, 220);

  function bindEvents() {
    const syncSearch = value => {
      state.query = value;
      state.section = '';
      state.marketFilter = '';
      state.marketSort = '';
      if (els.search && els.search.value !== value) els.search.value = value;
      if (els.searchInputLarge && els.searchInputLarge.value !== value) els.searchInputLarge.value = value;
      scheduleCatalogReload();
    };
    els.search?.addEventListener('input', event => syncSearch(event.target.value));
    els.searchInputLarge?.addEventListener('input', event => syncSearch(event.target.value));
    els.clearSearch?.addEventListener('click', () => syncSearch(''));
    els.clearSearchLarge?.addEventListener('click', () => syncSearch(''));
    els.profileButton?.addEventListener('click', () => navigateTo('profile'));
    els.reviewCart?.addEventListener('click', iniciarCheckout);
    els.promoBanners?.addEventListener('click', event => {
      const card = event.target.closest('[data-promo-action]');
      if (!card) return;
      state.marketFilter = 'offers';
      state.section = '';
      state.query = '';
      navigateTo('products');
    });
    els.couponCode?.addEventListener('input', event => {
      syncCouponFromInput(state, event.target.value);
      renderLoyaltyCard();
    });
    els.cartCouponCode?.addEventListener('input', event => {
      syncCouponFromInput(state, event.target.value);
      renderLoyaltyCard();
    });
    els.usePointsIntent?.addEventListener('change', event => {
      syncUsePointsIntent(state, event.target.checked);
      renderLoyaltyCard();
    });
    els.cartUsePointsIntent?.addEventListener('change', event => {
      syncUsePointsIntent(state, event.target.checked);
      renderLoyaltyCard();
    });
    els.copyInviteCode?.addEventListener('click', async () => {
      const code = String(state.cliente?.codigoIndicacao || state.cliente?.codigo_indicacao || state.loyalty?.codigoIndicacao || '').trim();
      const text = code || 'Abra o Mercadinho M&J pelo Telegram.';
      try {
        await navigator.clipboard?.writeText?.(text);
        showToast(code ? 'Código copiado' : 'Convite copiado');
      } catch (_) {
        showToast(text);
      }
    });
    els.closeCart?.addEventListener('click', () => setCartOpen(false));
    els.closeProductSheet?.addEventListener('click', closeProductSheet);
    els.productSheetBackdrop?.addEventListener('click', closeProductSheet);
    els.clearCartDrawer?.addEventListener('click', () => {
      if (!state.cart.size) return;
      clearCart(state, () => limparClientOrderIdPendente(state));
      handlers.syncCartAction?.('cart/clear', {});
      trackMiniAppEvent('cart_update', { action: 'clear', itemCount: 0 });
      if (els.cartNotes) els.cartNotes.value = '';
      render();
      showToast('Carrinho limpo');
    });
    els.continueToDelivery?.addEventListener('click', () => {
      if (!cartItems(state).length) return showToast('Seu carrinho está vazio');
      navigateTo('delivery');
    });
    els.deliveryBack?.addEventListener('click', () => navigateTo('cart'));
    els.bottomNav?.addEventListener('click', event => {
      const btn = event.target.closest('[data-nav-page]');
      if (!btn) return;
      navigateTo(btn.dataset.navPage || 'home');
    });
    document.addEventListener('click', event => {
      const nav = event.target.closest('[data-nav-page]');
      if (nav && !nav.closest('#bottomNav')) {
        event.preventDefault();
        navigateTo(nav.dataset.navPage || 'home');
        return;
      }
      const courier = event.target.closest('[data-open-courier]');
      if (courier) {
        navigateTo('courier');
      }
    });
    els.ordersList?.addEventListener('click', event => {
      const pixButton = event.target.closest('[data-order-pix]');
      const trackingButton = event.target.closest('[data-order-track]');
      if (pixButton) {
        handlers.showPix?.(pixButton.dataset.orderPix);
        return;
      }
      if (trackingButton) handlers.showTracking?.(trackingButton.dataset.orderTrack);
    });
    els.trackingContent?.addEventListener('click', event => {
      const pixButton = event.target.closest('[data-order-pix]');
      if (pixButton) handlers.showPix?.(pixButton.dataset.orderPix);
      if (event.target.closest('[data-open-courier]')) navigateTo('courier');
    });
    els.pixContent?.addEventListener('click', event => {
      if (event.target.closest('[data-copy-pix]')) handlers.copyPix?.();
      if (event.target.closest('[data-refresh-pix], [data-refresh-pix-primary]')) handlers.refreshPix?.();
      if (event.target.closest('[data-send-receipt]')) handlers.sendReceipt?.();
    });
    els.pixContent?.addEventListener('change', event => {
      const input = event.target.closest('[data-send-receipt-file]');
      if (!input) return;
      const file = input.files?.[0] || null;
      if (file) handlers.sendReceipt?.(file);
      input.value = '';
    });
    els.loyaltyContent?.addEventListener('click', event => {
      if (event.target.closest('[data-share-referral]')) handlers.shareReferral?.();
      const btn = event.target.closest('[data-nav-page]');
      if (btn) navigateTo(btn.dataset.navPage || 'home');
    });
    els.profileContent?.addEventListener('click', event => {
      const btn = event.target.closest('[data-nav-page]');
      if (btn) navigateTo(btn.dataset.navPage || 'home');
    });
    window.addEventListener('beforeunload', () => {
      if (state.pollTimer) window.clearInterval(state.pollTimer);
      if (state.storeStatusTimer) window.clearInterval(state.storeStatusTimer);
    });
  }

  bindEvents();

  return {
    els,
    render,
    showToast,
    renderJourney,
    renderOrders,
    renderStatusLoja,
    navigateTo,
    setCartOpen,
    iniciarCheckout,
    renderViniAIAlert
  };
}

