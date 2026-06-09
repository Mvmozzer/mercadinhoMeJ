import { slugify } from './utils.js';

const WEIGHTED_CATALOG_MARKERS = ['item.tarjas'];
export const STATIC_CATALOG_FALLBACKS = ['./catalogo.json', '../catalogo.json'];

export function isWeightedProduct(item = {}) {
  return item.vendidoPorPeso === true || item.pesavel === true || item.tipoVenda === 'granel' || item.modo_venda === 'granel' || item.saleMode === 'weighted';
}

export function productBadges(item = {}) {
  return Array.isArray(item.tarjas)
    ? item.tarjas
    : Array.isArray(item.badges)
      ? item.badges
      : [];
}

function num(value) {
  return Number(String(value ?? 0).replace(',', '.')) || 0;
}

export function productImage(product = {}) {
  return product.imagem || product.image || product.foto || product.urlImagem || '';
}

export function productPrice(product = {}) {
  const promo = num(product.preco_promocional || product.precoPromocional);
  const base = num(product.preco || product.price || product.preco_normal || product.precoVendaAtual);
  return product.promocao === true && promo > 0 ? promo : base;
}

export function emojiForSection(name = '') {
  const text = slugify(name);
  if (/hort|feira|fruta|verd/.test(text)) return 'H';
  if (/bebida|suco|refri|agua/.test(text)) return 'B';
  if (/limp/.test(text)) return 'L';
  if (/padaria|pao/.test(text)) return 'P';
  if (/carne|acougue/.test(text)) return 'C';
  if (/pet/.test(text)) return 'Pet';
  if (/higiene/.test(text)) return 'Hig';
  if (/congel/.test(text)) return 'F';
  return 'M&J';
}

export function normalizeProduct(raw = {}, sectionName = '', index = 0) {
  const name = raw.nome || raw.name || raw.titulo || 'Produto';
  const section = raw.secao || raw.section || raw.secao_nome || sectionName || 'Produtos';
  const id = String(raw.id || raw.produto_id || `${slugify(section)}_${index}`);
  const price = productPrice(raw);
  return {
    ...raw,
    id,
    produto_id: String(raw.produto_id || id),
    name,
    nome: name,
    section,
    secao: section,
    sectionId: slugify(section),
    image: productImage(raw),
    price,
    preco: price,
    normalPrice: num(raw.preco_normal || raw.normalPrice || price),
    stock: num(raw.estoque ?? raw.stock ?? 999),
    unit: raw.unidade || raw.unidadeVenda || raw.tamanho || raw.medida || 'un',
    points: num(raw.pontos || raw.points || raw.pontos_ganhos || Math.max(1, Math.floor(price)))
  };
}

export function normalizeCatalog(payload = {}) {
  const catalog = payload.catalogo || payload;
  const rawSections = Array.isArray(catalog.secoes)
    ? catalog.secoes
    : Array.isArray(payload.secoes)
      ? payload.secoes
      : [];

  const fromObject = catalog.produtos && !Array.isArray(catalog.produtos)
    ? Object.entries(catalog.produtos).flatMap(([section, list]) =>
        (Array.isArray(list) ? list : []).map((p, i) => normalizeProduct(p, section, i)))
    : [];

  const rawProducts = Array.isArray(catalog.produtos)
    ? catalog.produtos
    : Array.isArray(payload.produtos)
      ? payload.produtos
      : Array.isArray(payload.products)
        ? payload.products
        : [];

  const products = (rawProducts.length
    ? rawProducts.map((p, i) => normalizeProduct(p, p.secao || p.section || '', i))
    : fromObject).filter(product => product && product.name && product.stock >= 0 && product.price > 0 && product.ativo !== false);

  const map = new Map();

  rawSections.forEach((section, index) => {
    const name = section.nome || section.name || section.titulo || `Seção ${index + 1}`;
    const id = String(section.id || slugify(name));
    map.set(id, {
      id,
      name,
      nome: name,
      icon: section.icon || section.emoji || emojiForSection(name),
      products: []
    });
  });

  products.forEach(product => {
    if (!map.has(product.sectionId)) {
      map.set(product.sectionId, {
        id: product.sectionId,
        name: product.section,
        nome: product.section,
        icon: emojiForSection(product.section),
        products: []
      });
    }
    map.get(product.sectionId).products.push(product);
  });

  return {
    sections: Array.from(map.values()).filter(section => section.products.length),
    products
  };
}

export function filterProducts(products = [], query = '', sectionId = '') {
  const q = String(query || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  return products.filter(product =>
    (!sectionId || product.sectionId === sectionId) &&
    (!q || `${product.name} ${product.section} ${product.marca || ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(q))
  );
}
