/**
 * Modular Web Crawler Engine
 * Handles breadth-first depth crawling, link extraction, domain restrictions, and deduplication.
 */

class WebCrawler {
  constructor(options = {}) {
    this.maxDepth = options.maxDepth ?? 1;
    this.domainScope = options.domainScope || 'same-origin'; // 'same-origin', 'same-domain', 'any'
    this.proxyProvider = options.proxyProvider || 'corsproxy';
    this.customProxyUrl = options.customProxyUrl || '';
    this.ignoreBinaryFiles = options.ignoreBinaryFiles !== false;
    this.concurrency = options.concurrency || 3;
    this.delayMs = options.delayMs || 150;

    // Callbacks
    this.onItemDiscovered = options.onItemDiscovered || (() => {});
    this.onProgress = options.onProgress || (() => {});
    this.onFinished = options.onFinished || (() => {});
    this.onError = options.onError || (() => {});

    // Internal State
    this.queue = [];
    this.visitedUrls = new Set();
    this.discoveredLinks = [];
    this.activeWorkers = 0;
    this.isRunning = false;
    this.isPaused = false;
    this.isAborted = false;
    this.startUrlObj = null;

    // Stats
    this.stats = {
      crawledCount: 0,
      totalDiscovered: 0,
      errorCount: 0,
      maxDepthReached: 0,
      startTime: null,
      endTime: null
    };

    // Default Binary Extensions to Ignore
    this.binaryExtensions = new Set([
      'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp',
      'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'tar', 'gz', '7z',
      'mp3', 'mp4', 'avi', 'mov', 'wmv', 'wav', 'ogg', 'flac',
      'css', 'js', 'json', 'xml', 'woff', 'woff2', 'ttf', 'eot'
    ]);
  }

