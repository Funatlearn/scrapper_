# Web Scraper & Link Crawler

A fast, customizable, client-side Web Scraper and URL Link Crawler built with vanilla HTML5, CSS3, and JavaScript. Designed to run directly in the browser and ready to host for free on **GitHub Pages**.

![Web Scraper Interface](https://img.shields.io/badge/License-MIT-blue.svg) ![HTML5](https://img.shields.io/badge/Frontend-HTML5%20%7C%20CSS3%20%7C%20JS-orange) ![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub%20Pages-brightgreen)

## Features

- 🌐 **Deep Link Crawling**: Specify starting URL and crawl depth level (0 = target page only, 1 = direct links, 2+ = nested links).
- ⚙️ **CORS Proxy Integration**: Built-in support for `corsproxy.io`, `api.allorigins.win`, or custom CORS proxies to scrape external websites directly from client-side JavaScript.
- 🎯 **Domain Scope Controls**: Restrict crawl to Same-Origin (internal links), Same-Domain (subdomains included), or Allow External links.
- 👁️ **Column Visibility Toggles**: Customize table views by showing/hiding any column (including hiding/showing the **Depth** column dynamically).
- 🔍 **Live Search & Filter**: Real-time filtering by URL text, depth level, or link type (Internal / External).
- 📊 **Real-time Metrics Dashboard**: Live progress bar, counters for total links found, queue size, crawled pages, errors, and pause/stop/resume controls.
- 📥 **Flexible Exporting**: Export discovered link table data directly into **CSV** (Excel-compatible with UTF-8 BOM) or **JSON**.
- 🧩 **Future Extensibility**: Modular `crawler.js` engine decoupled from UI, making it ready to port to **Chrome Extensions (Manifest v3)** or **Android Apps (Capacitor/WebView)**.

---

## Quick Start (Local Run)

No `node_modules` or build step required! Simply run a local HTTP server:

```bash
# Option 1: Python
python -m http.server 8000

# Option 2: Node.js (npx)
npx serve .
```

Open your browser at `http://localhost:8000`.

---

## Hosting on GitHub Pages

1. **Push code to GitHub**:
   ```bash
   git add .
   git commit -m "Initial commit of Web Scraper project"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

2. **Enable GitHub Pages**:
   - Go to your repository on GitHub: `Settings` -> `Pages`.
   - Under **Build and deployment** -> **Source**, choose `Deploy from a branch`.
   - Select `main` branch and `/ (root)` folder.
   - Click **Save**.
   - Your site will be live at `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`.

---

## Extensibility Guide

### Porting to Chrome Extension (Manifest v3)
In a Chrome Extension:
1. Manifest v3 service workers can make direct `fetch()` calls to any domain by defining `"host_permissions": ["<all_urls>"]`.
2. Set the proxy selector in the app to **Direct Fetch**.
3. Import `js/crawler.js` into your extension background service worker.

### Porting to Android App
- **Capacitor / Cordova**: Wrap this project directory directly with `@capacitor/cli` (`npx cap add android`) to build an APK.
- **Native Kotlin**: Re-use `crawler.js` concepts with `OkHttp` + `JSoup` for multi-threaded background scraping.

---

## License
MIT License. Free for personal and commercial use.
