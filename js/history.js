// js/history.js

const HISTORY_KEY = "distill_history";

// Get history
function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

// Add a new search to history
function addHistory(query) {
  if (!query || !query.trim()) return;

  const cleanQuery = query.trim();
  const history = getHistory();

  // Remove duplicate query
  const filtered = history.filter(
    item => item.query.toLowerCase() !== cleanQuery.toLowerCase()
  );

  // Put newest search at the top
  filtered.unshift({
    query: cleanQuery,
    time: Date.now()
  });

  // Keep maximum 50
  localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify(filtered.slice(0, 50))
  );

  // Refresh sidebar immediately
  draw();
}

// Clear history
function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
  draw();
}

// Relative time
function relativeTime(ts) {
  const diff = Math.max(0, Date.now() - ts);

  const min = Math.floor(diff / 60000);

  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;

  const hrs = Math.floor(min / 60);

  if (hrs < 24) return `${hrs}h ago`;

  const days = Math.floor(hrs / 24);

  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;

  return new Date(ts).toLocaleDateString();
}

// Escape text safely
function escapeHistoryText(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Render history
function draw() {
  const list = document.getElementById("history-list");

  if (!list) return;

  const items = getHistory();

  if (items.length === 0) {
    list.innerHTML = `
      <div class="px-5 py-4 text-sm text-muted">
        No search history yet.
      </div>
    `;
    return;
  }

  // Show only 6 initially
  const visibleItems = items.slice(0, 6);

  list.innerHTML = visibleItems
    .map((h) => `
      <a
        href="home.html?q=${encodeURIComponent(h.query)}"
        class="nav-link flex items-center gap-3 px-5 py-2.5 hover:bg-green-light/50"
      >

        <i
          data-lucide="history"
          class="w-4 h-4 text-gray-400 shrink-0"
        ></i>

        <span class="flex-1 text-sm text-ink truncate">
          ${escapeHistoryText(h.query)}
        </span>

        <span class="text-[10px] text-muted shrink-0">
          ${relativeTime(h.time)}
        </span>

      </a>
    `)
    .join("");

  // Show More button
  if (items.length > 6) {
    const showMore = document.createElement("button");

    showMore.type = "button";
    showMore.className =
      "w-full px-5 py-2.5 text-left text-xs font-semibold text-green-dark hover:bg-green-light/50";

    showMore.textContent = "Show more →";

    showMore.addEventListener("click", () => {
      renderAllHistory(list, items);
    });

    list.appendChild(showMore);
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}

// Show all history
function renderAllHistory(list, items) {
  list.innerHTML = items
    .map((h) => `
      <a
        href="home.html?q=${encodeURIComponent(h.query)}"
        class="nav-link flex items-center gap-3 px-5 py-2.5 hover:bg-green-light/50"
      >

        <i
          data-lucide="history"
          class="w-4 h-4 text-gray-400 shrink-0"
        ></i>

        <span class="flex-1 text-sm text-ink truncate">
          ${escapeHistoryText(h.query)}
        </span>

        <span class="text-[10px] text-muted shrink-0">
          ${relativeTime(h.time)}
        </span>

      </a>
    `)
    .join("");

  const collapseBtn = document.createElement("button");

  collapseBtn.type = "button";
  collapseBtn.className =
    "w-full px-5 py-2.5 text-left text-xs font-semibold text-green-dark hover:bg-green-light/50";

  collapseBtn.textContent = "Show less ↑";

  collapseBtn.addEventListener("click", () => {
    draw();
  });

  list.appendChild(collapseBtn);

  if (window.lucide) {
    lucide.createIcons();
  }
}

// Draw when page loads
document.addEventListener("DOMContentLoaded", () => {
  draw();
});