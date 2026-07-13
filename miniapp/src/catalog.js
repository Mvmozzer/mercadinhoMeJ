import { slugify } from './utils.js?v=2026.07.13.359';

const WEIGHTED_CATALOG_MARKERS = ['item.tarjas'];
export const WHOLESALE_DEFAULTS = {
  ativo: true,
  barraProgressoAtiva: true,
  mostrarBarraNoVarejo: true,
  mostrarBotaoSecaoAtacado: true,
  textoBotaoSecao: 'Compre em Atacado',
  secaoVirtualId: 'atacado',
  nomeSecaoVirtual: '💙 Compre em Atacado',
  mensagemMetaAtingida: 'Parabéns, você atingiu o desconto máximo.',
  tipoAnimacao: 'fogos',
  animacaoFogosAtiva: true,
  duracaoAnimacaoMs: 1800,
  corBarra: '#2563eb',
  corBarraCompleta: '#16a34a',
  corTextoBarra: '#ffffff'
};
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

function bool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'sim', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function cleanHex(value, fallback) {
  const text = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text : fallback;
}

export function normalizeWholesaleConfig(raw = {}) {
  const cfg = raw?.atacado && typeof raw.atacado === 'object' ? raw.atacado : raw;
  const animation = String(cfg?.tipoAnimacao || cfg?.animationType || WHOLESALE_DEFAULTS.tipoAnimacao).trim().toLowerCase();
  return {
    ativo: bool(cfg?.ativo ?? cfg?.enabled, WHOLESALE_DEFAULTS.ativo),
    barraProgressoAtiva: bool(cfg?.barraProgressoAtiva ?? cfg?.progressBarEnabled, WHOLESALE_DEFAULTS.barraProgressoAtiva),
    mostrarBarraNoVarejo: bool(cfg?.mostrarBarraNoVarejo ?? cfg?.showProgressInRetail, WHOLESALE_DEFAULTS.mostrarBarraNoVarejo),
    mostrarBotaoSecaoAtacado: bool(cfg?.mostrarBotaoSecaoAtacado ?? cfg?.showWholesaleSectionButton, WHOLESALE_DEFAULTS.mostrarBotaoSecaoAtacado),
    textoBotaoSecao: String(cfg?.textoBotaoSecao || cfg?.sectionButtonText || WHOLESALE_DEFAULTS.textoBotaoSecao).trim() || WHOLESALE_DEFAULTS.textoBotaoSecao,
    secaoVirtualId: String(cfg?.secaoVirtualId || cfg?.virtualSectionId || WHOLESALE_DEFAULTS.secaoVirtualId).trim() || WHOLESALE_DEFAULTS.secaoVirtualId,
    nomeSecaoVirtual: String(cfg?.nomeSecaoVirtual || cfg?.virtualSectionName || WHOLESALE_DEFAULTS.nomeSecaoVirtual).trim() || WHOLESALE_DEFAULTS.nomeSecaoVirtual,
    mensagemMetaAtingida: String(cfg?.mensagemMetaAtingida || cfg?.goalReachedMessage || WHOLESALE_DEFAULTS.mensagemMetaAtingida).trim() || WHOLESALE_DEFAULTS.mensagemMetaAtingida,
    tipoAnimacao: ['nenhuma', 'confete', 'fogos'].includes(animation) ? animation : WHOLESALE_DEFAULTS.tipoAnimacao,
    animacaoFogosAtiva: bool(cfg?.animacaoFogosAtiva ?? cfg?.fireworksEnabled, WHOLESALE_DEFAULTS.animacaoFogosAtiva),
    duracaoAnimacaoMs: Math.max(0, Math.min(8000, Math.round(num(cfg?.duracaoAnimacaoMs ?? cfg?.animationDurationMs) || WHOLESALE_DEFAULTS.duracaoAnimacaoMs))),
    corBarra: cleanHex(cfg?.corBarra || cfg?.progressColor, WHOLESALE_DEFAULTS.corBarra),
    corBarraCompleta: cleanHex(cfg?.corBarraCompleta || cfg?.completeColor, WHOLESALE_DEFAULTS.corBarraCompleta),
    corTextoBarra: cleanHex(cfg?.corTextoBarra || cfg?.progressTextColor, WHOLESALE_DEFAULTS.corTextoBarra)
  };
}

export function productWholesale(product = {}) {
  const wholesaleActive = bool(product.atacado_ativo ?? product.atacadoAtivo ?? product.wholesaleActive ?? product.wholesaleEnabled, false);
  const wholesalePrice = Math.max(0, num(product.preco_atacado ?? product.precoAtacado ?? product.wholesalePrice));
  const wholesaleMinQuantity = Math.max(0, Math.floor(num(product.quantidade_atacado ?? product.quantidadeAtacado ?? product.wholesaleMinQuantity)));
  return {
    active: wholesaleActive && wholesalePrice > 0 && wholesaleMinQuantity >= 1,
    wholesaleActive,
    wholesalePrice,
    wholesaleMinQuantity
  };
}

export function isWholesaleProduct(product = {}) {
  return productWholesale(product).active;
}

