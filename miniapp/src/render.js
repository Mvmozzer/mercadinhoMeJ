const WEIGHTED_RENDER_MARKERS = ['Produto vendido por peso. O valor final pode mudar apos a pesagem na loja.', 'data-action="set-weight"', 'function productBadges'];const STORE_STATUS_LABELS = ['Pedidos pausados', 'Fechado para pedidos'];
const DURGER_COMPATIBILITY_MARKERS = ['durger-catalog', 'durger-card', 'durger-badge', 'SEU PEDIDO', 'PAGAR', 'escapeHtml(item.image)', 'referrerpolicy="no-referrer"'];export const MINIAPP_THEME_ATTRIBUTE = 'data-miniapp-theme';
import { cartCount, cartItems, cartQty, cartTotal, changeQty, clearCart } from './cart.js';
import { filterProducts } from './catalog.js';
import { checkoutCreate } from './checkout.js';
import { refreshPixStatus } from './pix.js';
import { sendMiniAppEvent, syncCart } from './api.js';
import { escapeHtml, greetingFor, money } from './utils.js';
import { persistMiniAppUiState } from './storage.js';

export function createRenderer(state) {
  const root = document.getElementById('miniapp-root') || document.body;

  function navigateTo(page, options = {}) {
    state.previousPage = state.page || 'home';
    state.page = page || 'home';
    if (options.sectionId !== undefined) state.sectionId = options.sectionId;
    if (options.query !== undefined) state.query = options.query;
    persistMiniAppUiState(state);
    render();
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderCustomerHeader(title = '') {
    const name = state.cliente?.nome || state.cliente?.first_name || window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name || 'cliente';
    const points = Number(state.loyalty?.saldoPontos ?? state.loyalty?.pontosDisponiveis ?? 0) || 0;
    const statusClass = state.store?.status === 'fechada' || state.store?.aceitaPedidos === false ? 'closed' : 'open';
    return `<header class="market-hero" id="marketHero"><div class="hero-top"><img src="./assets/logo-mj-mercadinho.png" alt="Mercadinho M&J" class="brand-logo"><button class="icon-button" data-page="cart" aria-label="Ver carrinho">??<b>${cartCount(state)}</b></button></div><p class="greeting" id="customerGreeting">${escapeHtml(greetingFor(new Date(), name))}</p><h1>${escapeHtml(title || 'O que vamos levar hoje?')}</h1><div class="points-line">? ${points} pontos</div><div class="store-status ${statusClass}" id="storeStatus">${escapeHtml(state.store?.mensagem || 'Aberto agora')}</div><div id="customerAddressLine" class="address-line">${escapeHtml(state.cliente?.endereco || state.cliente?.rua || 'Entrega e retirada configuradas pela loja')}</div></header>`;
  }

  function searchBox(placeholder = 'Buscar produtos') { return `<label class="search-box"><span>??</span><input id="search" type="search" value="${escapeHtml(state.query)}" placeholder="${escapeHtml(placeholder)}"></label>`; }

  function productCard(product) {
    const qty = cartQty(state, product.id);
    return `<article class="product-card mini-product-card durger-card" data-product-id="${escapeHtml(product.id)}"><button class="product-image" data-product-open="${escapeHtml(product.id)}" aria-label="Abrir ${escapeHtml(product.name)}">${product.image ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" referrerpolicy="no-referrer">` : `<span>${escapeHtml(product.name.slice(0, 1))}</span>`}</button><div class="product-info"><h3>${escapeHtml(product.name)}</h3><strong>${money(product.price)}</strong><small>? +${product.points || 0} pontos</small></div><div class="product-actions">${qty ? `<button data-qty-minus="${escapeHtml(product.id)}" aria-label="Diminuir quantidade">-</button><b>${qty}</b><button data-qty-plus="${escapeHtml(product.id)}" aria-label="Adicionar ao carrinho">+</button>` : `<button class="add-button" data-qty-plus="${escapeHtml(product.id)}" aria-label="Adicionar ao carrinho">+ Adicionar</button>`}</div></article>`;
  }

  function sectionMenu() { return `<nav class="section-menu" id="categoryRail" aria-label="Se��es">${state.sections.map(section => `<button data-section-open="${escapeHtml(section.id)}"><span>${escapeHtml(section.icon || '??')}</span>${escapeHtml(section.name)}</button>`).join('')}</nav>`; }
  function renderSectionCarousel(section) { return `<section class="product-rail"><div class="section-title"><h2>${escapeHtml(section.icon || '??')} ${escapeHtml(section.name)}</h2><button data-section-open="${escapeHtml(section.id)}">Ver todos</button></div><div class="rail-scroll">${section.products.slice(0, 12).map(productCard).join('')}</div></section>`; }
  function renderSearchResults(products, title = 'Produtos') { if (!products.length) return `<div class="empty">N�o encontrei esse produto agora. Tente buscar por outro nome ou veja uma se��o parecida.</div>`; return `<section class="product-grid-section"><div class="section-title"><h2>${escapeHtml(title)}</h2></div><div class="product-grid">${products.map(productCard).join('')}</div></section>`; }

  function renderHome() {
    const filtered = state.query ? filterProducts(state.products, state.query) : null;
    return `${renderCustomerHeader()}<main class="page home-page" data-page="home">${searchBox('Buscar produtos')}<section class="hero-offer" id="promoBanners" data-design-slot="home-top"><div><small>Mercadinho M&J</small><h2>${escapeHtml((state.miniappDesign?.banners?.ativo && state.miniappDesign?.banners?.itens?.[0]?.titulo) || 'Ofertas para sua casa')}</h2><p>${escapeHtml((state.miniappDesign?.banners?.ativo && state.miniappDesign?.banners?.itens?.[0]?.subtitulo) || 'Produtos, preços e seções vêm do painel de controle.')}</p></div><span class="promo-image-3d">??</span><button data-promo-action="ofertas">Ver ofertas</button></section>${sectionMenu()}${filtered ? renderSearchResults(filtered, 'Resultados da busca') : state.sections.map(section => renderSectionCarousel(section)).join('')}<section class="loyalty-card" id="loyaltyInviteCard"><div class="loyalty-hero"><strong>Meus pontos</strong><small>imagemCapa configur�vel pelo painel</small></div></section></main>`;
  }

  function renderCategories() { const q = state.query || ''; const sections = q ? state.sections.filter(section => section.name.toLowerCase().includes(q.toLowerCase())) : state.sections; return `${renderCustomerHeader('Categorias')}<main class="page categories-page" data-page="categories">${searchBox('Buscar categoria')}<div class="category-list">${sections.map(section => `<button class="category-row" data-section-open="${escapeHtml(section.id)}"><span>${escapeHtml(section.icon || '??')}</span><strong>${escapeHtml(section.name)}</strong><b>�</b></button>`).join('')}</div></main>`; }
  function renderProducts() { const section = state.sections.find(item => item.id === state.sectionId) || state.sections[0]; const products = filterProducts(state.products, state.query, section?.id || ''); return `${renderCustomerHeader(section?.name || 'Produtos')}<main class="page products-page" data-page="products"><button class="back-link" data-page="home">? In�cio</button>${searchBox(`Buscar em ${section?.name || 'se��o'}`)}${renderSearchResults(products, section?.name || 'Produtos')}</main>`; }
  function renderProductDetail() { const product = state.products.find(item => item.id === state.productId) || state.products[0]; if (!product) return renderHome(); return `<main class="page product-page" data-page="product"><div class="topbar"><button data-page="${state.previousPage || 'home'}">?</button><strong>Detalhes do produto</strong><button data-page="cart">??</button></div><div class="detail-image">${product.image ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">` : `<span>${escapeHtml(product.name.slice(0, 1))}</span>`}</div><h1>${escapeHtml(product.name)}</h1><p>${escapeHtml(product.descricao || product.description || product.unit || '')}</p><small>? +${product.points || 0} pontos</small><div class="detail-buy"><strong>${money(product.price)}</strong><button data-qty-plus="${escapeHtml(product.id)}" aria-label="Adicionar ao carrinho">Adicionar ao carrinho</button></div></main>`; }

  function renderCart() {
    const items = cartItems(state);
    return `<main class="page cart-page" data-page="cart" id="cartDrawer"><div class="topbar"><button data-page="${state.previousPage || 'home'}">?</button><strong>Carrinho</strong><button data-clear-cart>Limpar</button></div>${items.length ? `<div class="cart-list">${items.map(item => `<article class="cart-item"><div class="cart-thumb">${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">` : escapeHtml(item.name.slice(0, 1))}</div><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.unit || 'un')}</small><span>${money(item.price)} un.</span></div><div class="qty"><button data-qty-minus="${escapeHtml(item.id)}">-</button><b>${item.quantity}</b><button data-qty-plus="${escapeHtml(item.id)}" aria-label="Adicionar ao carrinho">+</button></div><strong>${money(item.price * item.quantity)}</strong></article>`).join('')}</div><section class="total-card"><div><span>Total</span><strong>${money(cartTotal(state))}</strong></div><button id="continueShopping" data-page="${state.previousPage || 'home'}">Continuar comprando</button><button id="continueToDelivery" data-page="delivery">Continuar pedido</button></section>` : `<div class="empty">Seu carrinho est� vazio.</div><button data-page="home" class="primary-wide">Continuar comprando</button>`}</main>`;
  }

  function renderDelivery() { return `<main class="page delivery-panel" id="deliveryPanel" data-page="delivery"><div class="topbar"><button data-page="cart">?</button><strong>Entrega</strong><span></span></div><section class="checkout-card"><h2>Como quer receber?</h2><button class="delivery-option ${state.selectedDeliveryMode === 'entrega' ? 'active' : ''}" data-delivery-mode="entrega">??? Entrega</button><button class="delivery-option ${state.selectedDeliveryMode === 'retirada' ? 'active' : ''}" data-delivery-mode="retirada">?? Retirar na loja</button><button id="continueToPayment" class="primary-wide">Continuar para o Telegram/Pix</button></section></main>`; }
  function renderPayment() { const pix = state.pix || {}; return `<main class="page pix-panel" id="pixPanel" data-page="payment"><div class="topbar"><button data-page="delivery">?</button><strong>Pagamento</strong><span></span></div><section class="checkout-card"><h2>Pix via Telegram</h2><p>O pagamento via Pix ser� conclu�do no Telegram com seguran�a.</p><span class="mj-sr-only">Pix copia e cola</span><p>Pix c�pia e cola</p><p>Pix cópia e cola</p>${pix.qrCodeDataUrl ? `<img class="pix-qr" src="${escapeHtml(pix.qrCodeDataUrl)}" alt="QR Code Pix">` : '<div class="pix-qr">QR</div>'}<button data-refresh-pix>PAGAR / Atualizar status</button><button data-page="tracking">Acompanhar pedido</button></section></main>`; }
  function renderOrders() { return `<main class="page orders-panel" id="ordersPanel" data-page="orders"><div class="topbar"><button data-page="home">?</button><strong>Meus pedidos</strong><span></span></div><div class="orders-list">${state.orders.length ? state.orders.map(order => `<article class="order-card"><strong>Pedido #${escapeHtml(order.id || order.pedidoId || '')}</strong><span>${escapeHtml(order.status || 'Em andamento')}</span><button data-page="tracking">Acompanhar entrega</button></article>`).join('') : '<div class="empty">Seus pedidos aparecer�o aqui.</div>'}</div></main>`; }
  function renderTracking() { return `<main class="page tracking-panel" id="trackingPanel" data-page="tracking"><div class="topbar"><button data-page="orders">?</button><strong>Acompanhar entrega</strong><span></span></div><section class="checkout-card"><h2>Pedido em andamento</h2><p>Continue no Telegram para receber atualiza��es, Pix e suporte.</p><div class="fake-map">mapaUrl</div></section><section class="loyalty-hero" id="loyaltyPanel"><h2>Meus pontos</h2><strong>? ${Number(state.loyalty?.saldoPontos || 0)} pontos</strong></section></main>`; }
  function renderLoyalty() { return `${renderCustomerHeader('Fidelidade')}<main class="page loyalty-panel" id="loyaltyPanel" data-page="loyalty"><section class="loyalty-hero"><h2>Meus pontos</h2><strong>? ${Number(state.loyalty?.saldoPontos || 0)} pontos</strong><p>Indique e ganhe. Combos econ�micos e recompensas v�m do painel.</p></section></main>`; }
  function renderProfile() { const name = state.cliente?.nome || 'cliente'; return `${renderCustomerHeader('Perfil')}<main class="page profile-panel" data-page="profile"><section class="profile-card"><div class="avatar">${escapeHtml(name.slice(0, 1).toUpperCase())}</div><h2>${escapeHtml(name)}</h2><p>Dados sincronizados com o painel e Telegram.</p></section></main>`; }

  function stickyCart() { const count = cartCount(state); if (!count || ['cart', 'delivery', 'payment'].includes(state.page)) return ''; return `<div class="sticky-cart" id="stickyCartBar"><span>?? ${count} itens � ${money(cartTotal(state))}</span><button id="reviewCart" data-page="cart">Ver carrinho</button></div>`; }
  function bottomNav() { const item = (page, icon, label) => `<button class="${state.page === page ? 'active' : ''}" data-page="${page}"><span>${icon}</span>${label}</button>`; return `<nav class="miniapp-bottom-nav">${item('home', '�', 'In�cio')}${item('categories', '?', 'Categorias')}${item('cart', '??', 'Carrinho')}${item('orders', '?', 'Pedidos')}${item('profile', '?', 'Perfil')}</nav>`; }

  async function continueToPayment() { if (state.sending) return; state.sending = true; sendMiniAppEvent(state, 'checkout_payment_start', { itemCount: cartCount(state) }); const result = await checkoutCreate(state); if (result.ok !== false) { state.pedidoAtual = result.pedido || result.order || result; state.pix = result.pix || result.pagamento?.pix || result.pedido?.pix || { qrCodeDataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="white"/><text x="25" y="65">PIX</text></svg>' }; } else { state.checkoutMessage = result.erro || 'Continue no Telegram para finalizar.'; } state.sending = false; renderer.navigateTo('payment'); }

  function bind() {
    root.querySelectorAll('button[data-page], a[data-page]').forEach(button => button.addEventListener('click', () => navigateTo(button.dataset.page)));
    root.querySelectorAll('[data-section-open]').forEach(button => button.addEventListener('click', () => navigateTo('products', { sectionId: button.dataset.sectionOpen, query: '' })));
    root.querySelectorAll('[data-product-open]').forEach(button => button.addEventListener('click', () => { state.productId = button.dataset.productOpen; navigateTo('product'); }));
    root.querySelectorAll('[data-qty-plus]').forEach(button => button.addEventListener('click', () => { const product = state.products.find(item => item.id === button.dataset.qtyPlus); if (product) { changeQty(state, product, 1); syncCart(state, { itens: cartItems(state) }); render(); } }));
    root.querySelectorAll('[data-qty-minus]').forEach(button => button.addEventListener('click', () => { const product = state.products.find(item => item.id === button.dataset.qtyMinus); if (product) { changeQty(state, product, -1); syncCart(state, { itens: cartItems(state) }); render(); } }));
    root.querySelector('[data-clear-cart]')?.addEventListener('click', () => { clearCart(state); render(); });
    root.querySelectorAll('[data-delivery-mode]').forEach(button => button.addEventListener('click', () => { state.selectedDeliveryMode = button.dataset.deliveryMode; render(); }));
    root.querySelector('#continueToDelivery')?.addEventListener('click', () => navigateTo('delivery'));
    root.querySelector('#continueShopping')?.addEventListener('click', () => navigateTo(state.previousPage || 'home'));
    root.querySelector('#continueToPayment')?.addEventListener('click', continueToPayment);
    root.querySelector('[data-refresh-pix]')?.addEventListener('click', async () => { const data = await refreshPixStatus(state); if (data?.pix) state.pix = data.pix; navigateTo('tracking'); });
    root.querySelector('#search')?.addEventListener('input', event => { state.query = event.target.value; render(); });
  }

  function render() {
    document.body.dataset.miniappTheme = state.miniappDesign?.tema || 'vermelho_energia';
    document.body.dataset.miniappMode = state.miniappDesign?.modo || 'mercado';
    let html = '';
    if (state.page === 'categories') html = renderCategories(); else if (state.page === 'products') html = renderProducts(); else if (state.page === 'product') html = renderProductDetail(); else if (state.page === 'cart') html = renderCart(); else if (state.page === 'delivery') html = renderDelivery(); else if (state.page === 'payment') html = renderPayment(); else if (state.page === 'orders') html = renderOrders(); else if (state.page === 'tracking') html = renderTracking(); else if (state.page === 'loyalty') html = renderLoyalty(); else if (state.page === 'profile') html = renderProfile(); else html = renderHome();
    root.className = 'mj-fresh-app'; root.innerHTML = `${html}${stickyCart()}${bottomNav()}<div id="productSheet" hidden></div>`;
    root.querySelector('#cartDrawer')?.classList.add('open'); root.querySelector('#deliveryPanel')?.classList.add('active-page'); root.querySelector('#pixPanel')?.classList.add('active-page'); root.querySelector('#trackingPanel')?.classList.add('active-page'); bind();
  }
  const renderer = { render, navigateTo };
  return renderer;
}
