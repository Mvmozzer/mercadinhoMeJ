import { slugify } from './utils.js?v=2026.06.18.151';

const WEIGHTED_CATALOG_MARKERS = ['item.tarjas'];
export const STATIC_CATALOG_FALLBACKS = ['./catalogo.json', '../catalogo.json'];
const DEFAULT_SECTION_ICON_IMAGES = {
  ofertas: 'assets/secoes/ofertas.png',
  hortifruti: 'assets/secoes/hortifruti.png',
  padaria: 'assets/secoes/padaria.png',
  frios_laticinios: 'assets/secoes/frios_laticinios.png',
  frios_e_laticinios: 'assets/secoes/frios_laticinios.png',
  ovos: 'assets/secoes/ovos.png',
  acougue: 'assets/secoes/acougue.png',
  peixaria: 'assets/secoes/peixaria.png',
  congelados: 'assets/secoes/congelados.png',
  mercearia: 'assets/secoes/mercearia.png',
  cafe_matinais: 'assets/secoes/cafe_matinais.png',
  cafe_e_matinais: 'assets/secoes/cafe_matinais.png',
  biscoitos: 'assets/secoes/biscoitos.png',
  doces: 'assets/secoes/doces.png',
  snacks: 'assets/secoes/snacks.png',
  bebidas: 'assets/secoes/bebidas.png',
  gelo: 'assets/secoes/gelo.png',
  bebe: 'assets/secoes/bebe.png',
  pet_shop: 'assets/secoes/pet_shop.png',
  higiene: 'assets/secoes/higiene.png',
  limpeza: 'assets/secoes/limpeza.png',
  descartaveis: 'assets/secoes/descartaveis.png',
  utilidades: 'assets/secoes/utilidades.png',
  festas: 'assets/secoes/festas.png',
  papelaria: 'assets/secoes/papelaria.png',
  eletrica: 'assets/secoes/eletrica.png',
  pilhas_baterias: 'assets/secoes/pilhas_baterias.png',
  pilhas_e_baterias: 'assets/secoes/pilhas_baterias.png',
  ferramentas: 'assets/secoes/ferramentas.png',
  jardinagem: 'assets/secoes/jardinagem.png',
  farmacinha: 'assets/secoes/farmacinha.png',
  presentes_sazonais: 'assets/secoes/presentes_sazonais.png',
  presentes_e_sazonais: 'assets/secoes/presentes_sazonais.png',
  tabacaria: 'assets/secoes/tabacaria.png',
  delivery_retirada: 'assets/secoes/delivery_retirada.png',
  delivery_e_retirada: 'assets/secoes/delivery_retirada.png',
  servicos_frente_caixa: 'assets/secoes/servicos_frente_caixa.png',
  servicos_e_frente_de_caixa: 'assets/secoes/servicos_frente_caixa.png'
};

export function isWeightedProduct(item = {}) {
  return item.vendidoPorPeso === true || item.pesavel === true || item.tipoVenda === 'granel' || item.modo_venda === 'granel' || item.saleMode === 'weighted';
}

function normalizeBadge(item = {}) {
  if (typeof item === 'string') {
    const text = item.trim();
    return text ? { text } : null;
  }
  if (!item || typeof item !== 'object') return null;
  const text = String(item.text || item.texto || item.nome || item.label || '').trim();
  if (!text) return null;
  return {
    text,
    color: String(item.color || item.cor || '').trim(),
    background: String(item.background || item.fundo || item.bg || '').trim()
  };
}

export function productBadges(item = {}) {
  const source = Array.isArray(item.tarjas)
    ? item.tarjas
    : Array.isArray(item.badges)
      ? item.badges
      : Array.isArray(item.labels)
        ? item.labels
        : [];
  return source.map(normalizeBadge).filter(Boolean);
}

function num(value) {
  return Number(String(value ?? 0).replace(',', '.')) || 0;
}

export function productImage(product = {}) {
  return [
    product.imagem,
    product.imagem_url,
    product.imagemUrl,
    product.image,
    product.image_url,
    product.imageUrl,
    product.foto,
    product.foto_url,
    product.fotoUrl,
    product.urlImagem,
    product.photoUrl,
    product.mediaUrl
  ].map(value => String(value || '').trim()).find(Boolean) || '';
}