  /**
   * Start crawling from a given root URL.
   * @param {string} rootUrl 
   */
  async start(rootUrl) {
    this.reset();
    
    let cleanRoot = rootUrl.trim();
    if (!cleanRoot.match(/^https?:\/\//i)) {
      cleanRoot = 'https://' + cleanRoot;
    }

    try {
      this.startUrlObj = new URL(cleanRoot);
    } catch (e) {
      throw new Error(`Invalid starting URL: ${rootUrl}`);
    }

    this.isRunning = true;
    this.stats.startTime = Date.now();

    // Add root item to queue
    const rootItem = {
      url: this.startUrlObj.href,
      parentUrl: 'ROOT',
      depth: 0,
      anchorText: 'Target Homepage',
      isInternal: true,
      status: 'Pending'
    };

    this.queue.push(rootItem);
    this.visitedUrls.add(this.normalizeUrl(this.startUrlObj.href));
    
    this.processQueue();
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    if (this.isPaused) {
      this.isPaused = false;
      this.processQueue();
    }
  }

  stop() {
    this.isAborted = true;
    this.isRunning = false;
    this.isPaused = false;
    this.stats.endTime = Date.now();
    this.onFinished(this.stats, this.discoveredLinks);
  }

  reset() {
    this.queue = [];
    this.visitedUrls.clear();
    this.discoveredLinks = [];
    this.activeWorkers = 0;
    this.isRunning = false;
    this.isPaused = false;
    this.isAborted = false;
    this.stats = {
      crawledCount: 0,
      totalDiscovered: 0,
      errorCount: 0,
      maxDepthReached: 0,
      startTime: null,
      endTime: null
    };
  }

  async processQueue() {
    if (!this.isRunning || this.isPaused || this.isAborted) return;

    // Check if crawl completed
    if (this.queue.length === 0 && this.activeWorkers === 0) {
      this.stop();
      return;
    }

    // Spawn concurrent workers
    while (this.queue.length > 0 && this.activeWorkers < this.concurrency && !this.isPaused && !this.isAborted) {
      const item = this.queue.shift();
      this.activeWorkers++;
      
      // Process single item asynchronously
      this.crawlItem(item).finally(() => {
        this.activeWorkers--;
        if (this.delayMs > 0) {
          setTimeout(() => this.processQueue(), this.delayMs);
        } else {
          this.processQueue();
        }
      });
    }

    this.emitProgress();
  }

  async crawlItem(item) {
    if (this.isAborted) return;

    this.stats.maxDepthReached = Math.max(this.stats.maxDepthReached, item.depth);
    
    // Add item to discovered list & notify listener
    this.discoveredLinks.push(item);
    this.stats.totalDiscovered = this.discoveredLinks.length;
    this.onItemDiscovered(item);

    // If depth is greater than max depth, do not fetch HTML for sub-links
    if (item.depth > this.maxDepth) {
      item.status = 'Max Depth Reached';
      this.stats.crawledCount++;
      this.emitProgress();
      return;
    }

    // Fetch page HTML via CORS proxy manager with fallback chain
    try {
      const result = await CorsProxy.fetchHtml(item.url, this.proxyProvider, this.customProxyUrl);

      item.status = result.status || '200 OK';
      const htmlText = result.html;
      this.stats.crawledCount++;

      // Extract new links from HTML
      const extractedLinks = this.extractLinks(htmlText, item.url, item.depth + 1);

      for (const newLink of extractedLinks) {
        const normalized = this.normalizeUrl(newLink.url);

        if (!this.visitedUrls.has(normalized)) {
          // Domain check
          if (this.isUrlAllowed(newLink.url)) {
            this.visitedUrls.add(normalized);
            this.queue.push(newLink);
          }
        }
      }

    } catch (err) {
      item.status = 'Fetch Failed / CORS';
      this.stats.errorCount++;
      this.onError(item, err.message || 'Network error');
    } finally {
      this.emitProgress();
    }
  }

  /**
   * Extract HTML links via DOMParser
   */
  extractLinks(html, currentUrl, nextDepth) {
    const links = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Check document base tag
    let baseUrl = currentUrl;
    const baseTag = doc.querySelector('base[href]');
    if (baseTag && baseTag.getAttribute('href')) {
      try {
        baseUrl = new URL(baseTag.getAttribute('href'), currentUrl).href;
      } catch (e) {}
    }

    const anchorElements = doc.querySelectorAll('a[href]');
    const baseObj = new URL(baseUrl);

    anchorElements.forEach(anchor => {
      const rawHref = anchor.getAttribute('href');
      if (!rawHref || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:') || rawHref.startsWith('#')) {
        return;
      }

      try {
        const absoluteUrlObj = new URL(rawHref, baseObj.href);
        absoluteUrlObj.hash = '';

        const absoluteUrl = absoluteUrlObj.href;

        // Skip binary extensions if setting enabled
        if (this.ignoreBinaryFiles && this.isBinaryFile(absoluteUrlObj.pathname)) {
          return;
        }

        const isInternal = this.checkSameDomain(absoluteUrlObj);
        const anchorText = anchor.textContent?.trim() || anchor.getAttribute('title') || anchor.getAttribute('aria-label') || '[No Text]';

        links.push({
          url: absoluteUrl,
          parentUrl: currentUrl,
          depth: nextDepth,
          anchorText: anchorText.substring(0, 100),
          isInternal: isInternal,
          status: 'Discovered'
        });
      } catch (e) {
        // Invalid URL format
      }
    });

    return links;
  }

  isUrlAllowed(targetUrl) {
    try {
      const targetObj = new URL(targetUrl);
      if (this.domainScope === 'same-origin') {
        return targetObj.origin === this.startUrlObj.origin;
      } else if (this.domainScope === 'same-domain') {
        return this.checkSameDomain(targetObj);
      }
      return true; // 'any'
    } catch (e) {
      return false;
    }
  }

  checkSameDomain(targetObj) {
    if (!this.startUrlObj) return false;
    const startHost = this.startUrlObj.hostname.replace(/^www\./, '');
    const targetHost = targetObj.hostname.replace(/^www\./, '');
    return targetHost === startHost || targetHost.endsWith('.' + startHost);
  }

  isBinaryFile(pathname) {
    const ext = pathname.split('.').pop().toLowerCase();
    return this.binaryExtensions.has(ext);
  }

  normalizeUrl(urlStr) {
    try {
      const u = new URL(urlStr);
      u.hash = '';
      if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
        u.pathname = u.pathname.slice(0, -1);
      }
      return u.href;
    } catch (e) {
      return urlStr;
    }
  }

  emitProgress() {
    this.onProgress({
      crawledCount: this.stats.crawledCount,
      totalDiscovered: this.stats.totalDiscovered,
      queueSize: this.queue.length,
      errorCount: this.stats.errorCount,
      maxDepthReached: this.stats.maxDepthReached,
      elapsedMs: this.stats.startTime ? Date.now() - this.stats.startTime : 0
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebCrawler;
}
