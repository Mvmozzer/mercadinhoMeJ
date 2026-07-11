(function bootstrapLatestMiniAppVersion(globalObject) {
  const currentLocation = globalObject?.location;
  const currentUrl = currentLocation?.href ? new URL(currentLocation.href) : null;
  const hostedOnGithubPages = Boolean(currentUrl && /github\.io$/i.test(currentUrl.hostname));

  if (!hostedOnGithubPages) {
    globalObject.__MJ_VERSION_CHECK__ = Promise.resolve({
      ok: true,
      checked: false,
      reloading: false
    });
    return;
  }

  globalObject.__MJ_VERSION_CHECK__ = (async () => {
    const candidates = ['./version.json', '../version.json'];
    let version = null;

    for (const candidate of candidates) {
      try {
        const versionUrl = new URL(candidate, currentUrl);
        versionUrl.searchParams.set('ts', String(Date.now()));
        const response = await globalObject.fetch(versionUrl.toString(), {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (!response.ok) continue;
        version = await response.json();
        if (version?.webBuild) break;
      } catch (_) {
        // Tenta o proximo caminho; a loja continua com o ultimo build carregavel.
      }
    }

    const webBuild = String(version?.webBuild || '').trim();
    if (!/^\d{4}\.\d{2}\.\d{2}\.\d{3}$/.test(webBuild)) {
      return { ok: false, checked: true, reloading: false };
    }

    const requestedBuild = String(currentUrl.searchParams.get('miniapp_v') || '').trim();
    if (requestedBuild !== webBuild) {
      currentUrl.searchParams.set('miniapp_v', webBuild);
      currentUrl.searchParams.set('mj_refresh', webBuild);
      globalObject.location.replace(currentUrl.toString());
      return { ok: true, checked: true, reloading: true, webBuild };
    }

    return { ok: true, checked: true, reloading: false, webBuild };
  })();
})(window);
