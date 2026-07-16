const TELEGRAM_WEBAPP_MARKER = 'Telegram.WebApp';
export const TELEGRAM_SEND_DATA_MAX_BYTES = 4096;
export function getTelegram() { const telegramRoot = window.Telegram; return telegramRoot && telegramRoot.WebApp ? telegramRoot.WebApp : null; }
export function initTelegram() { const app = getTelegram(); try { app?.ready?.(); app?.expand?.(); } catch {} return app; }
export function telegramUserName() { const user = getTelegram()?.initDataUnsafe?.user || {}; return user.first_name || user.username || ''; }
export function telegramUserId() {
  const id = getTelegram()?.initDataUnsafe?.user?.id;
  return id === undefined || id === null ? '' : String(id);
}
function canUseKeyboardSendData(app) {
  const init = app?.initDataUnsafe || {};
  return !init.query_id && !init.chat_type && !init.chat_instance && !init.start_param && !init.chat && !init.receiver;
}
export function telegramPayloadBytes(payload) {
  let serialized;
  try { serialized = JSON.stringify(payload); } catch { return 0; }
  let bytes = 0;
  for (const char of serialized) {
    const codePoint = char.codePointAt(0);
    if (codePoint <= 0x7f) bytes += 1;
    else if (codePoint <= 0x7ff) bytes += 2;
    else if (codePoint <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}
export function fallbackSendData(payload) {
  const app = getTelegram();
  if (!app || typeof app.sendData !== 'function' || !canUseKeyboardSendData(app)) return false;
  let serialized;
  try { serialized = JSON.stringify(payload); } catch { return false; }
  const bytes = telegramPayloadBytes(payload);
  if (!bytes || bytes > TELEGRAM_SEND_DATA_MAX_BYTES) return false;
  try { app.sendData(serialized); return true; } catch { return false; }
}
export function updateMainButton(webApp = getTelegram(), options = {}) {
  const button = webApp?.MainButton;
  if (!button) return;
  if (options.currentPage !== 'cart' || !options.enabled || !options.count) {
    button.hide?.();
    return;
  }
  const miniapp = options.paymentMode === 'miniapp';
  const dinheiro = miniapp && options.paymentMethod === 'dinheiro';
  const label = miniapp ? (dinheiro ? 'Confirmar pedido' : 'Pagar com Pix') : 'Finalizar no Telegram';
  const loading = miniapp ? (dinheiro ? 'Confirmando pedido...' : 'Gerando Pix no Mini App...') : 'Enviando ao Telegram...';
  button.setText?.(options.sending ? loading : (`${label} ${options.totalText || ''}`).trim());
  button.show?.();
}

export function rawTelegramInitData(webApp = getTelegram()) { return webApp?.initData || ''; }