export function productPrice(product = {}) {
  const promo = num(product.preco_promocional || product.precoPromocional);
  const base = num(product.preco || product.price || product.preco_normal || product.precoVendaAtual);
  return product.promocao === true && promo > 0 ? promo : base;
}

function productPoints(product = {}, fallbackPrice = 0) {
  const candidates = [
    product.points_preview,
    product.pointsPreview,
    product.product_point_offer_points,
    product.productPointOfferPoints,
    product.product_point_offer?.points,
    product.productPointOffer?.points,
    product.pontos,
    product.points,
    product.pontos_ganhos
  ];
  const configured = candidates.find(value => value !== undefined && value !== null && String(value).trim() !== '');
  if (configured !== undefined) return num(configured);
  return Math.max(1, Math.floor(fallbackPrice));
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

function looksLikeSectionImage(value = '') {
  const text = String(value || '').trim();
  return /^(https?:\/\/|data:image\/|blob:|\/|\.\/|\.\.\/|assets\/|uploads\/)/i.test(text)
    || /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(text);
}

function sectionIconKey(value = '') {
  return slugify(value).replace(/-/g, '_');
}

function defaultSectionImage(section = {}, name = '') {
  const candidates = [section.id, section.secao, section.sectionId, section.nome, section.name, name]
    .map(sectionIconKey)
    .filter(Boolean);
  const key = candidates.find(item => DEFAULT_SECTION_ICON_IMAGES[item]);
  return key ? DEFAULT_SECTION_ICON_IMAGES[key] : '';
}

function sectionImage(section = {}) {
  const configured = [
    section.iconImage,
    section.icon_image,
    section.imagem,
    section.image,
    section.imageUrl,
    section.image_url,
    section.icone,
    section.icon
  ].find(looksLikeSectionImage);
  return String(configured || defaultSectionImage(section, section.nome || section.name || '') || '').trim();
}

function sectionEmoji(section = {}, name = '') {
  const icon = String(section.icon || '').trim();
  if (icon && !looksLikeSectionImage(icon)) return icon;
  return section.emoji || emojiForSection(name);
}

export function normalizeProduct(raw = {}, sectionName = '', index = 0) {
  const name = raw.nome || raw.name || raw.titulo || 'Produto';
  const rawSectionId = raw.secao_id || raw.sectionId || raw.section_id || raw.secao || '';
  const fallbackSectionId = rawSectionId || (sectionName && !raw.section ? sectionName : '');
  const section = raw.secao_nome || raw.sectionName || raw.section_name || raw.section || sectionName || fallbackSectionId || 'Produtos';
  const sectionId = String(fallbackSectionId || slugify(section));
  const id = String(raw.id || raw.produto_id || `${slugify(section)}_${index}`);
  const price = productPrice(raw);
  const description = String(raw.descricao || raw.description || raw.detalhes || '').trim();
  const brand = String(raw.marca || raw.brand || raw.fabricante || '').trim();
  const badges = productBadges(raw);
  return {
    ...raw,
    id,
    produto_id: String(raw.produto_id || id),
    name,
    nome: name,
    section,
    secao: raw.secao || sectionId,
    sectionId,
    image: productImage(raw),
    descricao: description,
    description,
    marca: brand,
    brand,
    tarjas: badges,
    badges,
    price,
    preco: price,
    normalPrice: num(raw.preco_normal || raw.normalPrice || price),
    stock: num(raw.estoque ?? raw.stock ?? 999),
    unit: raw.unidade || raw.unidadeVenda || raw.tamanho || raw.medida || 'un',
    points: productPoints(raw, price)
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
    const iconImage = sectionImage(section);
    map.set(id, {
      id,
      name,
      nome: name,
      icon: sectionEmoji(section, name),
      emoji: section.emoji || '',
      iconImage,
      image: iconImage,
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
        emoji: '',
        iconImage: '',
        image: '',
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
