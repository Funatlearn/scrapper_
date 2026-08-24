/**
 * CORS Proxy Utility
 * Smart multi-proxy failover manager with request timeouts to bypass CORS restrictions & target server blocks.
 */

const CorsProxy = {
  PROVIDERS: {
    AUTO: 'auto',
    CODETABS: 'codetabs',
    CORSPROXY_ORG: 'corsproxy-org',
    ALLORIGINS_JSON: 'allorigins-json',
    THINGPROXY: 'thingproxy',
    CORSPROXY_IO: 'corsproxy',
    DIRECT: 'direct',
    CUSTOM: 'custom'
  },

  normalizeTargetUrl(url) {
    let cleanUrl = (url || '').trim();
    if (!cleanUrl.match(/^https?:\/\//i)) {
      cleanUrl = 'https://' + cleanUrl;
    }
    return cleanUrl;
  },

  getProviderSequence(primaryProvider) {
    if (primaryProvider === this.PROVIDERS.DIRECT) {
      return [this.PROVIDERS.DIRECT];
    }

    const allProxies = [
      this.PROVIDERS.CODETABS,
      this.PROVIDERS.CORSPROXY_ORG,
      this.PROVIDERS.ALLORIGINS_JSON,
      this.PROVIDERS.THINGPROXY,
      this.PROVIDERS.CORSPROXY_IO
    ];

    if (primaryProvider && primaryProvider !== this.PROVIDERS.AUTO && primaryProvider !== this.PROVIDERS.CUSTOM) {
      return [primaryProvider, ...allProxies.filter(p => p !== primaryProvider)];
    }

    if (primaryProvider === this.PROVIDERS.CUSTOM) {
      return [this.PROVIDERS.CUSTOM, ...allProxies];
    }

    return allProxies;
  },

  /**
   * Fetch target HTML with automatic failover chain and timeout.
   * @param {string} targetUrl 
   * @param {string} provider 
   * @param {string} customPrefix 
   * @param {number} timeoutMs 
   * @returns {Promise<{ html: string, status: string, usedProxy: string }>}
   */
  async fetchHtml(targetUrl, provider = 'auto', customPrefix = '', timeoutMs = 8000) {
    const cleanUrl = this.normalizeTargetUrl(targetUrl);
    const sequence = this.getProviderSequence(provider);

    let lastError = null;

    for (const p of sequence) {
      try {
        const res = await this.fetchWithTimeout(cleanUrl, p, customPrefix, timeoutMs);
        if (res && res.html && res.html.trim().length > 30) {
          return { ...res, usedProxy: p };
        }
      } catch (err) {
        lastError = err;
        console.warn(`Proxy '${p}' failed for ${cleanUrl}: ${err.message}. Trying next proxy in chain...`);
      }
    }

    throw lastError || new Error(`All CORS proxies failed to fetch ${cleanUrl}.`);
  },

  async fetchWithTimeout(cleanUrl, provider, customPrefix, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await this.tryFetch(cleanUrl, provider, customPrefix, controller.signal);
      clearTimeout(timeoutId);
      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`Proxy '${provider}' timed out after ${timeoutMs}ms`);
      }
      throw err;
    }
  },

  async tryFetch(cleanUrl, provider, customPrefix, signal) {
    if (provider === this.PROVIDERS.CODETABS) {
      const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(cleanUrl)}`;
      const res = await fetch(proxyUrl, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!text || text.includes('Error 500') || text.includes('Error 522')) {
        throw new Error('CodeTabs proxy error page');
      }
      return { html: text, status: '200 OK' };
    }

    if (provider === this.PROVIDERS.CORSPROXY_ORG) {
      const proxyUrl = `https://corsproxy.org/?${encodeURIComponent(cleanUrl)}`;
      const res = await fetch(proxyUrl, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      return { html: text, status: '200 OK' };
    }

    if (provider === this.PROVIDERS.ALLORIGINS_JSON) {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(cleanUrl)}`;
      const res = await fetch(proxyUrl, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data || !data.contents) throw new Error('AllOrigins empty response');
      return { html: data.contents, status: '200 OK' };
    }

    if (provider === this.PROVIDERS.THINGPROXY) {
      const proxyUrl = `https://thingproxy.freeboard.io/fetch/${cleanUrl}`;
      const res = await fetch(proxyUrl, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      return { html: text, status: '200 OK' };
    }

    if (provider === this.PROVIDERS.CORSPROXY_IO) {
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(cleanUrl)}`;
      const res = await fetch(proxyUrl, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      return { html: text, status: '200 OK' };
    }

    if (provider === this.PROVIDERS.CUSTOM) {
      let proxyUrl = cleanUrl;
      if (customPrefix && customPrefix.trim()) {
        const prefix = customPrefix.trim();
        proxyUrl = prefix.includes('%s')
          ? prefix.replace('%s', encodeURIComponent(cleanUrl))
          : `${prefix}${encodeURIComponent(cleanUrl)}`;
      }
      const res = await fetch(proxyUrl, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      return { html: text, status: '200 OK' };
    }

    // Direct Fetch
    const res = await fetch(cleanUrl, {
      signal,
      headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return { html: text, status: '200 OK' };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CorsProxy;
}