export function productAvailability(product = {}) {
  const rawMode = String(
    product.disponibilidade ||
      product.disponibilidade_produto ||
      product.availabilityMode ||
      product.modoDisponibilidade ||
      ''
  ).trim().toLowerCase();
  const preorder = product.sob_encomenda === true || product.sobEncomenda === true || product.preorder === true;
  const hidden = ['oculto', 'hidden', 'nao_vender', 'offline'].includes(rawMode);
  const hasKnownStock = ['stock', 'estoque_pronta_entrega', 'estoque_atual', 'estoque'].some(field =>
    Object.prototype.hasOwnProperty.call(product || {}, field)
  );
  const stock = Number(product.stock ?? product.estoque_pronta_entrega ?? product.estoque_atual ?? product.estoque);
  const automaticPreorder = !hidden
    && !preorder
    && product.ativo !== false
    && hasKnownStock
    && Number.isFinite(stock)
    && stock <= 0;
  let mode = 'retirada_rapida';
  if (hidden) {
    mode = 'oculto';
  } else if (preorder || automaticPreorder || ['sob_encomenda', 'encomenda', 'por_encomenda', 'retirada_futura', 'preorder', 'backorder'].includes(rawMode)) {
    mode = 'sob_encomenda';
  }
  const daysRaw = Number(product.prazo_retirada_dias ?? product.prazoRetiradaDias ?? product.leadTimeDays ?? product.lead_time_days ?? 0);
  const days = mode === 'sob_encomenda' && Number.isFinite(daysRaw) && daysRaw > 0
    ? Math.max(1, Math.min(365, Math.ceil(daysRaw)))
    : 0;
  return {
    mode,
    label: mode === 'sob_encomenda' ? 'Somente sob encomenda' : mode === 'oculto' ? 'Oculto' : 'Retirada hoje',
    preorder: mode === 'sob_encomenda',
    hidden: mode === 'oculto',
    automatic: automaticPreorder,
    days,
    forecast: mode === 'sob_encomenda' && days > 0
      ? `Retirada em ate ${days} ${days === 1 ? 'dia util' : 'dias uteis'}`
      : mode === 'sob_encomenda'
        ? ''
        : 'Retirada hoje'
  };
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
  const availability = productAvailability(raw);
  if (availability.preorder) {
    const withoutLegacyPreorder = badges.filter(badge => !['sob encomenda', 'somente sob encomenda'].includes(String(badge.text || '').trim().toLowerCase()));
    badges.splice(0, badges.length, { text: 'Somente sob encomenda', color: '#1E1E1E', background: '#FFECBD' }, ...withoutLegacyPreorder);
  }
  const wholesale = productWholesale(raw);
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
    atacado_ativo: wholesale.active,
    atacadoAtivo: wholesale.active,
    wholesaleActive: wholesale.active,
    preco_atacado: wholesale.active ? wholesale.wholesalePrice : 0,
    precoAtacado: wholesale.active ? wholesale.wholesalePrice : 0,
    wholesalePrice: wholesale.active ? wholesale.wholesalePrice : 0,
    quantidade_atacado: wholesale.active ? wholesale.wholesaleMinQuantity : 0,
    quantidadeAtacado: wholesale.active ? wholesale.wholesaleMinQuantity : 0,
    wholesaleMinQuantity: wholesale.active ? wholesale.wholesaleMinQuantity : 0,
    stock: num(raw.estoque ?? raw.stock ?? 999),
    disponibilidade: availability.mode,
    disponibilidade_produto: availability.mode,
    availabilityMode: availability.mode,
    disponibilidade_label: raw.disponibilidade_label || raw.disponibilidadeLabel || availability.label,
    disponibilidadeLabel: raw.disponibilidadeLabel || raw.disponibilidade_label || availability.label,
    sob_encomenda: availability.preorder,
    sobEncomenda: availability.preorder,
    prazo_retirada_dias: availability.days,
    prazoRetiradaDias: availability.days,
    previsao_retirada_texto: raw.previsao_retirada_texto || raw.previsaoRetiradaTexto || availability.forecast,
    previsaoRetiradaTexto: raw.previsaoRetiradaTexto || raw.previsao_retirada_texto || availability.forecast,
    availableForPurchase: raw.availableForPurchase !== false && raw.disponivel_para_compra !== false && !availability.hidden,
    disponivel_para_compra: raw.disponivel_para_compra !== false && raw.availableForPurchase !== false && !availability.hidden,
    unit: raw.unidade || raw.unidadeVenda || raw.tamanho || raw.medida || 'un',
    points: productPoints(raw, price)
  };
}

export function normalizeCatalog(payload = {}) {
  const catalog = payload.catalogo || payload;
  const atacado = normalizeWholesaleConfig(catalog.atacado || payload.atacado || catalog.wholesale || payload.wholesale || {});
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
      virtual: section.virtual === true,
      atacado: section.atacado === true,
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

  const wholesaleProducts = products.filter(isWholesaleProduct);
  const wholesaleSectionId = atacado.secaoVirtualId || 'atacado';
  Array.from(map.values()).forEach(section => {
    if (section.atacado === true || section.id === wholesaleSectionId) {
      section.virtual = true;
      section.atacado = true;
      section.products = wholesaleProducts;
    }
  });
  if (atacado.ativo !== false && atacado.mostrarBotaoSecaoAtacado !== false && wholesaleProducts.length && !map.has(wholesaleSectionId)) {
    map.set(wholesaleSectionId, {
      id: wholesaleSectionId,
      name: atacado.nomeSecaoVirtual,
      nome: atacado.nomeSecaoVirtual,
      icon: '💙',
      emoji: '💙',
      virtual: true,
      atacado: true,
      products: wholesaleProducts
    });
  }

  return {
    sections: Array.from(map.values()).filter(section => section.products.length),
    products,
    atacado,
    wholesale: atacado
  };
}

export function filterProducts(products = [], query = '', sectionId = '') {
  const q = String(query || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  return products.filter(product =>
    (!sectionId || product.sectionId === sectionId) &&
    (!q || `${product.name} ${product.section} ${product.marca || ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(q))
  );
}
