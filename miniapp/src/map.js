export function mapStateFromTracking(tracking = {}) { return { mapaUrl: tracking.mapaUrl || tracking.mapUrl || '', mensagem: tracking.mensagem || 'Mapa indisponivel agora.' }; }
