/* =====================================================
   WBO - Shared UI: Mobile Sidebar + Theme Toggle
   ===================================================== */

(function () {
  const THEME_KEY = 'wbo_theme';

  // ─── Theme ─────────────────────────────────────────
  function getTheme() { return localStorage.getItem(THEME_KEY) || 'dark'; }

  function applyTheme(t) {
    document.body.classList.toggle('theme-light', t === 'light');
    const fab = document.getElementById('themeFab');
    if (fab) {
      fab.innerHTML = t === 'light'
        ? '🌙<span class="fab-tooltip">Modo Escuro</span>'
        : '☀️<span class="fab-tooltip">Modo Claro</span>';
    }
  }

  // ─── Sidebar ───────────────────────────────────────
  function openSidebar() {
    document.querySelector('.sidebar')?.classList.add('open');
    document.getElementById('sidebarOverlay')?.classList.add('visible');
    document.getElementById('hamburgerBtn')?.classList.add('open');
  }

  function closeSidebar() {
    document.querySelector('.sidebar')?.classList.remove('open');
    document.getElementById('sidebarOverlay')?.classList.remove('visible');
    document.getElementById('hamburgerBtn')?.classList.remove('open');
  }

  function toggleSidebar() {
    const isOpen = document.querySelector('.sidebar')?.classList.contains('open');
    isOpen ? closeSidebar() : openSidebar();
  }

  // Expose globally so onclick attributes can reach it
  window._wboToggleSidebar = toggleSidebar;

  // ─── Inject UI Elements ───────────────────────────
  function injectUI() {
    // 1. Floating theme FAB
    const fab = document.createElement('button');
    fab.id = 'themeFab';
    fab.className = 'theme-fab';
    fab.setAttribute('aria-label', 'Alternar tema');
    fab.addEventListener('click', function () {
      const next = getTheme() === 'light' ? 'dark' : 'light';
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
    });
    document.body.appendChild(fab);

    // 2. Overlay backdrop
    const overlay = document.createElement('div');
    overlay.id = 'sidebarOverlay';
    overlay.className = 'sidebar-overlay';
    overlay.addEventListener('click', closeSidebar);
    document.body.appendChild(overlay);

    // 3. Mobile topbar (only on pages with .app-layout)
    const layout = document.querySelector('.app-layout');
    if (layout) {
      const topbar = document.createElement('div');
      topbar.className = 'mobile-topbar';

      const logoDiv = document.createElement('div');
      logoDiv.className = 'mobile-logo';
      logoDiv.innerHTML = `
        <div class="logo-icon" style="background:linear-gradient(135deg,#1E88E5,#0D47A1);border-radius:10px;overflow:hidden;width:34px;height:34px;flex-shrink:0">
          <img src="/img/wbo_owl.png" alt="WBO" style="width:100%;height:100%;object-fit:cover"
            onerror="this.style.display='none';this.parentElement.textContent='🎓'">
        </div>
        <div style="line-height:1.2">
          <div class="mobile-logo-text">WBO Tecnologia</div>
          <div style="font-size:0.6rem;color:var(--gray-400);font-weight:400">Sistema Gerador de Provas</div>
        </div>`;

      const hamburger = document.createElement('button');
      hamburger.id = 'hamburgerBtn';
      hamburger.className = 'hamburger-btn';
      hamburger.setAttribute('aria-label', 'Abrir menu');
      hamburger.innerHTML = '<span></span><span></span><span></span>';
      // Use addEventListener — no inline onclick strings
      hamburger.addEventListener('click', toggleSidebar);

      topbar.appendChild(logoDiv);
      topbar.appendChild(hamburger);
      layout.parentNode.insertBefore(topbar, layout);
    }

    // Apply saved theme
    applyTheme(getTheme());
  }

  // ─── Update Sidebar Logo ─────────────────────────
  function updateSidebarLogo() {
    const logoIcon = document.querySelector('.sidebar-logo .logo-icon');
    if (logoIcon) {
      logoIcon.innerHTML = `<img src="/img/wbo_owl.png" alt="WBO"
        style="width:100%;height:100%;object-fit:cover;border-radius:8px"
        onerror="this.parentElement.textContent='🎓'">`;
    }
    const logoText = document.querySelector('.sidebar-logo .logo-text');
    if (logoText) {
      logoText.innerHTML = '<strong>WBO Tecnologia</strong><span>Sistema Gerador de Provas</span>';
    }
  }

  // ─── Init ─────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      injectUI();
      updateSidebarLogo();
    });
  } else {
    injectUI();
    updateSidebarLogo();
  }
})();
