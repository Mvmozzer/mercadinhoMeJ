import { slugify } from './utils.js?v=2026.06.22.301';

const WEIGHTED_CATALOG_MARKERS = ['item.tarjas'];
export const STATIC_CATALOG_FALLBACKS = ['./catalogo.json', '../catalogo.json'];

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
  if (/todos|all/.test(text)) return '🧺';
  if (/oferta|promocao|promo/.test(text)) return '🏷️';
  if (/hort|feira|fruta|verd/.test(text)) return '🥬';
  if (/padaria|pao/.test(text)) return '🥖';
  if (/frio|laticinio|queijo|leite/.test(text)) return '🧀';
  if (/ovo/.test(text)) return '🥚';
  if (/carne|acougue/.test(text)) return '🥩';
  if (/peixe|peixaria/.test(text)) return '🐟';
  if (/congel|sorvete/.test(text)) return '🥶';
  if (/mercearia|arroz|feijao|cesta/.test(text)) return '🛒';
  if (/cafe|matinal/.test(text)) return '☕';
  if (/biscoito|bolacha/.test(text)) return '🍪';
  if (/doce|chocolate/.test(text)) return '🍫';
  if (/snack|salgadinho/.test(text)) return '🍿';
  if (/bebida|suco|refri|agua/.test(text)) return '🥤';
  if (/gelo/.test(text)) return '🧊';
  if (/bebe|infantil/.test(text)) return '🍼';
  if (/pet/.test(text)) return '🐾';
  if (/higiene/.test(text)) return '🧴';
  if (/limp/.test(text)) return '🧼';
  if (/descart/.test(text)) return '📦';
  if (/utilidade|cozinha/.test(text)) return '🍳';
  if (/festa/.test(text)) return '🎉';
  if (/papelaria/.test(text)) return '📚';
  if (/eletric/.test(text)) return '💡';
  if (/pilha|bateria/.test(text)) return '🔋';
  if (/ferramenta/.test(text)) return '🧰';
  if (/jardin/.test(text)) return '🪴';
  if (/farmac|remedio/.test(text)) return '💊';
  if (/presente|sazonal/.test(text)) return '🎁';
  if (/tabac/.test(text)) return '🚬';
  if (/delivery|retirada|entrega/.test(text)) return '🚚';
  if (/servico|caixa|pagamento/.test(text)) return '💳';
  return '🛒';
}

function looksLikeSectionImage(value = '') {
  const text = String(value || '').trim();
  return /^(https?:\/\/|data:image\/|blob:|\/|\.\/|\.\.\/|assets\/|uploads\/)/i.test(text)
    || /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(text);
}

export function looksLikeSectionEmoji(value = '') {
  const text = String(value || '').trim();
  return /[\p{Extended_Pictographic}\u2600-\u27BF]/u.test(text);
}

function sectionEmoji(section = {}, name = '') {
  const configured = [section.emoji, section.icon, section.icone]
    .map(value => String(value || '').trim())
    .find(value => value && !looksLikeSectionImage(value) && looksLikeSectionEmoji(value));
  return configured || emojiForSection(name || section.nome || section.name || section.id);
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
    map.set(id, {
      id,
      name,
      nome: name,
      icon: sectionEmoji(section, name),
      emoji: section.emoji || '',
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
