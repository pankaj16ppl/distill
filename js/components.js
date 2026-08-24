// js/components.js
// Builds the shared sidebar / topnav / footer shell used by every logged-in
// page, plus small render helpers reused across pages.

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

const NAV_ITEMS = [
  { id: "home", href: "home.html", icon: "home", label: "Home" },
  { id: "newchat", href: "new-chat.html", icon: "message-square-plus", label: "New Chat" },
  { id: "dashboard", href: "dashboard.html", icon: "layout-dashboard", label: "Dashboard" },
  { id: "history", href: "history.html", icon: "history", label: "History" },
  { id: "offers", href: "offers.html", icon: "tag", label: "Offers" },
  { id: "trendy", href: "trendy.html", icon: "flame", label: "Trending" },
];

const PAGE_TITLES = {
  home: "Home", newchat: "New Chat", dashboard: "Dashboard",
  history: "History", offers: "Offers", trendy: "Trending", profile: "Profile",
};

function historyPreviewMarkup() {
  const items = getHistory().slice(0, 5);
  if (!items.length) return `<p class="px-4 py-3 text-sm text-muted">No searches yet.</p>`;
  return items.map((h) => `
    <button class="history-run w-full flex items-center gap-3 px-4 py-2.5 text-left rounded-xl nav-link hover:bg-green-light/60"
      data-query="${escapeHtml(h.query)}">
      <i data-lucide="clock" class="w-4 h-4 text-gray-400 shrink-0"></i>
      <span class="flex-1 text-sm text-gray-500 truncate">${escapeHtml(h.query)}</span>
      <span class="text-xs text-gray-400 shrink-0">${relativeTime(h.time)}</span>
    </button>`).join("");
}

function navLinksMarkup(active) {
  return NAV_ITEMS.map((item) => {
    const isActive = item.id === active;
    return `
      <a href="${item.href}" class="nav-link flex items-center gap-3 px-3 py-2.5 rounded-btn text-sm font-medium ${
        isActive ? "bg-green-light text-green-dark" : "text-muted hover:bg-cream"
      }">
        <i data-lucide="${item.icon}" class="w-4 h-4"></i>
        <span>${item.label}</span>
      </a>`;
  }).join("");
}

function userCardMarkup(user, logoutId) {
  const initial = user?.name?.trim()?.[0]?.toUpperCase() || "?";
  return `
    <div class="border-t border-line pt-4 mt-4 flex items-center gap-3 px-1">
      <a href="profile.html" class="w-9 h-9 rounded-full bg-green-light text-green-dark font-bold flex items-center justify-center text-sm shrink-0">${initial}</a>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold truncate">${escapeHtml(user?.name || "")}</p>
        <p class="text-xs text-muted truncate">${escapeHtml(user?.email || "")}</p>
      </div>
      <button id="${logoutId}" title="Log out" class="btn-scale w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-red-500 hover:bg-red-50 shrink-0">
        <i data-lucide="log-out" class="w-4 h-4"></i>
      </button>
    </div>`;
}

