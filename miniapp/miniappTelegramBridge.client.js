(function bootstrapMJMiniAppBridge(window) {
  const TOKEN_KEY = 'mj_miniapp_bridge_token';
  const SINCE_KEY = 'mj_miniapp_bridge_since';

  function cleanTelegramId(value) {
    return String(value ?? '').trim();
  }

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

  function telegramIdFromInitData(initData) {
    try {
      const rawUser = new URLSearchParams(String(initData || '')).get('user');
      return cleanTelegramId(rawUser ? JSON.parse(rawUser)?.id : '');
    } catch (_) {
      return '';
    }
  }

  function currentTelegramId(initData = '') {
    return cleanTelegramId(
      getTelegram()?.initDataUnsafe?.user?.id ||
      telegramIdFromInitData(initData || getTelegram()?.initData || '')
    );
  }

  function scopedKey(baseKey, telegramId) {
    const id = cleanTelegramId(telegramId);
    return id ? `${baseKey}:${id}` : '';
  }

  function readStorage(key) {
    if (!key) return '';
    try { return window.localStorage.getItem(key) || ''; } catch (_) { return ''; }
  }

  function writeStorage(key, value) {
    if (!key) return;
    try { window.localStorage.setItem(key, String(value)); } catch (_) {}
  }

  function removeStorage(key) {
    if (!key) return;
    try { window.localStorage.removeItem(key); } catch (_) {}
  }

  function clearLegacySharedStorage() {
    removeStorage(TOKEN_KEY);
    removeStorage(SINCE_KEY);
  }

  function readSessionToken(telegramId) {
    return readStorage(scopedKey(TOKEN_KEY, telegramId));
  }

  function readSince(telegramId) {
    return Number(readStorage(scopedKey(SINCE_KEY, telegramId)) || 0) || 0;
  }

  function storeSessionToken(telegramId, token) {
    const key = scopedKey(TOKEN_KEY, telegramId);
    if (!key) return;
    if (token) writeStorage(key, token);
    else removeStorage(key);
  }

  function storeSince(telegramId, since) {
    const key = scopedKey(SINCE_KEY, telegramId);
    if (key) writeStorage(key, Number(since || 0) || 0);
  }

  function snapshotTelegramIds(snapshot = {}) {
    const ids = new Set();
    const add = value => {
      const id = cleanTelegramId(value);
      if (id) ids.add(id);
    };
    add(snapshot.telegramId || snapshot.telegram_id || snapshot.chatId);
    add(snapshot.cliente?.telegramId || snapshot.cliente?.telegram_id || snapshot.cliente?.chatId);
    const orders = Array.isArray(snapshot.pedidos)
      ? snapshot.pedidos
      : Array.isArray(snapshot.pedidosAtivos)
        ? snapshot.pedidosAtivos
        : [];
    orders.forEach(order => add(order?.telegramId || order?.telegram_id || order?.chatId || order?.cliente?.chatId));
    return ids;
  }

  function hasPersonalSnapshot(snapshot = {}) {
    return Boolean(
      snapshot.cliente ||
      snapshot.carrinho ||
      snapshot.programa ||
      Array.isArray(snapshot.pedidos) ||
      Array.isArray(snapshot.pedidosAtivos)
    );
  }

  function snapshotMatchesIdentity(state, snapshot = {}) {
    if (!hasPersonalSnapshot(snapshot)) return true;
    const expectedId = cleanTelegramId(state.telegramId);
    const ids = snapshotTelegramIds(snapshot);
    return Boolean(expectedId && ids.size && [...ids].every(id => id === expectedId));
  }

  function headers(state) {
    const webApp = getTelegram();
    const initData = state.initData || webApp?.initData || '';
    return {
      'Content-Type': 'application/json',
      ...(initData ? { 'X-Telegram-Init-Data': initData } : {}),
      ...(!initData && state.sessionToken ? { Authorization: `Bearer ${state.sessionToken}` } : {})
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
    const initialTelegramId = currentTelegramId();
    if (initialTelegramId) clearLegacySharedStorage();
    const state = {
      apiBase: apiBaseFromLocation(),
      initData: '',
      reopenState: '',
      telegramId: initialTelegramId,
      sessionToken: readSessionToken(initialTelegramId),
      since: readSince(initialTelegramId),
      pollingTimer: null,
      eventSource: null,
      onSnapshot: null,
      onEvents: null,
      onError: null
    };

    function bindIdentity(telegramId) {
      const nextId = cleanTelegramId(telegramId);
      state.telegramId = nextId;
      state.sessionToken = readSessionToken(nextId);
      state.since = readSince(nextId);
      if (nextId) clearLegacySharedStorage();
    }

    function emitSnapshot(snapshot) {
      if (snapshotMatchesIdentity(state, snapshot)) state.onSnapshot?.(snapshot);
    }

    async function init(options) {
      stopPolling();
      stopStream();
      Object.assign(state, options || {});
      state.apiBase = cleanBase(state.apiBase || apiBaseFromLocation());
      const webApp = getTelegram();
      state.initData = options?.initData || webApp?.initData || '';
      state.reopenState = options?.reopenState || state.reopenState || '';
      const expectedTelegramId = currentTelegramId(state.initData);
      bindIdentity(expectedTelegramId);
      const data = await request(state, '/api/telegram-miniapp/session', {
        method: 'POST',
        body: JSON.stringify({
          initData: state.initData,
          reopenState: !state.initData ? state.reopenState || undefined : undefined,
          devUser: options?.devUser || (!state.initData && !state.reopenState && options?.devChatId
            ? { id: options.devChatId, first_name: 'Cliente', last_name: 'Dev' }
            : undefined)
        })
      });
      const authenticatedId = cleanTelegramId(
        data.telegramId || data.chatId || data.snapshot?.telegramId || data.snapshot?.chatId
      );
      if (!authenticatedId) throw new Error('A API nao confirmou o usuario do Telegram.');
      if (expectedTelegramId && authenticatedId !== expectedTelegramId) {
        storeSessionToken(expectedTelegramId, '');
        state.sessionToken = '';
        throw new Error('A sessao recebida pertence a outra conta do Telegram.');
      }
      if (state.telegramId !== authenticatedId) bindIdentity(authenticatedId);
      state.sessionToken = String(data.sessionToken || data.token || '').trim();
      if (!state.sessionToken) throw new Error('A API nao criou uma sessao segura para o Mini App.');
      storeSessionToken(authenticatedId, state.sessionToken);
      if (data.snapshot && !snapshotMatchesIdentity(state, data.snapshot)) {
        storeSessionToken(authenticatedId, '');
        state.sessionToken = '';
        throw new Error('A API retornou dados de outra conta do Telegram.');
      }
      if (data.snapshot) emitSnapshot(data.snapshot);
      return { ...data, telegramId: authenticatedId };
    }

    async function sendAction(action, payload) {
      const data = await request(state, '/api/telegram-miniapp/action', {
        method: 'POST',
        body: JSON.stringify({ action, payload: payload || {} })
      });
      if (data.snapshot) emitSnapshot(data.snapshot);
      return data;
    }

    async function loadEvents(options) {
      const data = await request(state, `/api/telegram-miniapp/events?since=${encodeURIComponent(state.since)}${options?.snapshot ? '&snapshot=1' : ''}`, {
        method: 'GET'
      });
      const responseId = cleanTelegramId(data.telegramId || data.chatId);
      if (responseId && responseId !== state.telegramId) throw new Error('Eventos recebidos de outra conta do Telegram.');
      if (Array.isArray(data.eventos) && data.eventos.length) {
        state.since = Math.max(...data.eventos.map(evento => Number(evento.seq || 0)));
        storeSince(state.telegramId, state.since);
        state.onEvents?.(data.eventos);
      }
      if (data.snapshot) emitSnapshot(data.snapshot);
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
      if (!state.telegramId || !state.sessionToken || !state.apiBase || typeof window.EventSource !== 'function') return false;
      const url = `${cleanBase(state.apiBase)}/api/telegram-miniapp/stream?sessionToken=${encodeURIComponent(state.sessionToken)}&since=${encodeURIComponent(state.since)}`;
      const source = new window.EventSource(url);
      state.eventSource = source;
      source.addEventListener('snapshot', event => {
        try { emitSnapshot(JSON.parse(event.data)); } catch (_) {}
      });
      source.addEventListener('eventos', event => {
        try {
          const data = JSON.parse(event.data);
          const responseId = cleanTelegramId(data.telegramId || data.chatId);
          if (responseId && responseId !== state.telegramId) return;
          if (Array.isArray(data.eventos) && data.eventos.length) {
            state.since = Number(data.since || state.since);
            storeSince(state.telegramId, state.since);
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

    function getSessionToken() {
      const activeTelegramId = currentTelegramId(state.initData);
      if (activeTelegramId && activeTelegramId !== state.telegramId) return '';
      return state.sessionToken || '';
    }

    function getTelegramId() {
      return cleanTelegramId(state.telegramId);
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
      getSessionToken,
      getTelegramId,
      installActionInterceptor,
      state
    };
  }

  window.MJMiniAppBridge = window.MJMiniAppBridge || createBridge();
})(window);
