/**
 * recommendation-card.js
 * Standalone recommendation card component: renders 1 highlighted "main"
 * card plus up to 6 alternative cards from a tools array, each flippable
 * to a 5-star Distill Rating input.
 *
 * Does NOT modify or replace anything in the existing project — this is a
 * new, independent module. Drop it into a page alongside
 * recommendation-card.css and call renderRecommendationCards().
 *
 * Integrates with this project's existing js/rating.js API when it's
 * loaded on the page (setRating, getToolRating, getMyRating — all global
 * functions in that file). If rating.js isn't present, it falls back to
 * an in-memory mock so the component still renders and is demoable on
 * its own.
 *
 * ─────────────────────────────────────────────────────────────────────
 * USAGE
 *   <link rel="stylesheet" href="recommendation-card.css">
 *   <script src="js/rating.js"></script>         <!-- optional but recommended -->
 *   <script src="recommendation-card.js"></script>
 *   <div id="cards"></div>
 *   <script>
 *     renderRecommendationCards(document.getElementById('cards'), sevenTools);
 *   </script>
 *
 * TOOL SHAPE (matches this project's existing js/data.js tools)
 *   {
 *     id: 1,                       // numeric — matches ai_tools.id in Postgres
 *     name: "Writesonic",
 *     category: "Writing Assistant",
 *     pricing: "free" | "hybrid" | "paid",
 *     credits: "100 free credits", // any short string, or omit
 *     description: "...",
 *     pros: ["...", "..."],
 *     cons: ["...", "..."],
 *     rating: 4.6,                 // fallback shown before the live API responds
 *     url: "https://..."
 * ─────────────────────────────────────────────────────────────────────
 */

