import {
  escapeHtml,
  formatMeasure,
  imageUrl,
  money,
  normalizeText,
  normalizeUnit,
  safeCssColor,
  titleFromId,
  toNumber
} from './utils.js';

export { formatMeasure };

export function priceInfo(product = {}) {
  const normal = toNumber(product.preco_normal || product.preco || product.precoVendaAtual, 0);
  const promo = toNumber(product.preco_promocional || product.precoPromocional, 0);
  const active = (product.promocao === true || product.promocao_ativa === true || product.promocaoAtiva === true) && promo > 0;
  const base = active ? promo : normal;
  const coverage = Math.max(0, toNumber(product.points_cost_coverage_percent || product.pointsCostCoveragePercent, 0));
  const finalPrice = Number((base + (base * coverage / 100)).toFixed(2));
  return { price: finalPrice, base, normal, promo, coverage, active };
}

export function stockOf(product = {}) {
  return toNumber(product.estoque_pronta_entrega ?? product.estoque ?? product.estoque_atual, 0);
}

export function isGroup(product = {}) {
  return product.produto_principal === true || product.tipo === 'principal' || product.tipo === 'grupo';
}

export function normalizeSaleMode(product = {}) {
  const raw = String(product.modoVenda || product.modo_venda || product.saleMode || '').toLowerCase();
  return ['granel', 'weighted', 'peso', 'por_peso'].includes(raw) ? 'weighted' : 'unit';
}

export function isWeightedProduct(product = {}) {
  return normalizeSaleMode(product) === 'weighted';
}

export function sanitizeBadges(product = {}) {
  const list = Array.isArray(product.tarjas)
    ? product.tarjas
    : Array.isArray(product.labels)
      ? product.labels
      : [];
  return list.map(item => ({
    texto: String(item?.texto || item?.label || item || '').trim().slice(0, 32),
    cor: safeCssColor(item?.cor || item?.color, '#ffffff'),
    fundo: safeCssColor(item?.fundo || item?.backgroundColor, '#198754')
  })).filter(item => item.texto).slice(0, 6);
}

export function productBadges(product = {}) {
  return sanitizeBadges(product).map(badge =>
    `<span class="product-badge" style="color:${escapeHtml(badge.cor)};background:${escapeHtml(badge.fundo)}">${escapeHtml(badge.texto)}</span>`
  ).join('');
}

export function productPointOffer(product = {}, id = '') {
  const offer = product.product_point_offer || product.productPointOffer || {};
  const points = Math.max(0, Math.floor(toNumber(offer.points ?? offer.pontos ?? product.product_point_offer_points ?? product.points_fixed_amount, 0)));
  const minimumOrderValue = Math.max(0, toNumber(
    offer.minimumOrderValue ?? offer.minimum_order_value ?? product.product_point_offer_minimum_order_value ?? product.points_minimum_order_value,
    0
  ));
  const activeRaw = offer.isActive ?? offer.is_active ?? product.product_point_offer_active ?? product.points_enabled;
  const isActive = activeRaw === true || activeRaw === 'true' || activeRaw === '1' || activeRaw === 1;
  return { productId: id || product.produto_id || product.id || '', points, minimumOrderValue, isActive };
}

export function pointsAmount(product = {}, price = 0, quantity = 1) {
  const offer = productPointOffer(product);
  if (offer.isActive && offer.points > 0) return offer.points;
  if (product.points_enabled !== true) return 0;
  const qty = Math.max(1, toNumber(quantity, 1));
  if (String(product.points_type || 'fixed') === 'per_currency') {
    return Math.max(0, Math.floor(toNumber(price, 0) * qty * toNumber(product.points_per_currency, 0)));
  }
  return Math.max(0, Math.floor(toNumber(product.points_fixed_amount, 0) * qty));
}

export function pointsLabel(product = {}, price = 0) {
  const offer = productPointOffer(product);
  if (offer.isActive && offer.points > 0) {
    return `+${offer.points} pontos em compras acima de ${money(offer.minimumOrderValue)}`;
  }
  if (product.points_enabled !== true || product.points_display_enabled !== true) return '';
  const points = pointsAmount(product, price, 1);
  if (points <= 0) return '';
  const custom = String(product.points_label_text || '').trim();
  if (custom) return custom.replace(/\{\{\s*pontos\s*\}\}/gi, String(points));
  const expiration = product.points_expiration_type === 'days' && toNumber(product.points_expiration_days, 0) > 0
    ? ` validos por ${toNumber(product.points_expiration_days, 0)} dias`
    : ' sem validade';
  return `Compre e ganhe ${points} pontos${expiration}`;
}

