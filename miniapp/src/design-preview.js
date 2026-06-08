const products = [
  { id: 'arroz', section: 'mercearia', name: 'Arroz 5kg', price: 24.9, oldPrice: 29.9, stock: 18, image: '🫘', tag: 'Oferta', points: '+12 pontos' },
  { id: 'feijao', section: 'mercearia', name: 'Feijão carioca 1kg', price: 8.99, stock: 26, image: '☕', tag: 'Mais vendido' },
  { id: 'banana', section: 'hortifruti', name: 'Banana prata', price: 6.49, stock: 12, image: '🍌', unit: 'kg' },
  { id: 'alface', section: 'hortifruti', name: 'Alface crespa', price: 4.5, stock: 9, image: '🥬', points: '+4 pontos' },
  { id: 'guarana', section: 'bebidas', name: 'Guaraná 2L', price: 9.9, oldPrice: 11.5, stock: 14, image: '🥤', tag: 'Oferta' },
  { id: 'cafe', section: 'mercearia', name: 'Café 500g', price: 17.9, stock: 7, image: '⭐', points: '+8 pontos' }
];

const state = {
  screen: 'home',
  section: '',
  search: '',
  points: true,
  delivery: 'retirada',
  cart: new Map([
    ['arroz', 1],
    ['feijao', 2]
  ])
};

const root = document.getElementById('mockApp');
let splashShown = false;

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function cartItems() {
  return products
    .map(product => ({ ...product, qty: state.cart.get(product.id) || 0 }))
    .filter(product => product.qty > 0);
}

function subtotal() {
  return cartItems().reduce((total, item) => total + item.price * item.qty, 0);
}

function freight() {
  return state.delivery === 'entrega' ? 6 : 0;
}

function discount() {
  return state.points ? 4.2 : 0;
}

function total() {
  return Math.max(0, subtotal() + freight() - discount());
}

function cartCount() {
  return cartItems().reduce((sum, item) => sum + item.qty, 0);
}

function isWorldCupSeason() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('copa') === '1') return true;
  if (params.get('copa') === '0') return false;
  const month = new Date().getMonth();
  return month === 5 || month === 6;
}

function renderSplash() {
  if (splashShown || !isWorldCupSeason()) return '';
  splashShown = true;
  return `
    <section class="splash" id="splashScreen" aria-label="Carregando Mercadinho M&J">
      <div class="splash-flags" aria-hidden="true">
        <span class="mini-flag"><i></i></span><span class="cup-icon">🏆</span><span class="cup-icon">🥇</span><span class="mini-flag"><i></i></span><span class="cup-icon">🏆</span>
      </div>
      <img src="./assets/copa-splash.png" alt="Mercadinho M&J em clima de Copa do Mundo">
      <div class="splash-copy">
        <strong>Mercadinho M&J</strong>
        <span>Carregando ofertas em ritmo de Copa</span>
      </div>
      <div class="splash-loader" aria-hidden="true"><i></i><i></i><i></i></div>
    </section>
  `;
}

function productFilter(product) {
  const q = state.search.trim().toLowerCase();
  const sectionOk = !state.section || product.section === state.section || (state.section === 'ofertas' && product.oldPrice);
  const queryOk = !q || product.name.toLowerCase().includes(q);
  return sectionOk && queryOk;
}

function add(productId, delta = 1) {
  const current = state.cart.get(productId) || 0;
  const next = Math.max(0, current + delta);
  if (next) state.cart.set(productId, next);
  else state.cart.delete(productId);
  render();
}

function top() {
  return `
    <header class="store-top">
      <div class="brand-line">
        <div class="brand-mark">M&J</div>
        <div>
          <h1>Mercadinho M&J</h1>
          <p><span></span> Aberto agora • Entrega e retirada</p>
        </div>
      </div>
      <div class="search-box">
        <span aria-hidden="true">🔍</span>
        <input id="searchInput" type="search" value="${state.search}" placeholder="O que você precisa hoje?">
      </div>
      <nav class="shortcut-row" aria-label="Atalhos">
        ${shortcut('ofertas', '🏷️', 'Ofertas')}
        ${shortcut('mercearia', '🛒', 'Mercearia')}
        ${shortcut('hortifruti', '🥬', 'Hortifruti')}
        ${shortcut('bebidas', '🥤', 'Bebidas')}
      </nav>
    </header>
  `;
}

