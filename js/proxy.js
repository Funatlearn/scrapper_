/**
 * CORS Proxy Utility
 * Handles routing client-side fetch requests through CORS proxy services.
 */

const CorsProxy = {
  PROVIDERS: {
    CORSPROXY_IO: 'corsproxy',
    ALLORIGINS: 'allorigins',
    DIRECT: 'direct',
    CUSTOM: 'custom'
  },

  /**
   * Wrap target URL with the selected proxy service.
   * @param {string} targetUrl - The website URL to scrape.
   * @param {string} provider - The chosen proxy provider key.
   * @param {string} customPrefix - Optional custom proxy URL template.
   * @returns {string} The final fetchable URL.
   */
  getProxyUrl(targetUrl, provider = 'corsproxy', customPrefix = '') {
    if (!targetUrl) return '';
    
    // Normalize target URL
    let cleanUrl = targetUrl.trim();
    if (!cleanUrl.match(/^https?:\/\//i)) {
      cleanUrl = 'https://' + cleanUrl;
    }

    switch (provider) {
      case this.PROVIDERS.CORSPROXY_IO:
        return `https://corsproxy.io/?${encodeURIComponent(cleanUrl)}`;

      case this.PROVIDERS.ALLORIGINS:
        return `https://api.allorigins.win/raw?url=${encodeURIComponent(cleanUrl)}`;

      case this.PROVIDERS.CUSTOM:
        if (customPrefix && customPrefix.trim()) {
          const prefix = customPrefix.trim();
          return prefix.includes('%s') 
            ? prefix.replace('%s', encodeURIComponent(cleanUrl))
            : `${prefix}${encodeURIComponent(cleanUrl)}`;
        }
        return cleanUrl;

      case this.PROVIDERS.DIRECT:
      default:
        return cleanUrl;
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CorsProxy;
}
