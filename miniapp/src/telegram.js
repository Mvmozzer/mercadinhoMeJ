const TELEGRAM_WEBAPP_MARKER = 'Telegram.WebApp';
export function getTelegram() { const telegramRoot = window.Telegram; return telegramRoot && telegramRoot.WebApp ? telegramRoot.WebApp : null; }
export function initTelegram() { const app = getTelegram(); try { app?.ready?.(); app?.expand?.(); } catch {} return app; }
export function telegramUserName() { const user = getTelegram()?.initDataUnsafe?.user || {}; return user.first_name || user.username || ''; }
function canUseKeyboardSendData(app) {
  const init = app?.initDataUnsafe || {};
  return !init.query_id && !init.chat_type && !init.chat_instance && !init.start_param && !init.chat && !init.receiver;
}
export function fallbackSendData(payload) {
  const app = getTelegram();
  if (!app || typeof app.sendData !== 'function' || !canUseKeyboardSendData(app)) return false;
  try { app.sendData(JSON.stringify(payload)); return true; } catch { return false; }
}
export function updateMainButton(webApp = getTelegram(), options = {}) { const button = webApp?.MainButton; if (!button) return; if (options.currentPage !== 'cart' || !options.enabled || !options.count) { button.hide?.(); return; } button.setText?.(options.sending ? 'Enviando ao Telegram...' : ('Finalizar no Telegram ' + (options.totalText || '')).trim()); button.show?.(); }

export function rawTelegramInitData(webApp = getTelegram()) { return webApp?.initData || ''; }