function shortcut(id, icon, label) {
  return `<button class="${state.section === id ? 'active' : ''}" data-section="${id}" type="button"><b>${icon}</b>${label}</button>`;
}

function productCard(product) {
  const qty = state.cart.get(product.id) || 0;
  const unit = product.unit ? `/${product.unit}` : '';
  return `
    <article class="product-card">
      <div class="photo">${product.image}</div>
      <div class="product-info">
        <div class="product-title">
          <h3>${product.name}</h3>
          ${product.tag ? `<span>${product.tag}</span>` : ''}
        </div>
        <div class="price-line">
          <strong>${money(product.price)}${unit}</strong>
          ${product.oldPrice ? `<del>${money(product.oldPrice)}</del>` : ''}
        </div>
        <p>${product.stock} em estoque ${product.points ? `• ${product.points}` : ''}</p>
      </div>
      <div class="product-actions">
        ${qty ? `
          <button data-add="${product.id}" data-delta="-1" type="button">-</button>
          <b>${qty}</b>
          <button data-add="${product.id}" data-delta="1" type="button">+</button>
        ` : `<button class="add-button" data-add="${product.id}" data-delta="1" type="button">Adicionar</button>`}
      </div>
    </article>
  `;
}

function homeScreen() {
  const filtered = products.filter(productFilter);
  return `
    ${top()}
    <main class="screen home-screen">
      <section class="hero-offer">
        <div>
          <strong>Combo do dia</strong>
          <p>Arroz, feijão e café com preço conferido para hoje.</p>
        </div>
        <button data-screen="checkout" type="button">Ver carrinho</button>
      </section>
      <section class="product-list">
        <div class="section-heading">
          <h2>Produtos</h2>
          <span>${filtered.length} itens</span>
        </div>
        ${filtered.map(productCard).join('')}
      </section>
    </main>
    ${bottomBar()}
  `;
}

function checkoutScreen() {
  return `
    <header class="simple-top">
      <button data-screen="home" type="button">←</button>
      <h1>Checkout</h1>
      <span></span>
    </header>
    <main class="screen checkout-screen">
      <section class="step-block">
        <h2>1. Como quer receber?</h2>
        <div class="segmented">
          <button class="${state.delivery === 'retirada' ? 'active' : ''}" data-delivery="retirada" type="button">Retirada</button>
          <button class="${state.delivery === 'entrega' ? 'active' : ''}" data-delivery="entrega" type="button">Entrega</button>
        </div>
      </section>
      <section class="step-block">
        <h2>2. Endereço</h2>
        <div class="form-grid">
          <label>CEP<input value="21860-190"></label>
          <label>Rua<input value="Rua das Flores"></label>
          <label>Número<input value="123"></label>
          <label>Bairro<input value="Centro"></label>
        </div>
      </section>
      <section class="step-block">
        <h2>3. Pagamento</h2>
        <button class="payment-selected" type="button">Pix selecionado</button>
      </section>
      <section class="step-block">
        <h2>4. Pontos</h2>
        <label class="points-line">
          <span>Você tem 120 pontos</span>
          <input id="pointsToggle" type="checkbox" ${state.points ? 'checked' : ''}>
        </label>
        <p>Usar pontos neste pedido</p>
      </section>
      <section class="summary-card">
        <h2>Resumo</h2>
        ${summaryRows()}
      </section>
      <button class="primary-action" data-screen="pix" type="button">Gerar Pix</button>
    </main>
  `;
}

