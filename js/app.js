/**
 * UI Controller & Application Orchestrator
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const form = document.getElementById('scraper-form');
  const targetUrlInput = document.getElementById('target-url');
  const maxDepthInput = document.getElementById('max-depth');
  const proxySelect = document.getElementById('proxy-provider');
  const customProxyInput = document.getElementById('custom-proxy-url');
  const customProxyContainer = document.getElementById('custom-proxy-container');
  const domainScopeSelect = document.getElementById('domain-scope');
  const concurrencyInput = document.getElementById('concurrency');
  const ignoreBinaryCheck = document.getElementById('ignore-binary');

  // Control Buttons
  const startBtn = document.getElementById('btn-start');
  const pauseBtn = document.getElementById('btn-pause');
  const stopBtn = document.getElementById('btn-stop');
  const resetBtn = document.getElementById('btn-reset');
  const exportCsvBtn = document.getElementById('btn-export-csv');
  const exportJsonBtn = document.getElementById('btn-export-json');

  // Advanced Settings Toggle
  const toggleAdvancedBtn = document.getElementById('toggle-advanced');
  const advancedPanel = document.getElementById('advanced-panel');

  // Metrics
  const metricDiscovered = document.getElementById('metric-discovered');
  const metricCrawled = document.getElementById('metric-crawled');
  const metricQueue = document.getElementById('metric-queue');
  const metricErrors = document.getElementById('metric-errors');
  const metricTime = document.getElementById('metric-time');
  const statusBadge = document.getElementById('status-badge');
  const progressBarFill = document.getElementById('progress-bar-fill');

  // Table & Filters
  const tableBody = document.getElementById('table-body');
  const emptyState = document.getElementById('empty-state');
  const searchInput = document.getElementById('table-search');
  const filterTypeSelect = document.getElementById('filter-type');
  const colToggleBtn = document.getElementById('col-toggle-btn');
  const colToggleWrapper = document.getElementById('col-toggle-wrapper');
  const colCheckboxes = document.querySelectorAll('.col-toggle-checkbox');

  // Timer & Crawler instance
  let crawler = null;
  let timerInterval = null;
  let allLinks = [];

  // Toggle Advanced Settings
  toggleAdvancedBtn?.addEventListener('click', () => {
    advancedPanel.classList.toggle('open');
  });

  // Toggle Custom Proxy Input Visibility
  proxySelect?.addEventListener('change', () => {
    if (proxySelect.value === 'custom') {
      customProxyContainer.style.display = 'flex';
    } else {
      customProxyContainer.style.display = 'none';
    }
  });

  // Column Visibility Management
  colToggleBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    colToggleWrapper.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!colToggleWrapper?.contains(e.target)) {
      colToggleWrapper?.classList.remove('open');
    }
  });

  colCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const colClass = e.target.getAttribute('data-col');
      const cells = document.querySelectorAll(`.${colClass}`);
      cells.forEach(cell => {
        if (e.target.checked) {
          cell.classList.remove('col-hidden');
        } else {
          cell.classList.add('col-hidden');
        }
      });
    });
  });

  // Start Crawl Event
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = targetUrlInput.value.trim();
    if (!url) {
      showToast('Please enter a target website URL', 'warning');
      return;
    }

    const depth = parseInt(maxDepthInput.value) || 0;
    const proxy = proxySelect.value;
    const customProxy = customProxyInput.value;
    const domainScope = domainScopeSelect.value;
    const concurrency = parseInt(concurrencyInput.value) || 3;
    const ignoreBinary = ignoreBinaryCheck.checked;

    // Reset Table and state
    allLinks = [];
    tableBody.innerHTML = '';
    emptyState.style.display = 'none';
    exportCsvBtn.disabled = true;
    exportJsonBtn.disabled = true;

    // Instantiate WebCrawler
    crawler = new WebCrawler({
      maxDepth: depth,
      domainScope: domainScope,
      proxyProvider: proxy,
      customProxyUrl: customProxy,
      concurrency: concurrency,
      ignoreBinaryFiles: ignoreBinary,

      onItemDiscovered: (item) => {
        allLinks.push(item);
        renderRow(item, allLinks.length);
        exportCsvBtn.disabled = false;
        exportJsonBtn.disabled = false;
      },

      onProgress: (stats) => {
        updateMetrics(stats);
      },

      onFinished: (stats) => {
        setUIState('finished');
        clearInterval(timerInterval);
        showToast(`Crawl finished! Discovered ${allLinks.length} links.`, 'success');
      },

      onError: (item, errMessage) => {
        updateRowStatus(item);
      }
    });

    // Start Timer & Crawler
    setUIState('running');
    startTimer();

    crawler.start(url).catch(err => {
      showToast(err.message || 'Crawl initialization failed', 'error');
      setUIState('idle');
    });
  });

  // Pause / Resume Event
  pauseBtn.addEventListener('click', () => {
    if (!crawler) return;
    if (crawler.isPaused) {
      crawler.resume();
      setUIState('running');
      startTimer();
      showToast('Crawling resumed', 'info');
    } else {
      crawler.pause();
      setUIState('paused');
      clearInterval(timerInterval);
      showToast('Crawling paused', 'warning');
    }
  });

  // Stop Event
  stopBtn.addEventListener('click', () => {
    if (!crawler) return;
    crawler.stop();
    setUIState('idle');
    clearInterval(timerInterval);
    showToast('Crawl stopped by user', 'info');
  });

  // Reset Event
  resetBtn.addEventListener('click', () => {
    if (crawler) crawler.stop();
    allLinks = [];
    tableBody.innerHTML = '';
    emptyState.style.display = 'block';
    resetMetrics();
    setUIState('idle');
    clearInterval(timerInterval);
    exportCsvBtn.disabled = true;
    exportJsonBtn.disabled = true;
    showToast('Dashboard reset', 'info');
  });

  // Filter & Search Events
  searchInput.addEventListener('input', filterTable);
  filterTypeSelect.addEventListener('change', filterTable);

  function filterTable() {
    const query = searchInput.value.toLowerCase().trim();
    const typeFilter = filterTypeSelect.value;

    const rows = tableBody.querySelectorAll('tr');
    rows.forEach(row => {
      const url = row.getAttribute('data-url') || '';
      const anchor = row.getAttribute('data-anchor') || '';
      const isInternal = row.getAttribute('data-internal') === 'true';

      let matchesSearch = !query || url.includes(query) || anchor.includes(query);
      let matchesType = true;

      if (typeFilter === 'internal') matchesType = isInternal;
      if (typeFilter === 'external') matchesType = !isInternal;

      if (matchesSearch && matchesType) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  }

  // Row Rendering Helper
  function renderRow(item, index) {
    const tr = document.createElement('tr');
    tr.setAttribute('data-url', item.url.toLowerCase());
    tr.setAttribute('data-anchor', item.anchorText.toLowerCase());
    tr.setAttribute('data-internal', item.isInternal);

    // Get current column checkbox states
    const hiddenCols = getHiddenColumnClasses();

    tr.innerHTML = `
      <td class="col-index ${hiddenCols.has('col-index') ? 'col-hidden' : ''}">${index}</td>
      <td class="col-url ${hiddenCols.has('col-url') ? 'col-hidden' : ''}">
        <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener" class="url-link">${escapeHtml(item.url)}</a>
      </td>
      <td class="col-anchor ${hiddenCols.has('col-anchor') ? 'col-hidden' : ''}">${escapeHtml(item.anchorText)}</td>
      <td class="col-depth ${hiddenCols.has('col-depth') ? 'col-hidden' : ''}">
        <span class="badge badge-depth">Depth ${item.depth}</span>
      </td>
      <td class="col-parent ${hiddenCols.has('col-parent') ? 'col-hidden' : ''}">
        ${item.parentUrl === 'ROOT' ? '<em>Target Homepage</em>' : `<a href="${escapeHtml(item.parentUrl)}" target="_blank" rel="noopener" class="url-link">${escapeHtml(item.parentUrl)}</a>`}
      </td>
      <td class="col-type ${hiddenCols.has('col-type') ? 'col-hidden' : ''}">
        <span class="badge ${item.isInternal ? 'badge-internal' : 'badge-external'}">
          ${item.isInternal ? 'Internal' : 'External'}
        </span>
      </td>
      <td class="col-status ${hiddenCols.has('col-status') ? 'col-hidden' : ''}">
        <span class="badge status-pill ${item.status === '200 OK' ? 'badge-200' : (item.status.includes('HTTP') || item.status.includes('Failed') ? 'badge-error' : '')}">
          ${escapeHtml(item.status)}
        </span>
      </td>
    `;

    tableBody.appendChild(tr);
  }

  function updateRowStatus(item) {
    const rows = tableBody.querySelectorAll('tr');
    rows.forEach(row => {
      if (row.getAttribute('data-url') === item.url.toLowerCase()) {
        const statusCell = row.querySelector('.col-status');
        if (statusCell) {
          statusCell.innerHTML = `
            <span class="badge status-pill ${item.status === '200 OK' ? 'badge-200' : 'badge-error'}">
              ${escapeHtml(item.status)}
            </span>
          `;
        }
      }
    });
  }

  function getHiddenColumnClasses() {
    const hidden = new Set();
    colCheckboxes.forEach(cb => {
      if (!cb.checked) {
        hidden.add(cb.getAttribute('data-col'));
      }
    });
    return hidden;
  }

  // Export to CSV
  exportCsvBtn.addEventListener('click', () => {
    if (allLinks.length === 0) return;

    const headers = ['Index', 'URL', 'Anchor Text', 'Depth', 'Parent URL', 'Link Type', 'Status'];
    const rows = allLinks.map((item, i) => [
      i + 1,
      `"${item.url.replace(/"/g, '""')}"`,
      `"${item.anchorText.replace(/"/g, '""')}"`,
      item.depth,
      `"${item.parentUrl.replace(/"/g, '""')}"`,
      item.isInternal ? 'Internal' : 'External',
      `"${item.status.replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadFile(csvContent, `scraped_links_${Date.now()}.csv`, 'text/csv;charset=utf-8;');
    showToast('CSV export downloaded!', 'success');
  });

  // Export to JSON
  exportJsonBtn.addEventListener('click', () => {
    if (allLinks.length === 0) return;

    const jsonContent = JSON.stringify(allLinks, null, 2);
    downloadFile(jsonContent, `scraped_links_${Date.now()}.json`, 'application/json');
    showToast('JSON export downloaded!', 'success');
  });

  function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // UI State & Metrics helpers
  function updateMetrics(stats) {
    metricDiscovered.textContent = stats.totalDiscovered;
    metricCrawled.textContent = stats.crawledCount;
    metricQueue.textContent = stats.queueSize;
    metricErrors.textContent = stats.errorCount;

    // Progress bar fill calculation
    const totalProcessed = stats.crawledCount + stats.errorCount;
    const totalKnown = stats.totalDiscovered || 1;
    const percentage = Math.min(100, Math.round((totalProcessed / totalKnown) * 100));
    progressBarFill.style.width = `${percentage}%`;
  }

  function resetMetrics() {
    metricDiscovered.textContent = '0';
    metricCrawled.textContent = '0';
    metricQueue.textContent = '0';
    metricErrors.textContent = '0';
    metricTime.textContent = '00:00';
    progressBarFill.style.width = '0%';
  }

  function startTimer() {
    clearInterval(timerInterval);
    const startTime = Date.now() - (crawler ? (crawler.stats.startTime ? (Date.now() - crawler.stats.startTime) : 0) : 0);
    timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const secs = String(elapsed % 60).padStart(2, '0');
      metricTime.textContent = `${mins}:${secs}`;
    }, 1000);
  }

  function setUIState(state) {
    if (state === 'running') {
      startBtn.disabled = true;
      pauseBtn.disabled = false;
      pauseBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg> Pause`;
      stopBtn.disabled = false;
      statusBadge.classList.add('active');
      statusBadge.querySelector('span:last-child').textContent = 'Crawling...';
    } else if (state === 'paused') {
      pauseBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
        </svg> Resume`;
      statusBadge.classList.remove('active');
      statusBadge.querySelector('span:last-child').textContent = 'Paused';
    } else if (state === 'finished' || state === 'idle') {
      startBtn.disabled = false;
      pauseBtn.disabled = true;
      stopBtn.disabled = true;
      statusBadge.classList.remove('active');
      statusBadge.querySelector('span:last-child').textContent = state === 'finished' ? 'Complete' : 'Idle';
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
  }

  function showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 4000);
  }
});
