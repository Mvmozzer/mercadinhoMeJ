import { retryApiFetchWithFreshRuntimeConfig } from './api.js?v=2026.07.01.756';
export async function refreshPixStatus(state) { const id = state.pedidoAtual?.id || state.pedidoAtual?.pedidoId || ''; if (!id) return null; return retryApiFetchWithFreshRuntimeConfig(state, `/api/miniapp/pedidos/${encodeURIComponent(id)}/pix`).catch(() => null); }