export function measureStep(product = {}) {
  if (!isWeightedProduct(product)) return 1;
  return toNumber(product.incrementoPeso || product.weightStep || product.incremento_peso, 0.05) || 0.05;
}

export function minMeasure(product = {}) {
  return toNumber(product.pesoMinimo || product.minWeight || product.peso_minimo, measureStep(product)) || measureStep(product);
}

export function maxMeasure(product = {}) {
  return toNumber(product.pesoMaximo || product.maxWeight || product.peso_maximo || product.stock, 999) || 999;
}

export function clampProductQuantity(product = {}, value) {
  const raw = toNumber(value, 0);
  if (!isWeightedProduct(product)) return Math.max(0, Math.min(toNumber(product.stock, 0), Math.trunc(raw)));
  const step = measureStep(product);
  const min = minMeasure(product);
  const max = Math.min(maxMeasure(product), toNumber(product.stock, maxMeasure(product)));
  if (raw <= 0) return 0;
  const stepped = Math.round(raw / step) * step;
  return Number(Math.max(min, Math.min(max, stepped)).toFixed(3));
}

export function measureOptions(product = {}) {
  if (!isWeightedProduct(product)) return [];
  const step = measureStep(product);
  const min = minMeasure(product);
  const max = Math.min(maxMeasure(product), toNumber(product.stock, maxMeasure(product)));
  return [min, step * 5, step * 10, 1]
    .map(value => clampProductQuantity(product, value))
    .filter(value => value > 0 && value <= max)
    .filter((value, index, list) => list.indexOf(value) === index)
    .slice(0, 4);
}

export function priceLabel(product = {}) {
  const baseUnit = product.unidadeBasePreco || product.priceBaseUnit || product.unit || 'un';
  return isWeightedProduct(product) ? `${money(product.price)}/${baseUnit}` : money(product.price);
}

export function normalizeProductFromPublic(product = {}, sectionInfo = {}, fallback = {}) {
  const section = product.secao || product.section || fallback.section || '';
  const id = product.produto_id || product.id || `${section}_${fallback.index || 0}`;
  const name = product.nome || product.nome_completo || product.nomeCompleto || 'Produto';
  const price = toNumber(product.preco || product.price, 0);
  const saleMode = normalizeSaleMode(product);
  return {
    id,
    section,
    sectionLabel: product.secao_nome || sectionInfo.nome || sectionInfo.name || titleFromId(section),
    sectionOrder: toNumber(product.secao_ordem ?? sectionInfo.ordem ?? sectionInfo.order ?? fallback.sectionOrder, 0),
    index: toNumber(product.index ?? fallback.index, 0),
    name,
    sku: product.sku || '',
    barcode: product.codigoBarras || product.codigo_barras || '',
    brand: product.marca || '',
    unit: product.tamanho || product.peso || product.unidadeMedida || product.unidade || '',
    description: product.descricao || '',
    price,
    normalPrice: toNumber(product.preco_normal || product.preco || price, price),
    promoPrice: toNumber(product.preco_promocional, 0),
    promotion: product.promocao === true,
    bestSeller: product.mais_vendido === true || product.maisVendido === true || product.bestSeller === true,
    salesRank: toNumber(product.ranking_vendas || product.salesRank || product.vendas, 0),
    saleMode,
    modoVenda: saleMode === 'weighted' ? 'granel' : 'unidade',
    unidadeVenda: normalizeUnit(product.unidadeVenda || product.saleUnit || product.unidade_venda || product.unidadeMedida || product.unidade || 'un'),
    unidadeBasePreco: normalizeUnit(product.unidadeBasePreco || product.priceBaseUnit || product.unidade_base_preco || product.unidadeVenda || product.unidadeMedida || 'un'),
    precoBaseCentavos: toNumber(product.precoBaseCentavos || product.priceBaseCents || product.preco_base_centavos, Math.round(price * 100)),
    pesoMinimo: toNumber(product.pesoMinimo || product.minWeight || product.peso_minimo, 0),
    pesoMaximo: toNumber(product.pesoMaximo || product.maxWeight || product.peso_maximo, 0),
    incrementoPeso: toNumber(product.incrementoPeso || product.weightStep || product.incremento_peso, 0),
    exigePesoFinal: product.exigePesoFinal === true || product.requiresFinalWeight === true || product.exige_peso_final === true,
    textoPesoAproximado: product.textoPesoAproximado || 'Produto vendido por peso. O valor final pode mudar apos a pesagem na loja.',
    tarjas: sanitizeBadges(product),
    pointsLabel: product.points_label_text || pointsLabel(product, price),
    points: toNumber(product.points_preview, pointsAmount(product, price, 1)),
    pointOffer: productPointOffer(product, id),
    stock: toNumber(product.estoque || product.estoque_pronta_entrega || product.stock, 0),
    image: imageUrl(product),
    keywords: normalizeText(`${name} ${product.secao_nome || sectionInfo.nome || ''} ${product.grupo || ''} ${product.marca || ''} ${product.tamanho || ''} ${product.codigoBarras || ''} ${product.sku || ''}`)
  };
}