function summaryRows() {
  return `
    <div><span>Subtotal</span><strong>${money(subtotal())}</strong></div>
    <div><span>Frete</span><strong>${money(freight())}</strong></div>
    <div><span>Desconto</span><strong>-${money(discount())}</strong></div>
    <div class="total-row"><span>Total</span><strong>${money(total())}</strong></div>
  `;
}

function pixScreen() {
  return `
    <header class="simple-top">
      <button data-screen="checkout" type="button">←</button>
      <h1>Pedido #1234</h1>
      <span></span>
    </header>
    <main class="screen pix-screen">
      <section class="pix-status">
        <span>Aguardando pagamento</span>
        <strong>Valor: ${money(total())}</strong>
        <p>Recebedor: Mercadinho M&J</p>
      </section>
      <div class="qr-mock" aria-label="QR Code Pix">
        ${Array.from({ length: 49 }, (_, index) => `<i class="${index % 3 === 0 || index % 7 === 0 ? 'dark' : ''}"></i>`).join('')}
      </div>
      <section class="copy-card">
        <h2>Pix cópia e cola</h2>
        <code>00020126580014BR.GOV.BCB.PIX0136mj-preview-pedido-1234-valor-${total().toFixed(2)}</code>
      </section>
      <div class="action-grid">
        <button class="primary-action" type="button">Copiar Pix</button>
        <button type="button">Já paguei</button>
      </div>
    </main>
  `;
}

function trackingScreen() {
  return `
    <header class="simple-top">
      <button data-screen="pix" type="button">←</button>
      <h1>Pedido #1234</h1>
      <span></span>
    </header>
    <main class="screen tracking-screen">
      <section class="tracking-card">
        <span>Saiu para entrega</span>
        <h2>Motoboy: João</h2>
        <p>Última atualização: agora</p>
      </section>
      <section class="map-preview" aria-label="Mapa de acompanhamento">
        <div class="road"></div>
        <div class="pin customer">📍</div>
        <div class="pin courier">📍</div>
      </section>
      <section class="timeline-card">
        <div><b>📍</b><span>Motoboy a caminho</span></div>
        <div><b>📍</b><span>Seu endereço</span></div>
      </section>
      <button class="primary-action" type="button">Abrir no Maps</button>
    </main>
  `;
}

function bottomBar() {
  return `
    <footer class="cart-footer">
      <strong>🛒 ${cartCount()} itens</strong>
      <span>${money(subtotal())}</span>
      <button data-screen="checkout" type="button">Ver carrinho</button>
    </footer>
  `;
}

function renderScreen() {
  if (state.screen === 'checkout') return checkoutScreen();
  if (state.screen === 'pix') return pixScreen();
  if (state.screen === 'tracking') return trackingScreen();
  return homeScreen();
}

function bind() {
  root.querySelectorAll('[data-screen]').forEach(button => {
    button.addEventListener('click', () => {
      state.screen = button.dataset.screen || 'home';
      render();
    });
  });
  root.querySelectorAll('[data-add]').forEach(button => {
    button.addEventListener('click', () => add(button.dataset.add, Number(button.dataset.delta || 1)));
  });
  root.querySelectorAll('[data-section]').forEach(button => {
    button.addEventListener('click', () => {
      state.section = state.section === button.dataset.section ? '' : button.dataset.section;
      render();
    });
  });
  root.querySelectorAll('[data-delivery]').forEach(button => {
    button.addEventListener('click', () => {
      state.delivery = button.dataset.delivery || 'retirada';
      render();
    });
  });
  root.querySelector('#pointsToggle')?.addEventListener('change', event => {
    state.points = event.target.checked;
    render();
  });
  root.querySelector('#searchInput')?.addEventListener('input', event => {
    state.search = event.target.value;
    render();
  });
}

function render() {
  root.innerHTML = `${renderSplash()}<div class="mock-shell">${renderScreen()}</div>`;
  bind();
  const splash = document.getElementById('splashScreen');
  if (splash) {
    window.setTimeout(() => splash.classList.add('leaving'), 1350);
    window.setTimeout(() => splash.remove(), 1850);
  }
}

render();