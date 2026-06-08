export function mapStateFromTracking(tracking = {}) {
  const localizacao = tracking.localizacao || tracking.entrega?.localizacaoAoVivo || {};
  return {
    aoVivo: localizacao.aoVivo === true,
    latitude: Number(localizacao.latitude || 0),
    longitude: Number(localizacao.longitude || 0),
    atualizadaEm: localizacao.atualizadaEm || '',
    mapaUrl: localizacao.mapaUrl || tracking.entrega?.mapaUrl || '',
    mensagem: localizacao.mensagem || 'Localização ainda indisponível.'
  };
}

export function initMap(container, tracking) {
  updateCourierMarker(container, tracking);
}

export function updateCourierMarker(container, tracking) {
  if (!container) return;
  const state = mapStateFromTracking(tracking);
  if (!state.aoVivo || !state.mapaUrl) {
    container.innerHTML = `<div class="map-fallback">${state.mensagem}</div>`;
    return;
  }
  container.innerHTML = `
    <iframe title="Mapa do entregador" src="${state.mapaUrl}" loading="lazy" referrerpolicy="no-referrer"></iframe>
    <a class="ghost map-link" href="${state.mapaUrl}" target="_blank" rel="noreferrer">Abrir no Maps</a>
  `;
}

export function updateCustomerMarker() {}

export function fitBounds() {}

export function fallbackGoogleMapsLink(tracking = {}) {
  return mapStateFromTracking(tracking).mapaUrl;
}