export function normalizeProducts(raw = {}) {
  return Object.entries(raw || {}).flatMap(([section, list]) =>
    (Array.isArray(list) ? list : []).map((product, index) => ({ section, index, product }))
  ).filter(({ product }) => {
    if (!product || product.ativo === false || isGroup(product)) return false;
    return priceInfo(product).price > 0;
  }).map(({ section, index, product }) => {
    const prices = priceInfo(product);
    return normalizeProductFromPublic({
      ...product,
      produto_id: `${section}_${index}`,
      secao: section,
      index,
      preco: prices.price,
      preco_normal: prices.normal,
      preco_promocional: prices.promo,
      promocao: prices.active,
      estoque: stockOf(product),
      points_label_text: pointsLabel(product, prices.price),
      points_preview: pointsAmount(product, prices.price, 1)
    }, { id: section, nome: product.secao_nome || titleFromId(section) }, { section, index });
  }).sort(productSort);
}

export function normalizeCatalogPayload(payload = {}) {
  if (payload?.catalogo?.produtos) {
    const mostrarSemEstoque = payload.catalogo.mostrar_produtos_sem_estoque !== false;
    const sections = Array.isArray(payload.catalogo.secoes) ? payload.catalogo.secoes : [];
    return payload.catalogo.produtos.map((product, index) => {
      const section = product.secao || product.section || '';
      const sectionInfo = sections.find(item => item.id === section) || {};
      return normalizeProductFromPublic(product, sectionInfo, { section, index });
    }).filter(item => item.id && item.price > 0 && (mostrarSemEstoque || item.stock > 0))
      .sort(productSort);
  }
  return normalizeProducts(payload || {});
}

export function productSort(a, b) {
  return toNumber(a.sectionOrder, 0) - toNumber(b.sectionOrder, 0) ||
    String(a.sectionLabel || '').localeCompare(String(b.sectionLabel || ''), 'pt-BR') ||
    String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
}

export function catalogSectionsFromPayload(payload = {}, products = []) {
  const counts = new Map();
  products.forEach(item => {
    if (!item.section) return;
    counts.set(item.section, toNumber(counts.get(item.section), 0) + 1);
  });
  if (Array.isArray(payload?.catalogo?.secoes)) {
    return payload.catalogo.secoes.map((section, index) => ({
      id: section.id || '',
      name: section.nome || section.name || titleFromId(section.id),
      icon: section.emoji || section.icon || '',
      order: toNumber(section.ordem ?? section.order, index),
      products: toNumber(section.produtos ?? section.productCount ?? counts.get(section.id), 0)
    })).filter(section => section.id && section.products > 0)
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'pt-BR'));
  }
  return sectionItemsFromProducts(products);
}

export function sectionItemsFromProducts(products = []) {
  const map = new Map();
  products.forEach(item => {
    if (!map.has(item.section)) {
      map.set(item.section, {
        id: item.section,
        name: item.sectionLabel || titleFromId(item.section),
        icon: '',
        order: toNumber(item.sectionOrder, 0),
        products: 0
      });
    }
    map.get(item.section).products += 1;
  });
  return Array.from(map.values())
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'pt-BR'));
}

export function cacheProducts(state, products = []) {
  products.forEach(product => {
    if (product?.id) state.productCache.set(product.id, product);
  });
}

export function mergeProducts(current = [], incoming = []) {
  const byId = new Map(current.map(product => [product.id, product]));
  incoming.forEach(product => {
    if (product?.id) byId.set(product.id, product);
  });
  return Array.from(byId.values()).sort(productSort);
}

export function sectionItems(state) {
  if (state.catalogPage.usePaged && state.catalogSections.length) return state.catalogSections;
  return sectionItemsFromProducts(state.products);
}

export function availableProducts(state) {
  return state.products.filter(product => toNumber(product.stock, 0) > 0);
}

