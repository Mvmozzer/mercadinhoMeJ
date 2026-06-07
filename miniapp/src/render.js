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
    <div class="app">
      <header class="delivery-app-header" id="marketHero">
        <div class="delivery-hero-top">
          <img class="delivery-logo" id="deliveryLogo" src="assets/logo-mj-mercadinho.png" alt="Mercadinho M&J">
          <div class="delivery-brand">
            <h1>Mercadinho M&J</h1>
            <div class="delivery-status-line">
              <span class="status-dot"></span>
              <span class="status-open" id="storeStatus">Aberto agora</span>
              <span id="channelLabel" hidden>Compra no Mini App</span>
            </div>
          </div>
          <div class="delivery-actions">
            <button class="hero-action-button cart-action" id="cartButton" type="button" aria-label="Abrir carrinho">
              <span aria-hidden="true">&#128722;</span>
            </button>
            <button class="hero-action-button profile-action" id="profileButton" type="button" aria-label="Abrir perfil">
              <span aria-hidden="true">&#128100;</span>
            </button>
          </div>
        </div>

        <div class="customer-header" id="customerHeader">
          <strong id="customerGreeting">Ola!</strong>
          <span id="customerAddressLine">Informe seu endereco para entrega</span>
        </div>
      </header>

      <main>
        <section class="store-search-panel" id="searchPanel" aria-label="Busca">
          <div class="search-row">
            <div class="search-wrap">
              <span aria-hidden="true">&#128269;</span>
              <input id="search" type="search" placeholder="O que voce precisa hoje?" autocomplete="off">
            </div>
            <button class="scan-button" id="clearSearch" type="button" aria-label="Limpar busca">
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
        </section>

        <nav class="quick-category-rail" id="categoryRail" aria-label="Categorias principais"></nav>
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
            <span>Use a busca para achar produtos rapido e monte sua compra sem sair do Mini App.</span>
          </div>
        </section>

        <section class="marketplace-home miniapp-page" id="marketHome" data-page="home" aria-label="Vitrine do Mercadinho">
          <div class="miniapp-design-home-slot" data-design-slot="home-top"></div>
          <section class="promo-banners" id="promoBanners" aria-label="Promocoes e beneficios"></section>

          <section class="loyalty-card" id="loyaltyInviteCard" hidden>
            <div class="section-head">
              <h2>Pontos e indicacao</h2>
              <span id="pointsBalanceLabel">Saldo em consulta</span>
            </div>
            <p>Convide amigos e ganhe pontos quando a primeira compra deles for confirmada. Pontos e cupons sao validados pela loja antes do Pix.</p>
            <div class="coupon-row">
              <input id="couponCode" type="text" inputmode="text" autocomplete="off" maxlength="40" placeholder="Cupom ou codigo de indicacao">
              <button class="ghost" id="copyInviteCode" type="button">Convidar amigo</button>
            </div>
            <label class="toggle-line">
              <input id="usePointsIntent" type="checkbox">
              Usar pontos se a loja liberar no fechamento
            </label>
          </section>

          <div class="filter-chips" id="marketFilters" aria-label="Filtros rapidos" hidden>
            <button class="filter-chip" type="button" data-market-filter="">Todos</button>
            <button class="filter-chip" type="button" data-market-filter="offers">Ofertas</button>
            <button class="filter-chip" type="button" data-market-filter="best_sellers">Mais vendidos</button>
            <button class="filter-chip" type="button" data-market-sort="price_asc">Menor preco</button>
          </div>

          <section class="market-row" id="buyAgainSection" aria-label="Compre de novo"></section>
          <section class="market-row" id="bestSellersSection" aria-label="Mais vendidos"></section>
          <section class="market-row" id="todayOffersSection" aria-label="Ofertas de hoje"></section>
          <section class="market-row" id="comboSection" aria-label="Combos sugeridos"></section>
          <section class="market-row" id="lowStockSection" aria-label="Produtos perto de acabar"></section>
        </section>

        <section class="orders-panel miniapp-page" id="ordersPanel" data-page="orders" hidden>
          <div class="section-head">
            <h2>Meus pedidos</h2>
            <span id="authStatus">Conectando</span>
          </div>
          <div id="ordersList"></div>
        </section>

        <section class="pix-panel miniapp-page" id="pixPanel" data-page="payment" hidden>
          <div class="section-head">
            <h2>Pix do pedido</h2>
            <span id="pixStatus">Aguardando</span>
          </div>
          <div id="pixContent"></div>
        </section>

        <section class="loyalty-panel miniapp-page" id="loyaltyPanel" data-page="loyalty" hidden>
          <div class="section-head">
            <h2>Meus pontos</h2>
            <span id="loyaltyBalance">0 pontos</span>
          </div>
          <div id="loyaltyContent"></div>
        </section>

        <section class="profile-panel miniapp-page" id="profilePanel" data-page="profile" hidden>
          <div class="section-head">
            <h2>Perfil e conta</h2>
            <span id="profileStatus">Mini App</span>
          </div>
          <div id="profileContent"></div>
        </section>

        <section class="tracking-panel miniapp-page" id="trackingPanel" data-page="tracking" hidden>
          <div class="section-head">
            <h2>Acompanhar entrega</h2>
            <span id="trackingStatus">Atualizando</span>
          </div>
          <div id="trackingContent"></div>
          <div class="map-box" id="trackingMap"></div>
        </section>

        <section class="miniapp-page catalog-page" id="categoriesPage" data-page="categories" hidden>
          <div class="section-head">
            <h2>Categorias e busca</h2>
            <span>Escolha uma secao</span>
          </div>
          <div id="categoriesPageList" class="category-page-list"></div>
        </section>

        <div class="miniapp-page" id="products" data-page="products" hidden></div>
      </main>
    </div>

    <aside class="cart-drawer miniapp-page cart-page" id="cartDrawer" data-page="cart" aria-label="Carrinho" hidden>
      <div class="cart-head">
        <div class="cart-head-copy">
          <h2>Seu carrinho</h2>
          <small id="cartHeadHint">Seu carrinho esta pronto. Agora vamos gerar o Pix dentro do Mini App.</small>
        </div>
        <button class="ghost" id="closeCart" type="button">Continuar comprando</button>
      </div>
      <div class="cart-list" id="cartList"></div>
      <div class="cart-foot">
        <span class="checkout-step-label" id="checkoutStepLabel">Carrinho pronto para o Telegram</span>
        <div class="summary-line">
          <span id="itemsCount">Carrinho vazio</span>
          <strong id="drawerTotal">R$ 0,00</strong>
        </div>
        <div class="cart-breakdown">
          <div class="cart-breakdown-row">
            <span>Subtotal dos produtos</span>
            <strong id="drawerSubtotal">R$ 0,00</strong>
          </div>
          <div class="cart-breakdown-row">
            <span>Entrega e Pix</span>
            <strong id="drawerDelivery">No Mini App</strong>
          </div>
          <div class="cart-breakdown-row total">
            <span>Total no carrinho</span>
            <strong id="drawerGrandTotal">R$ 0,00</strong>
          </div>
        </div>
        <div class="cart-perks" id="cartPerksPanel">
          <strong>Beneficios para validar no backend</strong>
          <div class="coupon-row">
            <input id="cartCouponCode" type="text" inputmode="text" autocomplete="off" maxlength="40" placeholder="Cupom ou codigo de indicacao">
          </div>
          <label class="toggle-line">
            <input id="cartUsePointsIntent" type="checkbox">
            Tentar usar meus pontos no fechamento
          </label>
          <label>Usar pontos neste pedido
            <input id="checkoutPoints" type="number" min="0" step="1" inputmode="numeric" placeholder="0">
          </label>
          <div class="cart-progress" id="freeDeliveryHint">O valor final, entrega, descontos e pontos serao recalculados com seguranca antes do Pix.</div>
          <div class="checkout-preview" id="checkoutPreviewBox">O backend vai recalcular produtos, estoque, frete, pontos e Pix.</div>
        </div>
        <label class="cart-notes" id="cartNotesPanel">Observacoes do pedido
          <textarea id="cartNotes" maxlength="500" placeholder="Ex: separar troco, evitar substituicoes ou detalhe importante"></textarea>
          <small id="cartNotesHint">O Pix sera gerado com o valor recalculado pela loja. A loja confirma o pagamento antes de preparar.</small>
        </label>
        <div class="checkout-form-panel miniapp-page checkout-subpage" id="checkoutFormPanel" data-page="delivery">
          <label>Modalidade
            <select id="deliveryMode">
              <option value="retirada">Retirada no local</option>
              <option value="entrega">Entrega</option>
            </select>
          </label>
          <div class="delivery-address-summary" id="deliveryAddressSummary" hidden>
            <div>
              <strong id="deliveryAddressTitle">Endereco cadastrado</strong>
              <span id="deliveryAddressText">Escolha entrega para usar seu endereco.</span>
              <small id="deliveryAddressCep"></small>
            </div>
            <button class="ghost" id="editDeliveryAddress" type="button">Alterar endereco de entrega</button>
          </div>
          <div class="checkout-address-grid" id="checkoutAddressGrid">
            <label>CEP <input id="checkoutCep" type="text" inputmode="numeric" autocomplete="postal-code"></label>
            <label>Rua <input id="checkoutRua" type="text" autocomplete="address-line1"></label>
            <label>Numero <input id="checkoutNumero" type="text" autocomplete="address-line2"></label>
            <label>Complemento <input id="checkoutComplemento" type="text" autocomplete="address-line2"></label>
            <label>Bairro <input id="checkoutBairro" type="text" autocomplete="address-level3"></label>
            <label>Cidade <input id="checkoutCidade" type="text" autocomplete="address-level2"></label>
            <label>Estado <input id="checkoutEstado" type="text" maxlength="2" autocomplete="address-level1"></label>
            <label>Telefone <input id="checkoutPhone" type="tel" inputmode="tel" autocomplete="tel"></label>
          </div>
          <label class="toggle-line delivery-save-line" id="saveDeliveryAddressLine" hidden>
            <input id="saveDeliveryAddressToProfile" type="checkbox">
            Salvar este endereco no meu cadastro
          </label>
        </div>
        <div class="checkout-stage" id="cartStepPanel">
          <small id="checkoutHint">Falta pouco: escolha entrega ou retirada, revise os pontos e gere o Pix.</small>
          <button class="primary" id="continueToDelivery" type="button" aria-label="Continuar" disabled>Continuar</button>
        </div>
        <button class="danger" id="clearCartDrawer" type="button" disabled>Limpar carrinho</button>
      </div>
    </aside>

    <div class="sheet-backdrop" id="productSheetBackdrop" hidden></div>
    <aside class="product-sheet miniapp-page product-detail-page" id="productSheet" data-page="product" aria-label="Detalhe do produto" hidden>
      <div class="sheet-head">
        <strong>Detalhe do produto</strong>
        <button class="ghost" id="closeProductSheet" type="button">Fechar</button>
      </div>
      <div class="sheet-body" id="productSheetBody"></div>
    </aside>

    <footer class="bottom-bar" id="stickyCartBar" hidden>
      <div class="bottom-main">
        <div class="bottom-cart-icon" aria-hidden="true">&#128722;</div>
        <div class="bottom-total">
          <strong id="bottomCount">Carrinho vazio</strong>
          <span>Total: <b id="total">R$ 0,00</b></span>
          <small id="bottomFreeDeliveryHint">Falta R$ 0,00 para frete gratis</small>
        </div>
        <button class="gold" id="reviewCart" type="button">Ver carrinho</button>
      </div>
    </footer>

    <nav class="miniapp-bottom-nav" id="bottomNav" aria-label="Navegacao principal">
      <button type="button" data-nav-page="home">Inicio</button>
      <button type="button" data-nav-page="categories">Categorias</button>
      <button type="button" data-nav-page="cart">Carrinho</button>
      <button type="button" data-nav-page="orders">Pedidos</button>
      <button type="button" data-nav-page="loyalty">Pontos</button>
      <button type="button" data-nav-page="profile">Perfil</button>
    </nav>

    <div class="toast" id="toast" role="status" aria-live="polite"></div>
  `;
}

function collectElements() {
  const ids = [
    'tabs', 'channelLabel', 'journeyTitle', 'journeyStatus', 'journeySteps',
    'marketHome', 'marketHero', 'deliveryLogo',
    'customerGreeting', 'customerAddressLine', 'profileButton', 'searchPanel', 'categoryRail',
    'promoBanners', 'loyaltyInviteCard', 'pointsBalanceLabel', 'couponCode',
    'copyInviteCode', 'usePointsIntent', 'marketFilters', 'buyAgainSection',
    'bestSellersSection', 'todayOffersSection', 'comboSection', 'lowStockSection',
    'pixPanel', 'pixStatus', 'pixContent', 'loyaltyPanel', 'loyaltyBalance',
    'loyaltyContent', 'profilePanel', 'profileStatus', 'profileContent',
    'trackingPanel', 'trackingStatus', 'trackingContent',
    'trackingMap', 'products', 'search', 'clearSearch', 'cartButton', 'cartDrawer', 'closeCart',
    'cartList', 'itemsCount', 'bottomCount', 'bottomFreeDeliveryHint', 'total',
    'drawerTotal', 'drawerSubtotal', 'drawerDelivery', 'drawerGrandTotal',
    'cartCouponCode', 'cartUsePointsIntent', 'freeDeliveryHint', 'cartNotes', 'cartPerksPanel', 'cartNotesPanel',
    'cartHeadHint', 'cartNotesHint', 'checkoutStepLabel', 'cartStepPanel',
    'checkoutHint', 'checkoutFormPanel', 'deliveryMode', 'deliveryAddressSummary',
    'deliveryAddressTitle', 'deliveryAddressText', 'deliveryAddressCep', 'editDeliveryAddress',
    'checkoutAddressGrid', 'saveDeliveryAddressLine', 'saveDeliveryAddressToProfile',
    'checkoutCep', 'checkoutRua', 'checkoutNumero', 'checkoutComplemento',
    'checkoutBairro', 'checkoutCidade', 'checkoutEstado', 'checkoutPhone',
    'checkoutPoints', 'checkoutPreviewBox', 'continueToDelivery', 'clearCartDrawer', 'reviewCart',
    'stickyCartBar', 'productSheetBackdrop', 'productSheet', 'productSheetBody',
    'closeProductSheet', 'viniAiOutdoor', 'viniAiAlert', 'storeStatus',
    'ordersPanel', 'ordersList', 'authStatus', 'categoriesPage', 'categoriesPageList',
    'bottomNav', 'toast'
  ];
  return Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
}

function designConfig(state) {
  return state.miniappDesign || {};
}

function designBanner(state) {
  const design = designConfig(state);
  return Array.isArray(design.banners?.itens) && design.banners.itens.length
    ? design.banners.itens[0]
    : null;
}

function designHighlights(state) {
  const design = designConfig(state);
  const defaults = [
    { id: 'ofertas', tone: 'offer', title: 'Ofertas da semana', body: 'Descontos selecionados pela loja', visual: '%', cta: 'Ver ofertas', action: 'ofertas', image: '' },
    { id: 'combos', tone: 'combo', title: 'Combos economicos', body: 'Mais produtos, mais economia!', visual: '+', cta: 'Ver combos', action: 'combos', image: '' },
    { id: 'pontos', tone: 'points', title: 'Acumule pontos', body: 'Comprou, ganhou desconto futuro', visual: '*', cta: 'Meus pontos', action: 'loyalty', image: '' },
    { id: 'indicacao', tone: 'invite', title: 'Indique e ganhe', body: 'Chame amigos e ganhe recompensas!', visual: 'I', cta: 'Quero indicar', action: 'loyalty', image: '' }
  ];
  const configured = Array.isArray(design.destaques?.itens) ? design.destaques.itens : [];
  const byId = new Map(configured.map(item => [String(item.id || '').trim(), item]));
  return defaults
    .map((fallback, index) => {
      const item = byId.get(fallback.id) || configured[index] || {};
      return {
        id: String(item.id || fallback.id),
        tone: String(item.tom || item.tone || fallback.tone),
        title: String(item.titulo || item.title || fallback.title),
        body: String(item.subtitulo || item.body || fallback.body),
        visual: String(item.emoji || item.visual || fallback.visual),
        cta: String(item.cta || fallback.cta),
        action: String(item.acao || item.action || fallback.action),
        image: String(item.imagem || item.imageUrl || item.image || fallback.image),
        active: item.ativo !== false,
        order: Number(item.ordem || index + 1)
      };
    })
    .filter(item => item.active)
    .sort((a, b) => a.order - b.order);
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
    const paginas = new Set(['home', 'categories', 'products', 'product', 'cart', 'delivery', 'payment', 'orders', 'tracking', 'loyalty', 'profile']);
    return paginas.has(state.currentPage) ? state.currentPage : 'home';
  }

  function navigateTo(page, options = {}) {
    const next = page === 'identify' ? 'home' : page;
    state.currentPage = next;
    if (next !== 'product' && !options.keepProduct) state.productSheetId = '';
    if (next === 'products' && options.section !== undefined) {
      state.section = options.section || '';
      state.query = '';
      state.marketFilter = '';
      state.marketSort = '';
    }
    render();
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
    trackMiniAppEvent('page_view', { page: next });
  }

  function etapaJornadaAtual() {
    if (state.currentPage === 'cart') return 'carrinho';
    if (state.currentPage === 'delivery') return 'entrega';
    if (state.currentPage === 'payment') return state.pix?.copiaCola ? 'pix' : 'pagamento';
    if (state.currentPage === 'tracking') return 'acompanhar';
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
      ['pix', 'Pix'],
      ['confirmado', 'Confirmado'],
      ['acompanhar', 'Acompanhar']
    ];
    const indiceAtual = etapas.findIndex(([id]) => id === atual);
    if (els.journeySteps) {
      els.journeySteps.innerHTML = etapas.map(([id, label], index) => {
        const classe = index < indiceAtual ? 'done' : (id === atual ? 'active' : '');
        return `<span class="journey-step ${classe}">${escapeHtml(label)}</span>`;
      }).join('');
    }
    if (els.journeyStatus) {
      const labels = {
        catalogo: 'Escolha produtos',
        carrinho: 'Seu carrinho esta pronto',
        entrega: 'Entrega ou retirada',
        pagamento: 'Pagamento no Mini App',
        pix: 'Pix no Mini App',
        confirmado: 'Pedido confirmado',
        acompanhar: 'Acompanhe seu pedido'
      };
      els.journeyStatus.textContent = labels[atual] || 'Compra no Mini App';
    }
  }

  function firstName(value = '') {
    return String(value || '').trim().split(/\s+/).filter(Boolean)[0] || '';
  }

  function customerName() {
    const cliente = state.cliente || {};
    const telegramUser = state.telegramUser || {};
    return firstName(cliente.nome || cliente.telegramNome || telegramUser.first_name || '');
  }

  function customerAddress() {
    const cliente = state.cliente || {};
    const rua = String(cliente.rua || '').trim();
    if (!rua) return '';
    const partes = [
      [rua, cliente.numero].filter(Boolean).join(', '),
      cliente.bairro
    ].filter(Boolean);
    return partes.join(' - ');
  }

  function logoUrlMiniApp() {
    const design = designConfig(state);
    return String(
      design.logoUrl ||
      design.theme?.logoUrl ||
      design.tema?.logoUrl ||
      state.bootstrap?.loja?.logo ||
      'assets/logo-mj-mercadinho.png'
    ).trim() || 'assets/logo-mj-mercadinho.png';
  }

  function renderCustomerHeader() {
    if (els.deliveryLogo) {
      els.deliveryLogo.src = logoUrlMiniApp();
    }
    if (els.customerGreeting) {
      const nome = customerName();
      els.customerGreeting.textContent = nome ? `Ola, ${nome}` : 'Ola!';
    }
    if (els.customerAddressLine) {
      els.customerAddressLine.textContent = customerAddress() || 'Informe seu endereco para entrega';
    }
  }

  function renderOrders() {
    if (!els.ordersPanel || !els.ordersList) return;
    if (!state.orders.length) {
      els.ordersList.innerHTML = '<div class="empty">Quando seu primeiro pedido for enviado, o acompanhamento aparece aqui.</div>';
      return;
    }
    els.ordersList.innerHTML = state.orders.slice(0, 5).map(order => {
      const status = order.statusDetalhe?.label || order.status || 'aguardando';
      return `
        <div class="order-mini">
          <span>
            <strong>Pedido #${escapeHtml(order.id)}</strong>
            <small>${escapeHtml(status)} | ${escapeHtml(money(order.total))} | pagamento ${escapeHtml(order.pagamento?.status || order.statusPagamento || 'pendente')}</small>
          </span>
          <div class="actions">
            <button class="ghost" type="button" data-order-pix="${escapeHtml(order.id)}">Ver Pix</button>
            <button class="ghost" type="button" data-order-track="${escapeHtml(order.id)}">Acompanhar</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderPixPanel() {
    if (!els.pixPanel || !els.pixContent) return;
    const pix = state.pix || state.pedidoAtual?.pix || null;
    if (!pix?.copiaCola) {
      els.pixContent.innerHTML = '<div class="empty">Revise o pedido e gere o Pix para pagar dentro do Mini App.</div>';
      return;
    }
    if (els.pixStatus) els.pixStatus.textContent = pix.status || state.pedidoAtual?.statusPagamento || 'Aguardando pagamento';
    els.pixContent.innerHTML = `
      <div class="pix-card">
        <div class="summary-line">
          <span>Pedido</span>
          <strong>#${escapeHtml(state.pedidoAtual?.id || '')}</strong>
        </div>
        <div class="summary-line">
          <span>Valor</span>
          <strong>${escapeHtml(money(pix.valor || state.pedidoAtual?.total || 0))}</strong>
        </div>
        <div class="summary-line">
          <span>Recebedor</span>
          <strong>${escapeHtml(pix.recebedor || 'Mercadinho M&J')}</strong>
        </div>
        ${pix.txid ? `<div class="summary-line"><span>TXID</span><strong>${escapeHtml(pix.txid)}</strong></div>` : ''}
        ${pix.qrCodeDataUrl ? `<img class="pix-qr" src="${escapeHtml(pix.qrCodeDataUrl)}" alt="QR Code do Pix">` : ''}
        <label class="pix-copy">Pix copia e cola
          <textarea readonly>${escapeHtml(pix.copiaCola)}</textarea>
        </label>
        <label class="receipt-upload">Enviar comprovante Pix
          <input type="file" data-send-receipt-file accept="image/png,image/jpeg,image/webp,application/pdf">
        </label>
        <div class="checkout-actions">
          <button class="primary" type="button" data-copy-pix>Copiar Pix</button>
          <button class="ghost" type="button" data-refresh-pix>Atualizar pagamento</button>
          <button class="ghost" type="button" data-send-receipt>Ja paguei / enviar observacao</button>
        </div>
        <small>A loja vai conferir seu pagamento antes de preparar o pedido.</small>
      </div>
    `;
  }

  function renderLoyaltyPanel() {
    if (!els.loyaltyPanel || !els.loyaltyContent) return;
    const loyalty = state.loyalty || {};
    if (!state.authOk) {
      els.loyaltyContent.innerHTML = '<div class="empty">Entre pelo Telegram ou use o modo dev para consultar pontos.</div>';
      return;
    }
    if (els.loyaltyBalance) els.loyaltyBalance.textContent = `${Number(loyalty.saldoPontos || loyalty.pontosDisponiveis || 0)} pontos`;
    const historico = Array.isArray(loyalty.historico) ? loyalty.historico.slice(0, 5) : [];
    const fidelidade = designConfig(state).fidelidade || {};
    const imagemCapa = String(fidelidade.imagemCapa || fidelidade.imageUrl || '').trim();
    els.loyaltyContent.innerHTML = `
      <div class="loyalty-hero">
        ${imagemCapa ? `<img src="${escapeHtml(imagemCapa)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<span aria-hidden="true">⭐</span>'}
        <div>
          <strong>${escapeHtml(fidelidade.titulo || 'Programa Fidelidade')}</strong>
          <small>Use seus pontos como desconto quando as regras da loja permitirem.</small>
        </div>
      </div>
      <div class="loyalty-summary">
        <strong>${Number(loyalty.saldoPontos || loyalty.pontosDisponiveis || 0)} pontos</strong>
        <span>${escapeHtml(money(loyalty.saldoReais || loyalty.valorPontosReais || 0))} em saldo equivalente</span>
        <small>Codigo: ${escapeHtml(loyalty.codigoIndicacao || 'indisponivel')}</small>
      </div>
      <div class="checkout-actions">
        <button class="ghost" type="button" data-share-referral>Compartilhar codigo</button>
        <button class="primary" type="button" data-nav-page="cart">${escapeHtml(fidelidade.botao || 'Trocar pontos no carrinho')}</button>
      </div>
      <div class="points-box">
        <strong>Regras do clube</strong>
        <small>Minimo: ${Number(loyalty.regras?.minimoPontos || loyalty.minPontosResgate || 0)} pontos. Maximo no pedido: ${Number(loyalty.regras?.percentualMaximoPedido || loyalty.percentualMaximoPedido || 75)}%.</small>
        <small>Pontos sao liberados apos status ${escapeHtml(loyalty.regras?.liberarAposStatus || 'entregue')}.</small>
      </div>
      ${historico.length ? historico.map(item => `
        <div class="order-mini">
          <span><strong>${Number(item.pontos || 0)} pontos</strong><small>${escapeHtml(item.descricao || item.tipo || '')}</small></span>
          <small>${escapeHtml(item.status || '')}</small>
        </div>
      `).join('') : '<div class="empty">Historico de pontos ainda vazio.</div>'}
    `;
  }

  function renderProfilePanel() {
    if (!els.profilePanel || !els.profileContent) return;
    const cliente = state.cliente || {};
    const telegram = state.telegramUser || {};
    const endereco = [cliente.rua, cliente.numero, cliente.bairro, cliente.cidade, cliente.estado].filter(Boolean).join(', ');
    if (els.profileStatus) {
      els.profileStatus.textContent = state.authOk ? 'Identificado' : 'Aguardando Telegram';
    }
    els.profileContent.innerHTML = `
      <div class="profile-card">
        <div class="summary-line">
          <span>Nome</span>
          <strong>${escapeHtml(cliente.nome || telegram.first_name || 'Cliente')}</strong>
        </div>
        <div class="summary-line">
          <span>Telefone</span>
          <strong>${escapeHtml(cliente.telefone || 'Nao informado')}</strong>
        </div>
        <div class="summary-line">
          <span>Endereco</span>
          <strong>${escapeHtml(endereco || 'Informado no checkout')}</strong>
        </div>
        <div class="summary-line">
          <span>Pontos</span>
          <strong>${Number(state.loyalty?.saldoPontos || state.loyalty?.pontosDisponiveis || 0)} pts</strong>
        </div>
        <small>Dados sensiveis nao sao exibidos no Mini App. A loja valida endereco, pontos e pagamento no backend.</small>
      </div>
    `;
  }

  function renderTrackingPanel() {
    if (!els.trackingPanel || !els.trackingContent) return;
    const tracking = state.tracking || null;
    if (!tracking) {
      els.trackingContent.innerHTML = '<div class="empty">Escolha um pedido para acompanhar o status e a entrega.</div>';
      if (els.trackingMap) els.trackingMap.innerHTML = '<div class="map-fallback">Localizacao indisponivel ate o pedido sair para entrega.</div>';
      return;
    }
    const status = tracking.status || state.pedidoAtual?.status || '';
    if (els.trackingStatus) els.trackingStatus.textContent = tracking.statusDetalhe?.label || status || 'Acompanhando';
    const map = mapStateFromTracking(tracking);
    const steps = timelineSteps(status);
    els.trackingContent.innerHTML = `
      <div class="timeline">
        ${steps.map(step => `<span class="journey-step ${step.done ? 'done' : ''} ${step.active ? 'active' : ''}">${escapeHtml(step.label)}</span>`).join('')}
      </div>
      <div class="points-box">
        <strong>${escapeHtml(tracking.entrega?.entregador || tracking.entrega?.status || 'Entrega')}</strong>
        <small>${escapeHtml(map.mensagem || 'Aguardando compartilhamento da localizacao.')}</small>
        ${map.atualizadaEm ? `<small>Atualizado em ${escapeHtml(map.atualizadaEm)}</small>` : ''}
        ${fallbackGoogleMapsLink(tracking) ? `<a class="ghost map-link" href="${escapeHtml(fallbackGoogleMapsLink(tracking))}" target="_blank" rel="noreferrer">Abrir no Maps</a>` : ''}
      </div>
    `;
    if (els.trackingMap) {
      if (designConfig(state).acompanhamentoMapa === false) {
        els.trackingMap.innerHTML = '<div class="map-fallback">Localizacao do motoboy desativada pela loja.</div>';
        return;
      }
      els.trackingMap.innerHTML = map.aoVivo && map.mapaUrl
        ? `<iframe title="Mapa do motoboy" src="${escapeHtml(map.mapaUrl)}" loading="lazy" referrerpolicy="no-referrer"></iframe>`
        : `<div class="map-fallback">${escapeHtml(map.mensagem || 'Mapa indisponivel agora.')}</div>`;
    }
  }

  function renderStatusLoja() {
    if (!els.storeStatus) return;
    const textos = {
      aberta: 'Aberto agora',
      pausada: 'Pedidos pausados',
      fechada: 'Fechado para pedidos'
    };
    const status = state.loja.status || 'aberta';
    els.storeStatus.textContent = textos[status] || textos.aberta;
    els.storeStatus.classList.remove('ok', 'warn', 'closed');
    els.storeStatus.classList.add(status === 'fechada' ? 'closed' : (status === 'pausada' ? 'warn' : 'ok'));
    els.storeStatus.title = state.loja.mensagem || '';
  }

  function renderPageVisibility() {
    const page = paginaAtualSegura();
    state.currentPage = page;
    document.querySelectorAll('.miniapp-page').forEach(el => {
      const target = String(el.dataset.page || '');
      const visible = target === page || (page === 'payment' && target === 'payment');
      el.hidden = !visible;
      el.classList.toggle('active-page', visible);
    });
    if (els.searchPanel) els.searchPanel.hidden = !['home', 'categories', 'products'].includes(page);
    if (els.categoryRail) els.categoryRail.hidden = !['home', 'categories', 'products'].includes(page);
    if (els.marketFilters) els.marketFilters.hidden = !['categories', 'products'].includes(page);
    if (els.marketHero) els.marketHero.hidden = false;
    if (els.bottomNav) {
      els.bottomNav.hidden = ['cart', 'delivery', 'payment', 'product'].includes(page);
      els.bottomNav.querySelectorAll('[data-nav-page]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.navPage === page || (btn.dataset.navPage === 'home' && page === 'products'));
      });
    }
    const cartFlow = ['cart', 'delivery', 'payment'].includes(page) && !state.pix?.copiaCola;
    if (els.cartDrawer) els.cartDrawer.hidden = !cartFlow;
    els.cartDrawer?.classList.toggle('open', cartFlow);
    els.cartDrawer?.classList.toggle('as-page', cartFlow);
    if (els.checkoutFormPanel) els.checkoutFormPanel.hidden = page !== 'delivery';
    if (els.cartPerksPanel) els.cartPerksPanel.hidden = page !== 'payment';
    if (els.cartNotesPanel) els.cartNotesPanel.hidden = page !== 'payment';
    if (els.productSheetBackdrop) els.productSheetBackdrop.hidden = true;
    els.productSheet?.classList.toggle('open', page === 'product');
    els.productSheet?.classList.toggle('as-page', page === 'product');
  }

  function renderTabs() {
    if (!els.tabs) return;
    els.tabs.innerHTML = '';
    const buttons = [
      { label: 'Todos', section: '', count: state.products.length },
      ...sectionItems(state).map(section => ({ label: section.name, section: section.id, count: section.products }))
    ];
    buttons.forEach(item => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = item.section === state.section ? 'active' : '';
      button.textContent = item.label;
      button.setAttribute('aria-label', `${item.label}: ${item.count || 0} produtos`);
      button.addEventListener('click', () => {
        state.section = item.section;
        state.marketFilter = '';
        state.marketSort = '';
        if (state.catalogPage.usePaged) handlers.reloadCatalog?.();
        else render();
      });
      els.tabs.appendChild(button);
    });
  }

  function renderCategoryRail() {
    if (!els.categoryRail) return;
    const design = designConfig(state);
    const knownSections = sectionItems(state);
    const shortcuts = [
      { name: 'Ofertas', query: 'oferta' },
      { name: 'Mercearia', query: 'mercearia' },
      { name: 'Hortifruti', query: 'hortifruti' },
      { name: 'Bebidas', query: 'bebida' }
    ].map(shortcut => {
      const found = knownSections.find(section => normalizeText(section.name).includes(normalizeText(shortcut.query)));
      return { ...shortcut, id: found?.id || '', section: found?.id || '', search: found ? '' : shortcut.query, icon: iconForSection(found?.name || shortcut.name) };
    });
    const ordered = Array.isArray(design.categorias?.ordem) && design.categorias.ordem.length
      ? [
        ...design.categorias.ordem.map(id => knownSections.find(section => section.id === id)).filter(Boolean),
        ...knownSections.filter(section => !design.categorias.ordem.includes(section.id))
      ]
      : knownSections;
    const sections = ordered
      .filter(section => !shortcuts.some(shortcut => shortcut.section === section.id))
      .slice(0, Math.max(0, Number(design.categorias?.limite || 8) - shortcuts.length))
      .map(section => ({ id: section.id, name: section.name, section: section.id, search: '', icon: iconForSection(section.name) }));
    const items = shortcuts.concat(sections);
    els.categoryRail.innerHTML = items.map(item => {
      const active = item.section === state.section || (!!item.search && normalizeText(state.query).includes(normalizeText(item.search)));
      const attr = item.section
        ? `data-section="${escapeHtml(item.section)}"`
        : `data-category-search="${escapeHtml(item.search)}"`;
      return `<button class="quick-category ${active ? 'active' : ''}" type="button" ${attr}><span class="category-icon">${escapeHtml(item.icon)}</span>${escapeHtml(item.name)}</button>`;
    }).join('');
    els.categoryRail.querySelectorAll('[data-section]').forEach(button => {
      button.addEventListener('click', () => {
        state.section = button.dataset.section || '';
        state.marketFilter = '';
        state.marketSort = '';
        trackMiniAppEvent('category_open', { section: state.section });
        navigateTo('products', { section: state.section });
        if (state.catalogPage.usePaged) handlers.reloadCatalog?.();
      });
    });
    els.categoryRail.querySelectorAll('[data-category-search]').forEach(button => {
      button.addEventListener('click', () => {
        state.section = '';
        state.marketFilter = '';
        state.marketSort = '';
        state.query = button.dataset.categorySearch || '';
        if (els.search) els.search.value = state.query;
        state.currentPage = 'products';
        trackMiniAppEvent('category_open', { search: state.query });
        if (state.catalogPage.usePaged) handlers.reloadCatalog?.();
        else render();
      });
    });
  }

  function renderPromoBanners(collections = homeCollections(state, cartItems(state))) {
    if (!els.promoBanners) return;
    const design = designConfig(state);
    if (design.banners?.ativo === false) {
      els.promoBanners.innerHTML = '';
      els.promoBanners.hidden = true;
      return;
    }
    els.promoBanners.hidden = false;
    const principal = designBanner(state);
    const banners = designHighlights(state);
    if (principal && banners[0]) {
      banners[0] = {
        ...banners[0],
        tone: principal.tom || banners[0].tone,
        title: principal.titulo || banners[0].title,
        body: principal.subtitulo || banners[0].body,
        visual: principal.emoji || banners[0].visual,
        cta: principal.cta || banners[0].cta,
        image: principal.imagem || principal.imageUrl || banners[0].image
      };
    }
    const visible = design.modo === 'avancado' ? banners : banners.slice(0, 1);
    els.promoBanners.innerHTML = visible.map(item => `
      <article class="promo-card" data-tone="${escapeHtml(item.tone)}" data-promo-action="${escapeHtml(item.action)}">
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.body)}</small>
        ${item.image
          ? `<img class="promo-image-3d" src="${escapeHtml(item.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
          : `<span class="promo-visual" aria-hidden="true">${escapeHtml(item.visual)}</span>`}
        <span class="promo-cta">${escapeHtml(item.cta)}</span>
      </article>
    `).join('');
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

  function compactProductCard(item, context = '') {
    const qty = cartQty(state, item.id);
    const card = document.createElement('article');
    card.className = `mini-product-card ${isLowStock(item) ? 'low-stock' : ''} ${Number(item.stock || 0) <= 0 ? 'unavailable' : ''}`;
    card.dataset.productId = item.id;
    const media = item.image
      ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" referrerpolicy="no-referrer">`
      : `<span>${escapeHtml(item.name.slice(0, 1).toUpperCase())}</span>`;
    const badge = item.promotion
      ? '<span class="market-badge">Oferta</span>'
      : isLowStock(item)
        ? '<span class="market-badge warn">Perto de acabar</span>'
        : context ? `<span class="market-badge">${escapeHtml(context)}</span>` : '';
    const control = Number(item.stock || 0) <= 0
      ? '<span class="stock-empty">Indisponivel</span>'
      : qty > 0
        ? `<div class="qty"><button type="button" data-action="minus" aria-label="Diminuir quantidade">-</button><span>${isWeightedProduct(item) ? formatMeasure(qty, item.unidadeVenda) : qty}</span><button type="button" data-action="plus" aria-label="Adicionar ao carrinho">+</button></div>`
        : '<button class="quick-add-button" type="button" data-action="plus" aria-label="Adicionar ao carrinho">+</button>';
    card.innerHTML = `
      <div class="mini-media">${media}</div>
      ${badge}
      <h3>${escapeHtml(item.name)}</h3>
      <small>${escapeHtml([item.brand, item.unit || item.sectionLabel].filter(Boolean).join(' | '))}</small>
      <div class="mini-card-bottom">
        <div class="price"><strong>${priceLabel(item)}</strong>${item.promotion ? `<del>${money(item.normalPrice)}</del>` : ''}</div>
        ${control}
      </div>
    `;
    card.addEventListener('click', event => {
      if (event.target.closest('button')) return;
      openProductSheet(item.id);
    });
    card.querySelector('[data-action="minus"]')?.addEventListener('click', () => onChangeQty(item.id, -1));
    card.querySelector('[data-action="plus"]')?.addEventListener('click', () => onChangeQty(item.id, 1));
    card.querySelector('[data-action="plus"]')?.toggleAttribute('disabled', qty >= item.stock);
    return card;
  }

  function renderProductRail(target, title, subtitle, items = [], emptyText = 'Produtos serao exibidos aqui quando houver dados.') {
    if (!target) return;
    target.hidden = false;
    target.innerHTML = `
      <div class="section-head">
        <h2>${escapeHtml(title)}</h2>
        <span>${escapeHtml(subtitle)}</span>
      </div>
      <div class="market-strip"></div>
    `;
    const strip = target.querySelector('.market-strip');
    if (!items.length) {
      strip.outerHTML = `<div class="market-empty">${escapeHtml(emptyText)}</div>`;
      return;
    }
    items.forEach(item => strip.appendChild(compactProductCard(item, subtitle)));
  }

  function renderLoyaltyCard() {
    if (!els.pointsBalanceLabel) return;
    const saldo = Number(state.cliente?.pontosDisponiveis ?? state.cliente?.saldoFidelidade ?? state.cliente?.pontosFidelidade ?? 0) || 0;
    els.pointsBalanceLabel.textContent = saldo > 0 ? `${saldo} pontos` : 'Pontos no Telegram';
    if (els.usePointsIntent) els.usePointsIntent.checked = state.usePointsIntent;
    if (els.cartUsePointsIntent) els.cartUsePointsIntent.checked = state.usePointsIntent;
    if (els.couponCode && els.couponCode.value !== state.couponCode) els.couponCode.value = state.couponCode;
    if (els.cartCouponCode && els.cartCouponCode.value !== state.couponCode) els.cartCouponCode.value = state.couponCode;
  }

  function renderMarketFilters() {
    if (!els.marketFilters) return;
    els.marketFilters.querySelectorAll('[data-market-filter]').forEach(button => {
      button.classList.toggle('active', String(button.dataset.marketFilter || '') === state.marketFilter && !state.marketSort);
    });
    els.marketFilters.querySelectorAll('[data-market-sort]').forEach(button => {
      button.classList.toggle('active', String(button.dataset.marketSort || '') === state.marketSort);
    });
  }

  function renderCategoriesPage() {
    if (!els.categoriesPageList) return;
    const sections = sectionItems(state);
    if (!sections.length) {
      els.categoriesPageList.innerHTML = '<div class="empty">Nenhuma categoria disponivel agora.</div>';
      return;
    }
    els.categoriesPageList.innerHTML = [
      `<button class="category-page-item" type="button" data-category-page-section="">
        <span class="category-icon">#</span>
        <strong>Todos os produtos</strong>
        <small>${state.products.length} produto(s)</small>
      </button>`,
      ...sections.map(section => `
        <button class="category-page-item" type="button" data-category-page-section="${escapeHtml(section.id)}">
          <span class="category-icon">${escapeHtml(iconForSection(section.name))}</span>
          <strong>${escapeHtml(section.name)}</strong>
          <small>${Number(section.products || 0)} produto(s)</small>
        </button>
      `)
    ].join('');
    els.categoriesPageList.querySelectorAll('[data-category-page-section]').forEach(button => {
      button.addEventListener('click', () => navigateTo('products', { section: button.dataset.categoryPageSection || '' }));
    });
  }

  function renderHome() {
    if (!els.marketHome) return;
    const design = designConfig(state);
    const searching = Boolean(state.query.trim()) || Boolean(state.section) || Boolean(state.marketFilter) || Boolean(state.marketSort);
    els.marketHome.hidden = searching;
    renderCategoryRail();
    renderMarketFilters();
    if (design.pontosIndicacao === false && els.loyaltyInviteCard) els.loyaltyInviteCard.hidden = true;
    else renderLoyaltyCard();
    if (searching) return;
    const collections = homeCollections(state, cartItems(state));
    renderPromoBanners(collections);
    renderProductRail(els.buyAgainSection, 'Comprar novamente', 'Ver todos', collections.buyAgain, 'Quando houver historico de compras, seus itens frequentes aparecem aqui.');
    if (els.bestSellersSection) {
      els.bestSellersSection.hidden = design.maisVendidos === false;
      if (design.maisVendidos !== false) renderProductRail(els.bestSellersSection, 'Mais vendidos', 'Ver todos', collections.bestSellers, 'Ranking real entra aqui quando o painel publicar vendas por produto.');
    }
    renderProductRail(els.todayOffersSection, 'Ofertas imperdiveis', 'Ver todas', collections.offers, 'Promocoes ativas aparecem aqui sem alterar preco real.');
    if (els.comboSection) els.comboSection.hidden = true;
    if (els.lowStockSection) els.lowStockSection.hidden = true;
  }

  function productCard(item) {
    const qty = cartQty(state, item.id);
    const card = document.createElement('article');
    const semEstoque = Number(item.stock || 0) <= 0;
    card.className = `product ${semEstoque ? 'unavailable' : ''}`;
    card.dataset.productId = item.id;
    const media = item.image
      ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" referrerpolicy="no-referrer">`
      : `<span>${escapeHtml(item.name.slice(0, 1).toUpperCase())}</span>`;
    const detalhesPeso = isWeightedProduct(item) ? `${priceLabel(item)} | vendido por peso` : item.unit;
    const estoqueTexto = semEstoque
      ? 'Sem estoque'
      : isWeightedProduct(item)
        ? `${formatMeasure(item.stock, item.unidadeVenda || item.unit)} disp.`
        : `${item.stock} disp.`;
    const details = [item.brand, detalhesPeso, estoqueTexto].filter(Boolean).join(' | ');
    const price = item.promotion
      ? `<div class="price"><del>${money(item.normalPrice)}</del><strong>${priceLabel(item)}</strong></div>`
      : `<div class="price"><strong>${priceLabel(item)}</strong></div>`;
    const opcoesPeso = isWeightedProduct(item)
      ? `<div class="weight-options">${measureOptions(item).map(value => `<button type="button" data-action="set-weight" data-weight="${value}">${formatMeasure(value, item.unidadeVenda)}</button>`).join('')}</div>`
      : '';
    const control = semEstoque
      ? '<span class="stock-empty">Indisponivel</span>'
      : qty > 0
        ? `<div class="qty"><button type="button" data-action="minus" aria-label="Diminuir quantidade">-</button><span>${isWeightedProduct(item) ? formatMeasure(qty, item.unidadeVenda) : qty}</span><button type="button" data-action="plus" aria-label="Adicionar ao carrinho">+</button></div>`
        : `<button class="primary add-single" type="button" data-action="plus" aria-label="Adicionar ao carrinho">Adicionar</button>`;
    card.innerHTML = `
      <div class="product-media">${media}</div>
      <div class="product-body">
        <div class="product-title">
          <h3>${escapeHtml(item.name)}</h3>
          <small>${escapeHtml(details || item.sectionLabel)}</small>
          ${item.description ? `<small>${escapeHtml(String(item.description).slice(0, 90))}</small>` : ''}
          ${item.promotion ? '<span class="market-badge">Oferta</span>' : ''}
          ${isBestSeller(item) ? '<span class="market-badge">Mais vendido</span>' : ''}
          ${isLowStock(item) ? '<span class="market-badge warn">Estoque baixo</span>' : ''}
          ${item.tarjas?.length ? `<div class="product-badges">${productBadges(item)}</div>` : ''}
          ${item.pointsLabel ? `<span class="points-badge">${escapeHtml(item.pointsLabel)}</span>` : ''}
          ${isWeightedProduct(item) ? `<small>${escapeHtml(item.textoPesoAproximado || 'Produto vendido por peso. O valor final pode mudar apos a pesagem na loja.')}</small>` : ''}
        </div>
        <div class="price-row">
          ${price}
          ${control}
        </div>
        ${opcoesPeso}
      </div>
    `;
    card.addEventListener('click', event => {
      if (event.target.closest('button')) return;
      openProductSheet(item.id);
    });
    card.querySelector('[data-action="minus"]')?.addEventListener('click', () => onChangeQty(item.id, -1));
    card.querySelector('[data-action="plus"]')?.addEventListener('click', () => onChangeQty(item.id, 1));
    card.querySelectorAll('[data-action="set-weight"]').forEach(button => {
      button.addEventListener('click', () => onSetWeightedQty(item.id, Number(button.dataset.weight || 0)));
    });
    card.querySelector('[data-action="plus"]')?.toggleAttribute('disabled', qty >= item.stock);
    return card;
  }

  function renderProducts() {
    if (!els.products) return;
    els.products.innerHTML = '';
    const homeOnly = state.currentPage !== 'products' && !state.query.trim() && !state.section && !state.marketFilter && !state.marketSort;
    els.products.hidden = homeOnly;
    if (homeOnly) return;
    els.products.hidden = false;
    const products = filteredProducts(state);
    if (state.catalogLoading) {
      els.products.innerHTML = '<div class="empty">Carregando catalogo...</div>';
      return;
    }
    if (!state.products.length) {
      els.products.innerHTML = '<div class="empty">Catalogo indisponivel agora. Tente atualizar a pagina ou chamar o suporte da loja.</div>';
      return;
    }
    if (!products.length) {
      els.products.innerHTML = '<div class="empty">Nenhum produto encontrado. Tente buscar por outro nome ou escolha uma secao.</div>';
      return;
    }
    productsBySection(state).forEach(group => {
      const section = document.createElement('section');
      section.className = 'section-block';
      section.innerHTML = `
        <div class="section-head">
          <h2>${escapeHtml(group.label)}</h2>
          <span>${group.items.length} produto${group.items.length === 1 ? '' : 's'}</span>
        </div>
        <div class="product-grid"></div>
      `;
      const grid = section.querySelector('.product-grid');
      group.items.forEach(item => grid.appendChild(productCard(item)));
      els.products.appendChild(section);
    });
    if (state.catalogPage.usePaged && (state.catalogPage.hasMore || state.catalogPage.loadingMore)) {
      const footer = document.createElement('div');
      footer.className = 'load-more-row';
      footer.innerHTML = `
        <button class="ghost" type="button" data-load-more-products ${state.catalogPage.loadingMore ? 'disabled' : ''}>
          ${state.catalogPage.loadingMore ? 'Carregando...' : 'Carregar mais produtos'}
        </button>
      `;
      footer.querySelector('[data-load-more-products]')?.addEventListener('click', () => handlers.loadMoreProducts?.());
      els.products.appendChild(footer);
    }
  }

  function renderCart() {
    const items = cartItems(state);
    if (!els.cartList) return;
    if (!items.length) {
      els.cartList.innerHTML = '<div class="empty">Seu carrinho esta vazio. Adicione produtos para continuar.</div>';
      return;
    }
    els.cartList.innerHTML = '';
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'cart-item';
      const thumb = item.image
        ? `<img src="${escapeHtml(item.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
        : '<span>#</span>';
      row.innerHTML = `
        <div class="cart-thumb">${thumb}</div>
        <div class="cart-item-main">
          <div class="cart-item-top">
            <div>
              <strong>${escapeHtml(item.name)}</strong>
              <small>${isWeightedProduct(item) ? `${priceLabel(item)} | valor estimado` : `${money(item.price)} cada`}</small>
            </div>
            <span class="cart-line-total">${money(item.quantity * item.price)}</span>
          </div>
          <div class="cart-item-bottom">
            <small>${item.stock > 0 ? `${isWeightedProduct(item) ? formatMeasure(item.stock, item.unidadeVenda || item.unit) : item.stock} em estoque` : 'Estoque limitado'}</small>
            <div class="qty">
              <button type="button" data-action="minus" aria-label="Diminuir quantidade">-</button>
              <span>${isWeightedProduct(item) ? formatMeasure(item.quantity, item.unidadeVenda) : item.quantity}</span>
              <button type="button" data-action="plus" aria-label="Adicionar ao carrinho">+</button>
            </div>
          </div>
          ${itemNoteValue(state, item.id) ? `<small>${escapeHtml(itemNoteValue(state, item.id))}</small>` : ''}
          <button class="cart-remove" type="button" data-action="remove">Remover</button>
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
      box.innerHTML = `<strong>${escapeHtml(pointsText)}</strong><small>Os pontos entram apos confirmacao do pedido.</small>`;
      els.cartList.appendChild(box);
    }
  }

  function renderDeliveryAddressPanel() {
    const entrega = String(state.checkout.deliveryMode || 'retirada') === 'entrega';
    if (entrega) prefillCheckoutAddressFromCustomer(state, els);
    const endereco = entrega ? effectiveDeliveryAddressMiniApp(state, els) : {};
    const completo = enderecoEntregaCompleto(endereco);
    const editando = state.checkout.deliveryAddressEditing === true || !completo;
    if (els.deliveryAddressSummary) {
      els.deliveryAddressSummary.hidden = !entrega;
      els.deliveryAddressSummary.classList.toggle('incomplete', entrega && !completo);
    }
    if (els.deliveryAddressTitle) {
      els.deliveryAddressTitle.textContent = completo ? 'Endereco cadastrado' : 'Complete o endereco de entrega';
    }
    if (els.deliveryAddressText) {
      els.deliveryAddressText.textContent = entrega
        ? resumoEnderecoEntrega(endereco)
        : 'Retirada no local selecionada.';
    }
    if (els.deliveryAddressCep) {
      els.deliveryAddressCep.textContent = entrega && endereco.cep ? `CEP ${String(endereco.cep).replace(/\D/g, '')}` : '';
    }
    if (els.checkoutAddressGrid) {
      els.checkoutAddressGrid.hidden = !entrega || !editando;
    }
    if (els.saveDeliveryAddressLine) {
      els.saveDeliveryAddressLine.hidden = !entrega || !editando;
    }
    if (els.saveDeliveryAddressToProfile) {
      els.saveDeliveryAddressToProfile.checked = state.checkout.saveAddressToProfile === true;
    }
  }

  function renderCheckoutStep() {
    const page = paginaAtualSegura();
    const etapaCarrinho = ['cart', 'delivery', 'payment'].includes(page);
    if (els.cartStepPanel) els.cartStepPanel.hidden = !etapaCarrinho;
    const labels = {
      cart: 'Carrinho separado',
      delivery: 'Entrega ou retirada',
      payment: 'Pagamento direto no Mini App'
    };
    if (els.checkoutStepLabel) els.checkoutStepLabel.textContent = labels[page] || 'Carrinho pronto para gerar Pix';
    if (els.continueToDelivery) {
      els.continueToDelivery.disabled = cartCount(state) < 1 || state.sending || !state.loja.aceitaPedidos;
      const textos = {
        cart: 'Continuar para entrega',
        delivery: 'Continuar para pagamento',
        payment: state.sending ? 'Gerando Pix...' : 'Gerar Pix e finalizar'
      };
      els.continueToDelivery.textContent = textos[page] || 'Continuar';
      els.continueToDelivery.setAttribute('aria-label', textos[page] || 'Continuar');
    }
    if (els.checkoutHint) {
      const hints = {
        cart: 'Revise os itens antes de escolher entrega ou retirada.',
        delivery: 'Escolha receber em casa ou retirar no local. Endereco so e obrigatorio para entrega.',
        payment: 'O backend recalcula total, frete, pontos e gera o Pix seguro.'
      };
      els.checkoutHint.textContent = hints[page] || '';
    }
    renderDeliveryAddressPanel();
    renderJourney();
  }

  function renderSummary() {
    const count = cartCount(state);
    const total = cartTotal(state);
    const label = count ? `${count} ${count === 1 ? 'item' : 'itens'}` : 'Carrinho vazio';
    if (els.cartButton) els.cartButton.setAttribute('aria-label', count ? `${label} no carrinho` : 'Abrir carrinho');
    if (els.itemsCount) els.itemsCount.textContent = count ? `${label} no carrinho` : 'Carrinho vazio';
    if (els.bottomCount) els.bottomCount.textContent = count ? `${label} no carrinho` : 'Carrinho vazio';
    if (els.total) els.total.textContent = money(total);
    if (els.bottomFreeDeliveryHint) {
      const missing = Math.max(0, 60 - total);
      els.bottomFreeDeliveryHint.textContent = missing > 0
        ? `Falta ${money(missing)} para frete gratis`
        : 'Frete gratis pode ser validado no Telegram';
    }
    if (els.drawerTotal) els.drawerTotal.textContent = money(total);
    if (els.drawerSubtotal) els.drawerSubtotal.textContent = money(total);
    if (els.drawerDelivery) els.drawerDelivery.textContent = state.checkout?.preview
      ? money(state.checkout.preview.frete || 0)
      : 'A calcular';
    if (els.drawerGrandTotal) els.drawerGrandTotal.textContent = money(total);
    if (state.checkout?.preview && els.drawerGrandTotal) els.drawerGrandTotal.textContent = money(state.checkout.preview.total || total);
    if (els.checkoutPreviewBox) {
      const preview = state.checkout?.preview;
      els.checkoutPreviewBox.innerHTML = preview
        ? `Subtotal ${money(preview.subtotal)} | Frete ${money(preview.frete)} | Pontos -${money(preview.descontoPontos)} | Total ${money(preview.total)}`
        : 'O backend vai recalcular produtos, estoque, frete, pontos e Pix.';
    }
    if (els.stickyCartBar) {
      const paginaSemBarra = ['cart', 'delivery', 'payment', 'product'].includes(paginaAtualSegura());
      els.stickyCartBar.hidden = count < 1 || paginaSemBarra || designConfig(state).carrinhoFixo === false;
    }
    if (els.freeDeliveryHint) {
      els.freeDeliveryHint.textContent = 'O valor final, entrega, descontos, cupom e pontos serao recalculados com seguranca antes do Pix.';
    }
    if (els.clearCartDrawer) els.clearCartDrawer.disabled = count < 1 || state.sending;
    updateMainButton(telegram.webApp, {
      count,
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
    const semEstoque = Number(item.stock || 0) <= 0;
    const media = item.image
      ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" referrerpolicy="no-referrer">`
      : `<span>${escapeHtml(item.name.slice(0, 1).toUpperCase())}</span>`;
    const control = semEstoque
      ? '<span class="stock-empty">Indisponivel</span>'
      : qty > 0
        ? `<div class="qty"><button type="button" data-sheet-action="minus">-</button><span>${isWeightedProduct(item) ? formatMeasure(qty, item.unidadeVenda) : qty}</span><button type="button" data-sheet-action="plus">+</button></div>`
        : '<button class="primary" type="button" data-sheet-action="plus">Adicionar ao carrinho</button>';
    const opcoesPeso = isWeightedProduct(item)
      ? `<div class="weight-options">${measureOptions(item).map(value => `<button type="button" data-sheet-action="set-weight" data-weight="${value}">${formatMeasure(value, item.unidadeVenda)}</button>`).join('')}</div>`
      : '';
    els.productSheetBody.innerHTML = `
      <div class="sheet-media">${media}</div>
      <div class="sheet-copy">
        <h2>${escapeHtml(item.name)}</h2>
        <div class="price"><strong>${priceLabel(item)}</strong>${item.promotion ? `<del>${money(item.normalPrice)}</del>` : ''}</div>
        <p>${escapeHtml(item.description || [item.brand, item.unit || item.sectionLabel].filter(Boolean).join(' | ') || 'Produto disponivel para adicionar ao carrinho.')}</p>
        ${item.promotion ? '<span class="market-badge">Oferta ativa</span>' : ''}
        ${isLowStock(item) ? '<span class="market-badge warn">Estoque baixo</span>' : ''}
        ${isWeightedProduct(item) ? `<p>${escapeHtml(item.textoPesoAproximado || 'Produto vendido por peso. O valor final pode mudar apos a pesagem na loja.')}</p>` : ''}
      </div>
      ${opcoesPeso}
      <label class="item-note">Observacao deste item
        <textarea id="productItemNote" maxlength="240" placeholder="Ex: escolher bem maduro ou substituir se faltar">${escapeHtml(itemNoteValue(state, item.id))}</textarea>
      </label>
      <div class="sheet-actions">
        ${control}
        <button class="ghost" type="button" data-sheet-action="cart">Ver carrinho</button>
      </div>
    `;
    els.productSheetBody.querySelector('[data-sheet-action="minus"]')?.addEventListener('click', () => {
      onChangeQty(item.id, -1);
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
    els.productSheetBody.querySelector('[data-sheet-action="cart"]')?.addEventListener('click', () => {
      closeProductSheet();
      iniciarCheckout();
    });
    els.productSheetBody.querySelector('#productItemNote')?.addEventListener('input', event => {
      setItemNoteValue(state, item.id, event.target.value);
    });
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
    if (!open && ['cart', 'delivery', 'payment'].includes(state.currentPage)) state.currentPage = 'home';
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

  function renderViniAIAlert() {
    if (!els.viniAiAlert || !els.viniAiOutdoor) return;
    window.clearTimeout(state.viniAi.alertHideTimer);
    els.viniAiOutdoor.hidden = false;
    els.viniAiAlert.classList.remove('is-hidden');
    els.viniAiAlert.removeAttribute('aria-hidden');
    els.viniAiAlert.innerHTML = '<strong>Alerta do Vini</strong><span>Use a busca para achar produtos rapido e monte sua compra sem sair do Mini App.</span>';
    state.viniAi.alertHideTimer = window.setTimeout(() => {
      els.viniAiAlert.classList.add('is-hidden');
      els.viniAiAlert.setAttribute('aria-hidden', 'true');
    }, 4800);
  }

  function render() {
    const design = designConfig(state);
    const tema = ['verde_fresco', 'vermelho_energia', 'escuro_premium'].includes(design.tema) ? design.tema : 'verde_fresco';
    document.body.dataset.miniappTheme = tema;
    document.body.dataset.miniappMode = design.modo || 'simples';
    renderCustomerHeader();
    renderStatusLoja();
    renderTabs();
    renderHome();
    renderProducts();
    renderOrders();
    renderPixPanel();
    renderLoyaltyPanel();
    renderProfilePanel();
    renderTrackingPanel();
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
    els.search?.addEventListener('input', event => {
      state.query = event.target.value;
      state.marketFilter = '';
      state.marketSort = '';
      state.currentPage = state.query.trim() ? 'products' : 'home';
      scheduleCatalogReload();
    });
    els.clearSearch?.addEventListener('click', () => {
      state.query = '';
      state.section = '';
      state.marketFilter = '';
      state.marketSort = '';
      if (els.search) els.search.value = '';
      if (state.catalogPage.usePaged) handlers.reloadCatalog?.();
      else render();
    });
    els.cartButton?.addEventListener('click', iniciarCheckout);
    els.profileButton?.addEventListener('click', () => navigateTo('profile'));
    els.reviewCart?.addEventListener('click', iniciarCheckout);
    els.marketFilters?.addEventListener('click', event => {
      const filterButton = event.target.closest('[data-market-filter]');
      const sortButton = event.target.closest('[data-market-sort]');
      if (filterButton) {
        state.section = '';
        state.marketSort = '';
        state.marketFilter = filterButton.dataset.marketFilter || '';
        trackMiniAppEvent('category_open', { filter: state.marketFilter || 'todos' });
        render();
      }
      if (sortButton) {
        state.section = '';
        state.marketFilter = '';
        state.marketSort = sortButton.dataset.marketSort || '';
        render();
      }
    });
    els.promoBanners?.addEventListener('click', event => {
      const card = event.target.closest('[data-promo-action]');
      if (!card) return;
      const action = String(card.dataset.promoAction || '').trim();
      if (action === 'loyalty' || action === 'indicacao' || action === 'pontos') {
        navigateTo('loyalty');
        return;
      }
      if (action === 'combos') {
        state.marketFilter = 'combo';
        state.section = '';
        state.query = '';
        navigateTo('products');
        return;
      }
      state.marketFilter = 'promo';
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
    els.deliveryMode?.addEventListener('change', event => {
      state.checkout.deliveryMode = event.target.value === 'entrega' ? 'entrega' : 'retirada';
      state.checkout.deliveryAddressEditing = state.checkout.deliveryMode === 'entrega' && !enderecoEntregaCompleto(state.checkout.deliveryAddress || {});
      trackMiniAppEvent('checkout_address_change', {
        mode: state.checkout.deliveryMode,
        editing: state.checkout.deliveryAddressEditing === true
      });
      render();
    });
    els.editDeliveryAddress?.addEventListener('click', () => {
      state.checkout.deliveryAddressEditing = true;
      trackMiniAppEvent('checkout_address_change', { editing: true, mode: state.checkout.deliveryMode });
      renderDeliveryAddressPanel();
    });
    [
      els.checkoutCep,
      els.checkoutRua,
      els.checkoutNumero,
      els.checkoutComplemento,
      els.checkoutBairro,
      els.checkoutCidade,
      els.checkoutEstado,
      els.checkoutPhone
    ].filter(Boolean).forEach(input => {
      input.addEventListener('input', () => {
        state.checkout.deliveryAddressDirty = true;
        state.checkout.deliveryAddressEditing = true;
        state.checkout.deliveryAddress = effectiveDeliveryAddressMiniApp(state, els);
        renderDeliveryAddressPanel();
      });
      input.addEventListener('change', () => {
        trackMiniAppEvent('checkout_address_change', {
          mode: state.checkout.deliveryMode,
          complete: enderecoEntregaCompleto(state.checkout.deliveryAddress || {})
        });
      });
    });
    els.saveDeliveryAddressToProfile?.addEventListener('change', event => {
      state.checkout.saveAddressToProfile = event.target.checked === true;
      trackMiniAppEvent('checkout_address_change', { saveToProfile: state.checkout.saveAddressToProfile === true });
    });
    els.checkoutPoints?.addEventListener('input', event => {
      state.checkout.pointsToUse = Math.max(0, Math.floor(Number(event.target.value || 0) || 0));
    });
    els.copyInviteCode?.addEventListener('click', async () => {
      const code = String(state.cliente?.codigoIndicacao || state.cliente?.codigo_indicacao || '').trim();
      const text = code || 'Abra o Mercadinho M&J pelo Telegram e informe meu codigo de indicacao.';
      try {
        await navigator.clipboard?.writeText?.(text);
        showToast(code ? 'Codigo de indicacao copiado' : 'Convite copiado');
      } catch (_) {
        showToast(code || 'Convide pelo Telegram quando finalizar a compra');
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
    els.continueToDelivery?.addEventListener('click', async () => {
      const page = paginaAtualSegura();
      if (page === 'cart') {
        trackMiniAppEvent('checkout_continue', { from: 'cart', to: 'delivery', itemCount: cartCount(state) });
        navigateTo('delivery');
        return;
      }
      if (page === 'delivery') {
        try {
          trackMiniAppEvent('checkout_continue', { from: 'delivery', to: 'payment', mode: state.checkout.deliveryMode });
          await handlers.previewCheckout?.();
          navigateTo('payment');
        } catch (_) {
          // A mensagem amigavel e exibida pelo handler.
        }
        return;
      }
      trackMiniAppEvent('checkout_payment_start', { itemCount: cartCount(state), mode: state.checkout.deliveryMode });
      handlers.sendCart?.();
    });
    els.bottomNav?.addEventListener('click', event => {
      const btn = event.target.closest('[data-nav-page]');
      if (!btn) return;
      if (btn.dataset.navPage === 'cart' && !cartItems(state).length) {
        showToast('Seu carrinho esta vazio');
        return;
      }
      navigateTo(btn.dataset.navPage || 'home');
    });
    els.ordersList?.addEventListener('click', event => {
      const pixButton = event.target.closest('[data-order-pix]');
      const trackingButton = event.target.closest('[data-order-track]');
      if (pixButton) {
        handlers.showPix?.(pixButton.dataset.orderPix);
        return;
      }
      if (trackingButton) {
        handlers.showTracking?.(trackingButton.dataset.orderTrack);
      }
    });
    els.pixContent?.addEventListener('click', event => {
      if (event.target.closest('[data-copy-pix]')) handlers.copyPix?.();
      if (event.target.closest('[data-refresh-pix]')) handlers.refreshPix?.();
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
