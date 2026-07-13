(function bootstrapMJMiniAppBridge(window) {
  const TOKEN_KEY = 'mj_miniapp_bridge_token';
  const SINCE_KEY = 'mj_miniapp_bridge_since';

  function normalizeUrlProtocol(value) {
    return String(value || '').trim()
      .replace(/^(https?):\/?(?=[a-z0-9.-])([a-z0-9.-]+(?::\d+)?(?:[/?#].*)?)$/i, '$1://$2');
  }

  function cleanBase(value) {
    return normalizeUrlProtocol(value).replace(/\/+$/, '');
  }

  function apiBaseFromLocation() {
    const url = new URL(window.location.href);
    const fromQuery = url.searchParams.get('apiBase');
    if (fromQuery) return cleanBase(fromQuery);
    if (window.__API_BASE__) return cleanBase(window.__API_BASE__);
    if (/\.github\.io$/i.test(window.location.hostname) || window.location.protocol === 'file:') return '';
    return window.location.origin;
  }

  function getTelegram() {
    return window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  }

  function headers(state) {
    const webApp = getTelegram();
    const initData = state.initData || webApp?.initData || '';
    return {
      'Content-Type': 'application/json',
      ...(initData ? { 'X-Telegram-Init-Data': initData } : {}),
      ...(state.sessionToken ? { Authorization: `Bearer ${state.sessionToken}` } : {})
    };
  }

  async function request(state, path, options) {
    const base = cleanBase(state.apiBase || apiBaseFromLocation());
    if (!base) throw new Error('API publica da loja nao configurada.');
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), Number(options?.timeoutMs || 15000));
    try {
      const response = await fetch(`${base}${path}`, {
        ...options,
        credentials: 'include',
        signal: options?.signal || controller.signal,
        headers: {
          ...headers(state),
          ...(options?.headers || {})
        }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.erro || data.error || `Falha HTTP ${response.status}`);
      return data;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function createBridge() {
    const state = {
      apiBase: apiBaseFromLocation(),
      initData: '',
      reopenState: '',
      sessionToken: window.localStorage.getItem(TOKEN_KEY) || '',
      since: Number(window.localStorage.getItem(SINCE_KEY) || 0) || 0,
      pollingTimer: null,
      eventSource: null,
      onSnapshot: null,
      onEvents: null,
      onError: null
    };

    async function init(options) {
      Object.assign(state, options || {});
      state.apiBase = cleanBase(state.apiBase || apiBaseFromLocation());
      const webApp = getTelegram();
      state.initData = state.initData || webApp?.initData || '';
      const data = await request(state, '/api/telegram-miniapp/session', {
        method: 'POST',
        body: JSON.stringify({
          initData: state.initData,
          reopenState: !state.initData ? (options?.reopenState || state.reopenState || '') : undefined,
          devUser: options?.devUser || (!state.initData && !options?.reopenState && options?.devChatId
            ? { id: options.devChatId, first_name: 'Cliente', last_name: 'Dev' }
            : undefined)
        })
      });
      state.sessionToken = data.sessionToken || data.token || state.sessionToken;
      if (state.sessionToken) window.localStorage.setItem(TOKEN_KEY, state.sessionToken);
      if (data.snapshot) state.onSnapshot?.(data.snapshot);
      return data;
    }

    async function sendAction(action, payload) {
      const data = await request(state, '/api/telegram-miniapp/action', {
        method: 'POST',
        body: JSON.stringify({ action, payload: payload || {} })
      });
      if (data.snapshot) state.onSnapshot?.(data.snapshot);
      return data;
    }

    async function loadEvents(options) {
      const data = await request(state, `/api/telegram-miniapp/events?since=${encodeURIComponent(state.since)}${options?.snapshot ? '&snapshot=1' : ''}`, {
        method: 'GET'
      });
      if (Array.isArray(data.eventos) && data.eventos.length) {
        state.since = Math.max(...data.eventos.map(evento => Number(evento.seq || 0)));
        window.localStorage.setItem(SINCE_KEY, String(state.since));
        state.onEvents?.(data.eventos);
      }
      if (data.snapshot) state.onSnapshot?.(data.snapshot);
      return data;
    }

    function startPolling(intervalMs) {
      stopPolling();
      const delay = Math.max(1000, Number(intervalMs || 7000) || 7000);
      state.pollingTimer = window.setInterval(() => {
        loadEvents().catch(error => state.onError?.(error));
      }, delay);
      return state.pollingTimer;
    }

    function stopPolling() {
      if (state.pollingTimer) window.clearInterval(state.pollingTimer);
      state.pollingTimer = null;
    }

    function startStream() {
      stopStream();
      if (!state.sessionToken || !state.apiBase || typeof window.EventSource !== 'function') return false;
      const url = `${cleanBase(state.apiBase)}/api/telegram-miniapp/stream?sessionToken=${encodeURIComponent(state.sessionToken)}&since=${encodeURIComponent(state.since)}`;
      const source = new window.EventSource(url);
      state.eventSource = source;
      source.addEventListener('snapshot', event => {
        try { state.onSnapshot?.(JSON.parse(event.data)); } catch (_) {}
      });
      source.addEventListener('eventos', event => {
        try {
          const data = JSON.parse(event.data);
          if (Array.isArray(data.eventos) && data.eventos.length) {
            state.since = Number(data.since || state.since);
            window.localStorage.setItem(SINCE_KEY, String(state.since));
            state.onEvents?.(data.eventos);
          }
        } catch (_) {}
      });
      source.onerror = error => state.onError?.(error);
      return true;
    }

    function stopStream() {
      if (state.eventSource) state.eventSource.close();
      state.eventSource = null;
    }

    function installActionInterceptor(root) {
      const target = root || document;
      target.addEventListener('click', event => {
        const button = event.target.closest('[data-miniapp-action]');
        if (!button) return;
        event.preventDefault();
        let payload = {};
        try {
          payload = button.dataset.miniappPayload ? JSON.parse(button.dataset.miniappPayload) : {};
        } catch (_) {
          payload = {};
        }
        sendAction(button.dataset.miniappAction, payload).catch(error => state.onError?.(error));
      });
    }

    return {
      init,
      sendAction,
      loadEvents,
      startPolling,
      stopPolling,
      startStream,
      stopStream,
      installActionInterceptor,
      state
    };
  }

  window.MJMiniAppBridge = window.MJMiniAppBridge || createBridge();
})(window);
