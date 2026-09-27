// js/favorites.js
//
// Adds a "Favorite" feature on top of the existing app. This file does not
// modify how any existing card fetches or renders its data — it only:
//   1) talks to the new /api/favorites endpoints, and
//   2) knows how to build + wire a small star button that any card can
//      drop into its markup.
//
// Other files (js/recommendation-card.js, js/tools-grid.js) each add ONE
// line to their card markup (a call to favoriteStarMarkup) and ONE line to
// their wiring code (a call to wireFavoriteStars / wireFavoriteStarButton).
// Everything else about those cards is untouched.

const FAVORITES_API = "http://localhost:5000/api/favorites";

function getFavAuthToken() {
  return localStorage.getItem("distill_token");
}

let favoriteIdSetPromise = null;

async function fetchFavoriteIdSet(force) {
  const token = getFavAuthToken();

  if (!token) {
    return new Set();
  }

  if (!favoriteIdSetPromise || force) {
    favoriteIdSetPromise = (async () => {
      try {
        const response = await fetch(`${FAVORITES_API}/ids`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to load favorites");
        }

        const rows = Array.isArray(data.favorites) ? data.favorites : [];
        return new Set(rows.map((f) => `${f.item_type}:${f.item_id}`));
      } catch (error) {
        console.error("Favorites: failed to load favorite ids:", error);
        return new Set();
      }
    })();
  }

  return favoriteIdSetPromise;
}

async function addFavoriteApi(itemType, itemId, itemData) {
  const token = getFavAuthToken();

  if (!token) {
    throw new Error("Please login first");
  }

  const response = await fetch(FAVORITES_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      itemType,
      itemId: String(itemId),
      itemData: itemData || null,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to add favorite");
  }

  return data;
}

async function removeFavoriteApi(itemType, itemId) {
  const token = getFavAuthToken();

  if (!token) {
    throw new Error("Please login first");
  }

  const response = await fetch(
    `${FAVORITES_API}/${encodeURIComponent(itemType)}/${encodeURIComponent(itemId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to remove favorite");
  }

  return data;
}

async function getMyFavoritesApi() {
  const token = getFavAuthToken();

  if (!token) {
    return [];
  }

  const response = await fetch(FAVORITES_API, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to load favorites");
  }

  return Array.isArray(data.favorites) ? data.favorites : [];
}

function favStarSvg(filled) {
  return `<svg viewBox="0 0 24 24" class="distill-fav-star-icon" fill="${
    filled ? "currentColor" : "none"
  }" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2.5l2.9 6.3 6.9.7-5.2 4.8 1.5 6.9L12 17.8l-6.1 3.4 1.5-6.9-5.2-4.8 6.9-.7L12 2.5z"/></svg>`;
}

// Returns the HTML for a star button. Drop this into any card's markup —
// it's self-contained and position:absolute, so it never affects the
// existing layout, card size, or click targets around it.
function favoriteStarMarkup(itemType, itemId) {
  const safeId = String(itemId ?? "");
  return `<button type="button" class="distill-fav-star" data-fav-type="${itemType}" data-fav-id="${safeId}" aria-pressed="false" aria-label="Add to favorites" title="Add to favorites">${favStarSvg(
    false
  )}</button>`;
}

function setFavStarState(btn, isFav) {
  btn.setAttribute("aria-pressed", String(isFav));
  btn.classList.toggle("is-favorited", isFav);
  btn.title = isFav ? "Remove from favorites" : "Add to favorites";
  btn.setAttribute(
    "aria-label",
    isFav ? "Remove from favorites" : "Add to favorites"
  );
  btn.innerHTML = favStarSvg(isFav);
}

function normalizeFavoriteSnapshot(raw) {
  if (!raw || typeof raw !== "object") return raw;
  return {
    ...raw,
    name: raw.name || raw.tool_name,
    url: raw.url || raw.official_website || raw.website,
  };
}

async function wireFavoriteStarButton(btn, itemType, itemId, itemData) {
  if (!btn || btn.dataset.favWired === "true") return;
  btn.dataset.favWired = "true";

  const key = `${itemType}:${itemId}`;
  const idSet = await fetchFavoriteIdSet();
  setFavStarState(btn, idSet.has(key));

  btn.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!getFavAuthToken()) {
      window.location.href = "login.html";
      return;
    }

    const isCurrentlyFav = btn.classList.contains("is-favorited");
    btn.disabled = true;

    try {
      const set = await fetchFavoriteIdSet();

      if (isCurrentlyFav) {
        await removeFavoriteApi(itemType, itemId);
        set.delete(key);
        setFavStarState(btn, false);
      } else {
        await addFavoriteApi(
          itemType,
          itemId,
          normalizeFavoriteSnapshot(itemData)
        );
        set.add(key);
        setFavStarState(btn, true);
      }

      document.dispatchEvent(
        new CustomEvent("distill:favorites-changed", {
          detail: { itemType, itemId, isFavorited: !isCurrentlyFav },
        })
      );
    } catch (error) {
      console.error("Favorites: toggle failed:", error);
    } finally {
      btn.disabled = false;
    }
  });
}

function wireFavoriteStars(root, tools) {
  if (!root) return;

  const byId = new Map();
  (tools || []).forEach((t) => {
    if (t && t.id !== undefined && t.id !== null) {
      byId.set(String(t.id), t);
    }
  });

  root.querySelectorAll(".distill-fav-star").forEach((btn) => {
    if (btn.dataset.favWired === "true") return;

    const itemType = btn.dataset.favType || "tool";
    const itemId = btn.dataset.favId;
    const itemData = byId.get(String(itemId)) || null;

    wireFavoriteStarButton(btn, itemType, itemId, itemData);
  });
}

window.favoriteStarMarkup = favoriteStarMarkup;
window.wireFavoriteStars = wireFavoriteStars;
window.wireFavoriteStarButton = wireFavoriteStarButton;
window.addFavoriteApi = addFavoriteApi;
window.removeFavoriteApi = removeFavoriteApi;
window.getMyFavoritesApi = getMyFavoritesApi;
window.fetchFavoriteIdSet = fetchFavoriteIdSet;
window.normalizeFavoriteSnapshot = normalizeFavoriteSnapshot;