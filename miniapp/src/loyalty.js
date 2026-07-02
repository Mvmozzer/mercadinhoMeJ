import { apiDiagnosticMessage, retryApiFetchWithFreshRuntimeConfig } from './api.js?v=2026.07.02.224';

export async function loadLoyalty(state) {
  try {
    return await retryApiFetchWithFreshRuntimeConfig(state, '/api/miniapp/loyalty');
  } catch (error) {
    return {
      ok: false,
      unavailable: true,
      erro: apiDiagnosticMessage(error)
    };
  }
}