function renderShell(active) {
  const user = currentUser();
  const sidebarRoot = document.getElementById("sidebar-root");
  const topnavRoot = document.getElementById("topnav-root");

  if (sidebarRoot) {
    sidebarRoot.innerHTML = `
      <aside class="hidden lg:flex w-64 shrink-0 flex-col border-r border-line bg-white h-screen sticky top-0 py-6 px-4">
        <a href="dashboard.html" class="flex items-center gap-2.5 px-2 mb-8">
          <span class="w-9 h-9 rounded-xl bg-green flex items-center justify-center"><i data-lucide="sparkles" class="w-5 h-5 text-white"></i></span>
          <span class="text-lg font-bold tracking-tight">Distill</span>
        </a>
        <nav class="flex-1 flex flex-col gap-1 overflow-y-auto">${navLinksMarkup(active)}</nav>
        ${userCardMarkup(user, "sidebarLogout")}
      </aside>

      <div id="drawerOverlay" class="lg:hidden fixed inset-0 bg-black/30 z-30 opacity-0 pointer-events-none"></div>
      <aside id="mobileDrawer" class="lg:hidden fixed top-0 left-0 h-screen w-64 bg-white z-40 flex flex-col py-6 px-4 shadow-xl">
        <div class="flex items-center justify-between px-2 mb-8">
          <a href="dashboard.html" class="flex items-center gap-2.5">
            <span class="w-9 h-9 rounded-xl bg-green flex items-center justify-center"><i data-lucide="sparkles" class="w-5 h-5 text-white"></i></span>
            <span class="text-lg font-bold tracking-tight">Distill</span>
          </a>
          <button id="drawerClose" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-cream"><i data-lucide="x" class="w-4 h-4"></i></button>
        </div>
        <nav class="flex-1 flex flex-col gap-1 overflow-y-auto">${navLinksMarkup(active)}</nav>
        ${userCardMarkup(user, "sidebarLogoutMobile")}
      </aside>`;
  }

  if (topnavRoot) {
    const initial = user?.name?.trim()?.[0]?.toUpperCase() || "?";
    topnavRoot.innerHTML = `
      <div class="flex items-center gap-3 w-full">
        <button id="drawerToggle" class="lg:hidden btn-scale w-9 h-9 rounded-lg flex items-center justify-center hover:bg-green-light shrink-0">
          <i data-lucide="menu" class="w-5 h-5"></i>
        </button>
        <h1 class="text-base font-semibold">${PAGE_TITLES[active] || ""}</h1>
        <div class="ml-auto flex items-center gap-2 relative">
          <button id="recentBtn" class="btn-scale w-9 h-9 rounded-lg flex items-center justify-center hover:bg-green-light text-muted" title="Recent searches">
            <i data-lucide="clock" class="w-[18px] h-[18px]"></i>
          </button>
          <div id="recentDropdown" class="hidden absolute right-0 top-11 w-72 bg-white rounded-card border border-line shadow-card overflow-hidden z-30"></div>
          <a href="profile.html" class="w-9 h-9 rounded-full bg-green-light text-green-dark font-bold flex items-center justify-center text-sm shrink-0">${initial}</a>
        </div>
      </div>`;
  }

  // Mobile drawer open/close
  const drawer = document.getElementById("mobileDrawer");
  const overlay = document.getElementById("drawerOverlay");
  const openDrawer = () => { drawer?.classList.add("open"); overlay?.classList.add("open"); };
  const closeDrawer = () => { drawer?.classList.remove("open"); overlay?.classList.remove("open"); };
  document.getElementById("drawerToggle")?.addEventListener("click", openDrawer);
  document.getElementById("drawerClose")?.addEventListener("click", closeDrawer);
  overlay?.addEventListener("click", closeDrawer);

  // Recent-searches dropdown
  const recentBtn = document.getElementById("recentBtn");
  const recentDropdown = document.getElementById("recentDropdown");
  recentBtn?.addEventListener("click", () => {
    recentDropdown.innerHTML = historyPreviewMarkup();
    recentDropdown.classList.toggle("hidden");
    if (window.lucide) lucide.createIcons();
    recentDropdown.querySelectorAll(".history-run").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.location.href = `home.html?q=${encodeURIComponent(btn.dataset.query)}`;
      });
    });
  });
  document.addEventListener("click", (e) => {
    if (recentDropdown && !recentDropdown.contains(e.target) && e.target !== recentBtn && !recentBtn?.contains(e.target)) {
      recentDropdown.classList.add("hidden");
    }
  });

  // Logout (desktop + mobile sidebar)
  document.getElementById("sidebarLogout")?.addEventListener("click", logoutUser);
  document.getElementById("sidebarLogoutMobile")?.addEventListener("click", logoutUser);

  if (window.lucide) lucide.createIcons();
}

function renderFooter() {
  const root = document.getElementById("footer-root");
  if (!root) return;
  root.innerHTML = `
    <footer class="border-t border-line py-6 px-6 lg:px-10 text-center text-xs text-muted">
      © ${new Date().getFullYear()} Distill — AI tool recommendations for professionals.
    </footer>`;
}
