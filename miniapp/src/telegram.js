export function getTelegramWebApp() {
  return window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
}

export function getTelegram() {
  return window.Telegram || null;
}

export function isTelegram(webApp = getTelegramWebApp()) {
  return Boolean(webApp);
}

export function getUser(webApp = getTelegramWebApp()) {
  return webApp?.initDataUnsafe?.user || null;
}

export function getInitData(webApp = getTelegramWebApp()) {
  return String(webApp?.initData || '').trim();
}

export function ready(webApp = getTelegramWebApp()) {
  webApp?.ready?.();
}

export function expand(webApp = getTelegramWebApp()) {
  webApp?.expand?.();
}

export function isActive(webApp = getTelegramWebApp()) {
  if (!webApp) return true;
  if (typeof webApp.isActive === 'boolean') return webApp.isActive;
  return true;
}

export function showAlert(webApp, message) {
  if (webApp?.showAlert) webApp.showAlert(message);
  else window.alert(message);
}

export function showConfirm(webApp, message, callback) {
  if (webApp?.showConfirm) webApp.showConfirm(message, callback);
  else callback?.(window.confirm(message));
}

export function haptic(webApp, type = 'impact') {
  if (type === 'notification') webApp?.HapticFeedback?.notificationOccurred?.('success');
  else webApp?.HapticFeedback?.impactOccurred?.('light');
}

export function applyTelegramTheme(webApp = getTelegramWebApp()) {
  if (!webApp) return;
  const theme = webApp.themeParams || {};
  if (theme.bg_color) {
    document.documentElement.style.setProperty('--bg', theme.bg_color);
    document.documentElement.style.setProperty('--mj-bg', theme.bg_color);
  }
  if (theme.text_color) {
    document.documentElement.style.setProperty('--text', theme.text_color);
    document.documentElement.style.setProperty('--mj-text', theme.text_color);
  }
  if (theme.secondary_bg_color) {
    document.documentElement.style.setProperty('--surface', theme.secondary_bg_color);
    document.documentElement.style.setProperty('--mj-card', theme.secondary_bg_color);
  }
  if (theme.hint_color) {
    document.documentElement.style.setProperty('--muted', theme.hint_color);
    document.documentElement.style.setProperty('--mj-muted', theme.hint_color);
  }
  if (theme.button_color) {
    document.documentElement.style.setProperty('--green', theme.button_color);
    document.documentElement.style.setProperty('--mj-primary', theme.button_color);
  }
  document.documentElement.dataset.telegramScheme = webApp.colorScheme || 'light';
}

export function setupTelegram(onMainButtonClick) {
  const webApp = getTelegramWebApp();
  if (!webApp) return { webApp: null };
  expand(webApp);
  applyTelegramTheme(webApp);
  if (webApp.MainButton) {
    setupMainButton(webApp, { text: 'Carrinho', onClick: onMainButtonClick });
  }
  window.addEventListener('load', () => ready(webApp));
  return { webApp };
}

export function setupMainButton(webApp, { text = 'Carrinho', onClick } = {}) {
  if (!webApp?.MainButton) return;
  webApp.MainButton.setText(text);
  if (onClick) webApp.MainButton.onClick?.(onClick);
}

export function setMainButtonLoading(webApp, loading = false) {
  if (!webApp?.MainButton) return;
  if (loading) webApp.MainButton.showProgress?.();
  else webApp.MainButton.hideProgress?.();
}

export function updateMainButton(webApp, { count, sending, currentPage, enabled }) {
  if (!webApp?.MainButton) return;
  const podeEnviarCarrinho = currentPage === 'cart' && count > 0 && enabled;
  if (podeEnviarCarrinho) {
    const text = sending ? 'Enviando...' : 'FINALIZAR PELO TELEGRAM';
    webApp.MainButton.setText(text);
    webApp.MainButton.show?.();
  } else {
    webApp.MainButton.hide?.();
  }
}

export function hasSendData(webApp) {
  return typeof webApp?.sendData === 'function';
}

export function fallbackSendData(webApp, payload) {
  const text = JSON.stringify(payload);
  if (hasSendData(webApp)) {
    webApp.sendData(text);
    return true;
  }
  window.__lastMiniAppPayload = payload;
  console.log('Mini App fallback payload', payload);
  return false;
}
