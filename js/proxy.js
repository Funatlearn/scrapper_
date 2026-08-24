/**
 * CORS Proxy Utility
 * Handles routing client-side fetch requests through CORS proxy services.
 * Includes JSON wrapping mode to bypass target sites with invalid CORS headers.
 */

const CorsProxy = {
  PROVIDERS: {
    ALLORIGINS_JSON: 'allorigins-json',
    CORSPROXY_IO: 'corsproxy',
    CODETABS: 'codetabs',
    ALLORIGINS_RAW: 'allorigins-raw',
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
    const list = [primaryProvider];
    // Add fallbacks if primary is a proxy
    if (primaryProvider !== this.PROVIDERS.DIRECT) {
      if (!list.includes(this.PROVIDERS.ALLORIGINS_JSON)) list.push(this.PROVIDERS.ALLORIGINS_JSON);
      if (!list.includes(this.PROVIDERS.CORSPROXY_IO)) list.push(this.PROVIDERS.CORSPROXY_IO);
      if (!list.includes(this.PROVIDERS.CODETABS)) list.push(this.PROVIDERS.CODETABS);
    }
    return list;
  },

  /**
   * Fetch target HTML content using chosen proxy or fallback sequence.
   * @param {string} targetUrl 
   * @param {string} provider 
   * @param {string} customPrefix 
   * @returns {Promise<{ html: string, status: string }>}
   */
  async fetchHtml(targetUrl, provider = 'allorigins-json', customPrefix = '') {
    const cleanUrl = this.normalizeTargetUrl(targetUrl);
    const sequence = this.getProviderSequence(provider);

    let lastError = null;

    for (const p of sequence) {
      try {
        const res = await this.tryFetch(cleanUrl, p, customPrefix);
        if (res && res.html !== undefined) {
          return res;
        }
      } catch (err) {
        lastError = err;
        console.warn(`Proxy '${p}' failed for ${cleanUrl}, attempting fallback...`, err.message);
      }
    }

    throw lastError || new Error(`Failed to fetch ${cleanUrl} via available proxy services.`);
  },

  async tryFetch(cleanUrl, provider, customPrefix) {
    if (provider === this.PROVIDERS.ALLORIGINS_JSON) {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(cleanUrl)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data || data.contents === null || data.contents === undefined) {
        throw new Error('AllOrigins returned empty response body');
      }
      return { html: data.contents, status: '200 OK' };
    }

    if (provider === this.PROVIDERS.CORSPROXY_IO) {
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(cleanUrl)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      return { html: text, status: '200 OK' };
    }

    if (provider === this.PROVIDERS.CODETABS) {
      const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(cleanUrl)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      return { html: text, status: '200 OK' };
    }

    if (provider === this.PROVIDERS.ALLORIGINS_RAW) {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(cleanUrl)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
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
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      return { html: text, status: '200 OK' };
    }

    // Direct fetch
    const response = await fetch(cleanUrl, {
      headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    return { html: text, status: '200 OK' };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CorsProxy;
}