export function productSearchText(item = {}) {
  return normalizeText(`${item.name || ''} ${item.sectionLabel || ''} ${item.brand || ''} ${item.unit || ''} ${item.description || ''} ${item.sku || ''} ${item.barcode || ''}`);
}

export function isBestSeller(item = {}) {
  return item.bestSeller === true || item.maisVendido === true || item.mais_vendido === true || toNumber(item.salesRank || item.ranking_vendas || item.vendas, 0) > 0;
}

export function isLowStock(item = {}) {
  const stock = toNumber(item.stock, 0);
  return stock > 0 && stock <= 3;
}

export function matchesMarketFilter(state, item = {}) {
  if (state.marketFilter === 'offers') return item.promotion === true;
  if (state.marketFilter === 'best_sellers') {
    const hasRealBestSellers = state.products.some(isBestSeller);
    return hasRealBestSellers ? isBestSeller(item) : true;
  }
  return true;
}

export function sortForMarket(state, items = []) {
  const copy = [...items];
  if (state.marketSort === 'price_asc') {
    return copy.sort((a, b) => toNumber(a.price, 0) - toNumber(b.price, 0) || a.name.localeCompare(b.name, 'pt-BR'));
  }
  if (state.marketFilter === 'best_sellers') {
    return copy.sort((a, b) => toNumber(b.salesRank || b.ranking_vendas || b.vendas, 0) - toNumber(a.salesRank || a.ranking_vendas || a.vendas, 0) || a.name.localeCompare(b.name, 'pt-BR'));
  }
  return copy;
}

export function filteredProducts(state) {
  if (state.catalogPage.usePaged) return state.products;
  const query = normalizeText(state.query.trim());
  return sortForMarket(state, state.products.filter(item => {
    const sectionOk = !state.section || item.section === state.section;
    const queryOk = !query || item.keywords.includes(query) || productSearchText(item).includes(query);
    return sectionOk && queryOk && matchesMarketFilter(state, item);
  }));
}

export function productsBySection(state) {
  const sections = new Map();
  filteredProducts(state).forEach(item => {
    const key = item.section || item.sectionLabel || 'outros';
    if (!sections.has(key)) {
      sections.set(key, {
        id: key,
        label: item.sectionLabel || titleFromId(item.section),
        order: toNumber(item.sectionOrder, 0),
        items: []
      });
    }
    sections.get(key).items.push(item);
  });
  return Array.from(sections.values())
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'pt-BR'));
}

export function buildSuggestedCombos(items = []) {
  const bySection = new Map();
  items.forEach(item => {
    const key = item.section || 'outros';
    if (!bySection.has(key)) bySection.set(key, []);
    bySection.get(key).push(item);
  });
  const combos = [];
  Array.from(bySection.values()).forEach(group => {
    if (group.length < 2) return;
    combos.push(...group.slice(0, 2));
  });
  return combos.length ? combos : items.slice(0, 6);
}

export function homeCollections(state, cartItems = []) {
  const active = availableProducts(state);
  const offers = active.filter(item => item.promotion).slice(0, 10);
  const lowStock = active.filter(isLowStock).slice(0, 10);
  const bestReal = active.filter(isBestSeller).slice(0, 10);
  const bestSellers = bestReal.length ? bestReal : active.slice(0, 10);
  const buyAgainIds = new Set(cartItems.map(item => item.id));
  const buyAgain = active.filter(item => buyAgainIds.has(item.id)).concat(active.filter(item => !buyAgainIds.has(item.id))).slice(0, 8);
  const combos = buildSuggestedCombos(active).slice(0, 6);
  return {
    active,
    offers: offers.length ? offers : active.slice(0, 8),
    lowStock: lowStock.length ? lowStock : active.slice(0, 6),
    bestSellers,
    buyAgain,
    combos
  };
}

export function iconForSection(label = '') {
  const text = normalizeText(label);
  if (/oferta|promo/.test(text)) return '#';
  if (/bebida|refrigerante|suco|agua/.test(text)) return 'B';
  if (/hort|fruta/.test(text)) return 'F';
  if (/verdura|legume/.test(text)) return 'V';
  if (/limpeza/.test(text)) return 'L';
  if (/higiene|perfumaria/.test(text)) return 'H';
  if (/padaria|pao|bolo/.test(text)) return 'P';
  if (/congelado|frio/.test(text)) return 'C';
  if (/carne|frango|acougue/.test(text)) return 'A';
  if (/mercearia|arroz|feijao|cafe/.test(text)) return 'M';
  return '+';
}
