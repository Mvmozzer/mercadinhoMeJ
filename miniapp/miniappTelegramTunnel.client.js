(function bootstrapMJTelegramTunnel(window) {
  function telegramWebApp() {
    return window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  }

  function queryMode() {
    try {
      const params = new URL(window.location.href).searchParams;
      return String(params.get('telegramTunnel') || params.get('tunnel') || '').trim().toLowerCase();
    } catch (_) {
      return '';
    }
  }

  function configuredMode() {
    const fromWindow = String(window.__TELEGRAM_TUNNEL_MODE__ || '').trim().toLowerCase();
    const fromQuery = queryMode();
    if (fromQuery === 'strict' || fromWindow === 'strict') return 'strict';
    return 'hybrid';
  }

  function canUseSendData() {
    const webApp = telegramWebApp();
    return Boolean(webApp && typeof webApp.sendData === 'function');
  }

  function payloadFor(action, payload, options) {
    const clientEventId = String(
      options?.clientEventId ||
      payload?.clientEventId ||
      payload?.client_event_id ||
      `mjt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    );
    return {
      v: 1,
      source: 'miniapp',
      action: String(action || payload?.action || '').trim(),
      clientEventId,
      payload: {
        ...(payload || {}),
        clientEventId,
        client_event_id: clientEventId
      }
    };
  }

  function createTunnel() {
    const state = {
      mode: configuredMode(),
      lastError: ''
    };

    async function sendCommand(action, payload, options) {
      state.lastError = '';
      const envelope = payloadFor(action, payload, options);
      if (!envelope.action) throw new Error('Acao da Mini App ausente.');

      if (state.mode === 'strict') {
        if (!canUseSendData()) throw new Error('sendData nao esta disponivel nesta abertura do Telegram.');
        telegramWebApp().sendData(JSON.stringify(envelope));
        return { ok: true, sentBy: 'sendData', willCloseMiniApp: true, clientEventId: envelope.clientEventId };
      }

      const bridge = window.MJMiniAppBridge;
      if (!bridge || typeof bridge.sendAction !== 'function') {
        if (options?.fallbackSendData && canUseSendData()) {
          telegramWebApp().sendData(JSON.stringify(envelope));
          return { ok: true, sentBy: 'sendData_fallback', willCloseMiniApp: true, clientEventId: envelope.clientEventId };
        }
        throw new Error('Ponte hibrida da Mini App indisponivel.');
      }
      return bridge.sendAction(envelope.action, envelope.payload);
    }

    function installActionInterceptor(root) {
      const target = root || document;
      target.addEventListener('click', event => {
        const button = event.target.closest('[data-miniapp-tunnel-action]');
        if (!button) return;
        event.preventDefault();
        let payload = {};
        try {
          payload = button.dataset.miniappTunnelPayload ? JSON.parse(button.dataset.miniappTunnelPayload) : {};
        } catch (_) {
          payload = {};
        }
        sendCommand(button.dataset.miniappTunnelAction, payload, { fallbackSendData: true })
          .catch(error => { state.lastError = error.message || String(error); });
      });
    }

    return {
      get mode() { return state.mode; },
      set mode(value) { state.mode = String(value || 'hybrid').trim().toLowerCase() === 'strict' ? 'strict' : 'hybrid'; },
      get lastError() { return state.lastError; },
      get willCloseMiniApp() { return state.mode === 'strict'; },
      canUseSendData,
      sendCommand,
      installActionInterceptor,
      state
    };
  }

  window.MJTelegramTunnel = window.MJTelegramTunnel || createTunnel();
})(window);
