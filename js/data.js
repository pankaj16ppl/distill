// js/data.js
//
// Replaces the old hardcoded mock catalog with a live fetch from the
// Neon-backed backend (GET /api/tools -> backend/controllers/toolcontroller.js
// -> backend/models/toolmodel.js -> `SELECT * FROM ai_tools`).
//
// AI_TOOLS starts empty and is populated asynchronously as soon as this
// script loads. Anything that reads AI_TOOLS *synchronously* right after
// page load (like offers.html did) needs to wait on `toolsReady` first —
// see the updated offers.html for the pattern.

const TOOLS_API = "http://localhost:5000/api/tools";

let AI_TOOLS = [];

/**
 * Maps a raw `ai_tools` row (from Neon) to the shape the frontend
 * components already expect (recommendation-card.js, tools-grid.js).
 *
 * Known gaps in the current schema, defaulted gracefully rather than
 * left undefined:
 *   - No `credits` column exists on ai_tools yet, so `credits` always
 *     falls back to "Not specified" until one is added (see note at the
 *     bottom of this file for the migration to add it).
 *   - No `pros`/`cons` columns exist, so those render as empty lists on
 *     the card — harmless, recommendation-card.js already handles an
 *     empty array.
 *   - `pricing` IS a real column (confirmed in trendingcontroller.js), so
 *     it's mapped directly, just defensively normalized to the exact
 *     "free" | "hybrid" | "paid" strings the card CSS classes expect.
 */
function normalizePricing(value) {
  const v = (value || "").toString().trim().toLowerCase();
  if (v.includes("free") && !v.includes("freemium")) return "free";
  if (v.includes("paid")) return "paid";
  // "freemium", "hybrid", blank, or anything unrecognized -> hybrid,
  // which is the safest visual default (yellow "check before you commit"
  // badge rather than a false "Free" or "Paid" claim).
  return "hybrid";
}

function mapDbToolToCard(row) {
  return {
    id: row.id,

    name: row.tool_name || "Untitled tool",

    category: row.category || row.subcategory || "AI Tool",

    description: row.description || row.best_use_cases || "",

    url: row.official_website || row.source_url || "#",

    pricing: normalizePricing(row.pricing),

    credits: row.free_plan_details || "Not specified",

    pros: [],

    cons: [],

    rating: 0,

    // Verified live data from backend
    livePlans: Array.isArray(row.live_plans) ? row.live_plans : [],

    liveFeatures: Array.isArray(row.live_features)
      ? row.live_features
      : [],

    // Source health
    sourceStatus: row.source_status || "unknown",
    sourceHttpStatus: row.http_status || null,
    lastSuccessAt: row.last_success_at || null,
    lastError: row.last_error || null,

    // Existing database information
    aiModels: Array.isArray(row.ai_models) ? row.ai_models : [],
    platforms: Array.isArray(row.platforms) ? row.platforms : [],

    keywords: [
      row.tool_name,
      row.category,
      row.subcategory,
      row.description,
      row.best_use_cases,
      row.free_plan_details,
      row.paid_plans,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean),
  };
}

/** Resolves once AI_TOOLS has been populated from the live database (or failed trying). */
const toolsReady = (async function loadToolsFromApi() {
  try {
    const response = await fetch(TOOLS_API);
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to load AI tools");
    }

    AI_TOOLS = (data.data || []).map(mapDbToolToCard);
    console.log(`Loaded ${AI_TOOLS.length} AI tools from Neon.`);
  } catch (error) {
    console.error("Failed to load AI tools from the database:", error);
    // Deliberately no hardcoded fallback here — showing an honest empty
    // state (see performSearch's "no results" handling) is better than
    // silently serving fake data if the backend/DB is unreachable.
    AI_TOOLS = [];
  }
  return AI_TOOLS;
})();

/**
 * Keyword scorer: counts overlap between the query's tokens and each
 * tool's name/category/description/keywords, then ranks by score.
 * Operates on whatever is currently in AI_TOOLS — call this only after
 * `await toolsReady` has resolved (home.html's search flow already runs
 * well after page load, so by the time a user submits a search the fetch
 * has normally already completed).
 */
function searchTools(query, limit = 3) {
  const q = (query || "").toLowerCase().trim();
  if (!q) return AI_TOOLS.slice(0, limit);
  const tokens = q.split(/\s+/).filter(Boolean);

  const scored = AI_TOOLS.map((tool) => {
    const haystack = [tool.name, tool.category, tool.description, ...tool.keywords]
      .join(" ")
      .toLowerCase();
    let score = 0;
    tokens.forEach((t) => {
      if (haystack.includes(t)) score += 1;
      if (tool.keywords.some((k) => k.startsWith(t))) score += 1;
    });
    return { tool, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const ranked = scored.filter((s) => s.score > 0);
  const pool = ranked.length ? ranked : scored;
  return pool.slice(0, limit).map((s) => s.tool);
}

function suggestQueries(partial) {
  const p = (partial || "").toLowerCase().trim();
  if (!p) return [];
  const pool = [
    "AI tools for presentations",
    "best AI tools for students",
    "AI tools for writing content",
    "free AI image generator",
    "AI tools for research",
    "AI coding assistant",
    "AI meeting notes",
    "AI video editor",
    "AI for summarizing papers",
    "AI calendar assistant",
  ];
  return pool.filter((s) => s.toLowerCase().includes(p)).slice(0, 5);
}

/*
 * To make `credits` real instead of "Not specified", add a column and
 * backfill it, e.g.:
 *
 *   ALTER TABLE ai_tools ADD COLUMN credits TEXT;
 *   UPDATE ai_tools SET credits = '100 free credits' WHERE tool_name = 'Writesonic';
 *   -- ...repeat per tool, or generate from whatever source you're
 *   -- pulling credit info from.
 *
 * Then update mapDbToolToCard() above:
 *   credits: row.credits || "Not specified",
 */