(function () {
  "use strict";

  const PRICING_LABEL = {
  free: "Free",
  hybrid: "Freemium",
  paid: "Paid"
};
  const PRICING_CLASS = { free: "rcard-pricing--free", hybrid: "rcard-pricing--hybrid", paid: "rcard-pricing--paid" };

  let uidCounter = 0;
  function uid(prefix) {
    uidCounter += 1;
    return `${prefix}-${Date.now().toString(36)}-${uidCounter}`;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  // ── Rating API bridge ────────────────────────────────────────────────
  // Uses this project's real js/rating.js functions when available;
  // otherwise falls back to a local mock so the component still works
  // standalone (e.g. opened directly for a design review).
  const hasRealApi =
    typeof window.setRating === "function" &&
    typeof window.getToolRating === "function" &&
    typeof window.getMyRating === "function";

  const mockStore = {}; // toolId -> { sum, count, mine }

  const ratingApi = hasRealApi
    ? {
        submit: (toolId, stars) => window.setRating(toolId, stars),
        getSummary: (toolId) => window.getToolRating(toolId),
        getMine: (toolId) => window.getMyRating(toolId),
      }
    : {
        submit: async (toolId, stars) => {
          const entry = (mockStore[toolId] ||= { sum: 0, count: 0, mine: 0 });
          if (entry.mine) throw new Error("You have already rated this tool");
          entry.sum += stars;
          entry.count += 1;
          entry.mine = stars;
          return { averageRating: entry.sum / entry.count, totalRatings: entry.count };
        },
        getSummary: async (toolId) => {
          const entry = mockStore[toolId] || { sum: 0, count: 0 };
          return { averageRating: entry.count ? entry.sum / entry.count : 0, totalRatings: entry.count };
        },
        getMine: async (toolId) => (mockStore[toolId] || {}).mine || null,
      };

  // ── Star SVG ──────────────────────────────────────────────────────────
  function starSvg(filled) {
    return `<svg viewBox="0 0 24 24" class="rcard-star-svg ${filled ? "is-filled" : "is-empty"}" fill="currentColor" aria-hidden="true">
      <path d="M12 2.5l2.9 6.3 6.9.7-5.2 4.8 1.5 6.9L12 17.8l-6.1 3.4 1.5-6.9-5.2-4.8 6.9-.7L12 2.5z"/>
    </svg>`;
  }

  function staticStarsMarkup(average) {
    const rounded = Math.round((average || 0) * 2) / 2;
    let out = "";
    for (let i = 1; i <= 5; i += 1) out += starSvg(i <= rounded);
    return out;
  }

  // ── Card markup ──────────────────────────────────────────────────────
  // Every card shows the SAME number of pros/cons and the same amount of
  // description text — "main" included — so cards stay equal in size no
  // matter how much copy a given tool has. CSS line-clamp is a second
  // safety net on top of this.
  const PROS_CONS_COUNT = 2;
  const DESCRIPTION_MAX_CHARS = 120;

  function truncate(str, max) {
    const s = str == null ? "" : String(str);
    if (s.length <= max) return s;
    return `${s.slice(0, max - 1).trimEnd()}…`;
  }
             function getToolLogo(tool) {
  if (tool.logo_url) return tool.logo_url;
  if (tool.logo) return tool.logo;

  try {
    const url = new URL(tool.url || tool.official_website);
    return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=128`;
  } catch {
    return "";
  }
}
  function cardMarkup(tool, isMain) {
    const cardId = uid("rcard");
    const groupName = `${cardId}-stars`;
    const pricing = tool.pricing || "hybrid";
    const proCount = PROS_CONS_COUNT;

    // Radio inputs are placed BEFORE their label (reverse row via CSS is
    // avoided for simplicity — see the ~ sibling hover rule in the CSS)
    // and are given a document-unique name/id per card, fixing the
    // duplicate-id issue in the project's current inline template when
    // more than one card is on the page at once.
    const starsInput = [5, 4, 3, 2, 1]
      .map((val) => {
        const inputId = `${cardId}-star-${val}`;
        return `
          <input type="radio" id="${inputId}" name="${groupName}" value="${val}" />
          <label for="${inputId}" aria-label="Rate ${val} star${val > 1 ? "s" : ""}">${starSvg(false)}</label>
        `;
      })
      .join("");
    // Reverse the DOM order (5..1 declared, rendered 1..5 visually via
    // flex-direction) isn't needed here — CSS `~` sibling rule below
    // handles left-to-right fill because we declared 5→1: hovering star 3
    // highlights 3,2,1 which are its *later* siblings in this markup.

    return `
      <div class="rcard rcard-enter ${isMain ? "rcard--main" : ""}" data-tool-id="${escapeHtml(tool.id)}" id="${cardId}">
        ${isMain ? `<span class="rcard-badge-main">${crownSvg()} Most Recommended</span>` : ""}
        <div class="rcard-inner">

          <div class="rcard-front">
            <div class="rcard-header">
              <div class="rcard-identity">
                <span class="rcard-logo">
  ${
    getToolLogo(tool)
      ? `<img
          src="${escapeHtml(getToolLogo(tool))}"
          alt="${escapeHtml(tool.name || "Tool")} logo"
          loading="lazy"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
        >`
      : ""
  }
  <span class="rcard-logo-fallback">
    ${escapeHtml((tool.name || "?")[0])}
  </span>
</span>
                <div class="rcard-titles" style="min-width:0">
                  <p class="rcard-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(tool.name)}</p>
                  <p class="rcard-category">${escapeHtml(tool.category || "")}</p>
                </div>
              </div>
              <span class="rcard-pricing ${PRICING_CLASS[pricing] || PRICING_CLASS.hybrid}">${PRICING_LABEL[pricing] || "Hybrid"}</span>
            </div>

            <p class="rcard-description">${escapeHtml(truncate(tool.description || "", DESCRIPTION_MAX_CHARS))}</p>

            <div class="rcard-proscons">
              <div>
                <h4 style="color:var(--rcard-green-dark)">Pros</h4>
                <ul>${(tool.pros || []).slice(0, proCount).map((p) => `<li>· ${escapeHtml(p)}</li>`).join("")}</ul>
              </div>
              <div>
                <h4 style="color:var(--rcard-paid)">Cons</h4>
                <ul>${(tool.cons || []).slice(0, proCount).map((c) => `<li>· ${escapeHtml(c)}</li>`).join("")}</ul>
              </div>
            </div>

            <div class="rcard-footer">
              <div class="rcard-meta-row">
                <button type="button" class="rcard-rating-trigger" data-action="flip" aria-label="Rate ${escapeHtml(tool.name)}, opens the 5-star rating input">
                  <span class="rcard-stars-static" aria-hidden="true">${staticStarsMarkup(tool.rating)}</span>
                  <span class="rcard-rating-value">${tool.rating ? Number(tool.rating).toFixed(1) : "—"}</span>
                  <span class="rcard-rating-count" style="white-space:nowrap">(<span data-role="count">…</span> rated)</span>
                </button>
                <span class="rcard-credits">${escapeHtml(tool.credits || "No free credits")}</span>
              </div>
              <div class="rcard-actions">
                <a href="${escapeHtml(tool.url || "#")}" target="_blank" rel="noopener" class="rcard-btn rcard-btn--primary">
                  Visit site ${externalIconSvg()}
                </a>
                <button type="button" class="rcard-btn rcard-btn--icon" data-action="save" aria-pressed="false" aria-label="Save ${escapeHtml(tool.name)}">
                  ${bookmarkSvg()}
                </button>
              </div>
            </div>
          </div>

          <div class="rcard-back">
            <button type="button" class="rcard-back-close" data-action="flip-back" aria-label="Close rating, back to card">${closeSvg()}</button>
            <p class="rcard-back-label">Distill Rating</p>
            <p class="rcard-back-name">${escapeHtml(tool.name)}</p>

            <fieldset class="rcard-star-input" data-role="star-input">
              <legend class="rcard-visually-hidden" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)">Rate ${escapeHtml(tool.name)} from 1 to 5 stars</legend>
              ${starsInput}
            </fieldset>

            <button type="button" class="rcard-btn rcard-btn--primary" data-action="submit-rating" disabled style="min-width:120px">
              Submit
            </button>
            <p class="rcard-my-rating-note" data-role="my-rating-note" hidden></p>
            <p class="rcard-back-summary">
              Average <strong data-role="back-average">—</strong> · <span data-role="back-count">0</span> users
            </p>
          </div>

        </div>
      </div>`;
  }

  function crownSvg() {
    return `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M3 18h18l1-9-6 4-4-7-4 7-6-4 1 9zM3 20h18v2H3z"/></svg>`;
  }
  function externalIconSvg() {
    return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>`;
  }
  function bookmarkSvg() {
    return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg>`;
  }
  function closeSvg() {
    return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
  }

  // ── Per-card wiring ──────────────────────────────────────────────────
  async function refreshRatingDisplay(cardEl, toolId) {
    try {
      const summary = await ratingApi.getSummary(toolId);
      const avg = Number(summary.averageRating) || 0;
      const count = Number(summary.totalRatings) || 0;
      cardEl.querySelectorAll('[data-role="count"]').forEach((el) => (el.textContent = count));
      cardEl.querySelector('[data-role="back-average"]').textContent = avg > 0 ? avg.toFixed(1) : "N/A";
      cardEl.querySelector('[data-role="back-count"]').textContent = count;
      const starsStatic = cardEl.querySelector(".rcard-stars-static");
      if (starsStatic) starsStatic.innerHTML = staticStarsMarkup(avg);
      const valueEl = cardEl.querySelector(".rcard-rating-value");
      if (valueEl && avg > 0) valueEl.textContent = avg.toFixed(1);
    } catch (err) {
      // Leave placeholders as-is; a network hiccup shouldn't break the card.
      // eslint-disable-next-line no-console
      console.error("Failed to load rating:", err);
    }
  }

  function setBackStarSelection(cardEl, value) {
    const input = cardEl.querySelector(`.rcard-star-input input[value="${value}"]`);
    if (input) input.checked = true;
    const submitBtn = cardEl.querySelector('[data-action="submit-rating"]');
    if (submitBtn) submitBtn.disabled = !value;
  }

  async function wireCard(cardEl, tool) {
    const toolId = tool.id;
    const front = cardEl.querySelector(".rcard-front");
    const back = cardEl.querySelector(".rcard-back");

    // Both faces exist in the DOM at all times (the flip is a pure CSS
    // transform), so without this, a keyboard user could Tab into
    // whichever face is currently rotated out of view — a real focus-
    // order/visibility mismatch. `inert` removes the hidden face from
    // both the tab order and the accessibility tree until it's shown.
    function setFlipped(flipped) {
      cardEl.classList.toggle("is-flipped", flipped);
      if ("inert" in front) {
        front.inert = flipped;
        back.inert = !flipped;
      }
    }
    setFlipped(false);

    const flipTriggers = cardEl.querySelectorAll('[data-action="flip"], [data-action="flip-back"]');
    flipTriggers.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const next = !cardEl.classList.contains("is-flipped");
        setFlipped(next);
        if (next) {
          const starInput = cardEl.querySelector('[data-role="star-input"]');
          starInput?.classList.add("is-glowing");
          setTimeout(() => starInput?.classList.remove("is-glowing"), 1400);
          // Move focus onto the newly-visible face so keyboard users land
          // somewhere sensible instead of on a now-inert element.
          const firstStar = cardEl.querySelector('.rcard-star-input input:not(:disabled)');
          (firstStar || cardEl.querySelector('.rcard-back-close'))?.focus();
        } else {
          cardEl.querySelector('[data-action="flip"]')?.focus();
        }
      });
    });

    // Click anywhere on the card that ISN'T an interactive control (a
    // link, button, or the star-rating inputs/labels) toggles the flip.
    // This is what makes a *second* click — on the back face, not just
    // the explicit ✕ close button — turn the card back to the front.
    // The dedicated flip/flip-back buttons above already call
    // e.stopPropagation(), so this listener never double-toggles them.
    cardEl.addEventListener("click", (e) => {
      if (e.target.closest("a, button, input, label")) return;
      setFlipped(!cardEl.classList.contains("is-flipped"));
    });

    // Optional bonus: long-press the card front also flips it (kept from
    // this project's existing UX), without breaking keyboard/click access.
    let pressTimer = null;
    front.addEventListener("mousedown", (e) => {
      if (e.target.closest("a,button")) return;
      pressTimer = setTimeout(() => setFlipped(true), 600);
    });
    ["mouseup", "mouseleave", "touchend", "touchcancel"].forEach((evt) =>
      front.addEventListener(evt, () => clearTimeout(pressTimer))
    );

    // Save toggle (local-only UI state; wire to a real "saved tools" API later)
    cardEl.querySelector('[data-action="save"]')?.addEventListener("click", (e) => {
      const btn = e.currentTarget;
      const pressed = btn.getAttribute("aria-pressed") === "true";
      btn.setAttribute("aria-pressed", String(!pressed));
    });

    // Star selection preview + enabling Submit
    const starInputEl = cardEl.querySelector('[data-role="star-input"]');
    starInputEl.addEventListener("change", (e) => {
      if (e.target.matches('input[type="radio"]')) {
        setBackStarSelection(cardEl, e.target.value);
      }
    });

    const submitBtn = cardEl.querySelector('[data-action="submit-rating"]');
    submitBtn.addEventListener("click", async () => {
      const checked = cardEl.querySelector('.rcard-star-input input:checked');
      if (!checked) return;
      const stars = Number(checked.value);
      submitBtn.disabled = true;
      submitBtn.textContent = "Saving…";
      try {
        await ratingApi.submit(toolId, stars);
        submitBtn.textContent = "Saved ✓";
        await refreshRatingDisplay(cardEl, toolId);
        setTimeout(() => {
          setFlipped(false);
          submitBtn.textContent = "Submit";
        }, 700);
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit";
        const note = cardEl.querySelector('[data-role="my-rating-note"]');
        const message = err && err.message ? err.message : "Failed to submit rating.";
        if (note) {
          note.hidden = false;
          note.textContent =
            message === "Please login first"
              ? "Log in to rate this tool."
              : message.includes("already rated")
                ? "You've already rated this tool."
                : message;
        }
      }
    });

    // Pre-check whether the user already rated this tool — the backend
    // rejects a second rating (409), so lock the star input to their
    // existing choice instead of letting them try and fail.
    try {
      const mine = await ratingApi.getMine(toolId);
      const value = mine && (mine.rating ?? mine);
      if (value) {
        setBackStarSelection(cardEl, value);
        cardEl.querySelectorAll('.rcard-star-input input').forEach((i) => (i.disabled = true));
        submitBtn.disabled = true;
        submitBtn.textContent = "Rated ✓";
        const note = cardEl.querySelector('[data-role="my-rating-note"]');
        if (note) {
          note.hidden = false;
          note.textContent = `You rated this ${value} star${value > 1 ? "s" : ""}.`;
        }
      }
    } catch (err) {
      // Not logged in / offline — leave the input open, submit will surface the real error.
    }

    await refreshRatingDisplay(cardEl, toolId);
  }

  /**
   * Renders 1 main card (tools[0]) + up to 6 alternative cards
   * (tools[1..6]) into `container`. Safe to call multiple times — replaces
   * the container's previous contents each call.
   *
   * @param {HTMLElement} container
   * @param {Array<Object>} tools - first item is the highlighted main pick
   */
  function renderRecommendationCards(container, tools) {
    if (!container) return;
    const list = Array.isArray(tools) ? tools.slice(0, 8) : [];

    // All cards — the highlighted pick and every alternative — render into
    // ONE grid (.rcard-row) so they're always equal width/height and the
    // layout reflows responsively as one unit instead of two mismatched
    // rows.
    container.classList.add("rcard-grid");
    container.innerHTML = `
      <div class="rcard-row">${list.map((t, i) => cardMarkup(t, i === 0)).join("")}</div>
    `;

    const cardEls = container.querySelectorAll(".rcard");
    list.forEach((tool, i) => wireCard(cardEls[i], tool));
  }

  /** Shows 1 main + up to 6 skeleton placeholders while recommendations load. */
  function renderRecommendationSkeleton(container, count = 7) {
    if (!container) return;
    container.classList.add("rcard-grid");
    const skeletonCard = (main) => `
      <div class="rcard ${main ? "rcard--main" : ""}">
        <div class="rcard-front">
          <div class="rcard-skeleton" style="width:40%;height:14px;margin-bottom:16px"></div>
          <div class="rcard-skeleton" style="width:70%;height:20px;margin-bottom:10px"></div>
          <div class="rcard-skeleton" style="width:100%;height:12px;margin-bottom:6px"></div>
          <div class="rcard-skeleton" style="width:85%;height:12px;margin-bottom:20px"></div>
          <div class="rcard-skeleton" style="width:100%;height:44px"></div>
        </div>
      </div>`;
    container.innerHTML = `
      <div class="rcard-row">
        ${skeletonCard(true)}
        ${Array.from({ length: Math.max(0, count - 1) }).map(() => skeletonCard(false)).join("")}
      </div>
    `;
  }

  window.renderRecommendationCards = renderRecommendationCards;
  window.renderRecommendationSkeleton = renderRecommendationSkeleton;
})();
