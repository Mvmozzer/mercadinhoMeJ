export function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}
export function normalizeText(value = '') { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
export function money(value = 0) { return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
export function slugify(value = '') { return normalizeText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'secao'; }
export function greetingFor(date = new Date(), name = 'cliente') { const h = date.getHours(); const p = h >= 5 && h < 12 ? 'Bom dia' : h >= 12 && h < 18 ? 'Boa tarde' : 'Boa noite'; return `${p}, ${name || 'cliente'}`; }
export function isTemporaryPublicApiBase(value = '') { return /localhost\.run|lhr\.life|ngrok|trycloudflare|serveo/i.test(String(value || '')); }

export function formatMeasure(value, unit = 'un') {
  const amount = Number(value || 0) || 1;
  const label = String(unit || 'un').toLowerCase();
  if (['kg', 'g', 'litro', 'l', 'ml', 'un', 'unidade'].includes(label)) return `${amount} ${label}`;
  return `${amount} ${unit}`;
}