// js/results.js

function mapDbToolToCard(tool) {
  const pricingMap = {
    Free: "free",
    Freemium: "hybrid",
    Paid: "paid",
  };

  return {
    id: tool.id,
    name: tool.tool_name || "Unknown Tool",
    category: tool.category || tool.subcategory || "AI Tool",

    pricing: pricingMap[tool.pricing] || "hybrid",

    credits: tool.free_plan_details || "No free credits",

    description: tool.description || tool.primary_use || "",

    pros: [
      tool.best_use_cases || "Useful for multiple AI tasks",
      tool.primary_use || "General AI functionality",
    ],

    cons: [
      tool.login_required ? "Login required" : "No login required",
      tool.pricing === "Paid"
        ? "Paid service"
        : "Some advanced features may require payment",
    ],

    rating: 0,

    url: tool.official_website || "#",

    logo_url: tool.logo_url || "",
  };
}


async function fetchSearchResults(query) {
  const response = await fetch(
  `http://localhost:5000/api/search?q=${encodeURIComponent(query)}`
);
  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.message || "Search failed");
  }

  return Array.isArray(result.data) ? result.data : [];
}


async function runSearch(query) {
  const resultsBlocks = document.getElementById("resultsBlocks");

  if (!resultsBlocks) {
    console.error("❌ resultsBlocks container not found");
    return;
  }

  if (!query || !query.trim()) {
    resultsBlocks.innerHTML = `
      <div id="emptyState" class="text-center py-20">
        <p class="mt-4 text-muted">
          Search for a task above to see your matches.
        </p>
      </div>
    `;
    return;
  }

  try {
    console.log("🔎 Searching:", query);

    resultsBlocks.innerHTML = `
      <div class="text-center py-20">
        <p class="text-muted">Finding the best AI tools...</p>
      </div>
    `;

    const dbTools = await fetchSearchResults(query);

    console.log("✅ API tools:", dbTools);
    console.log("✅ API count:", dbTools.length);

    if (!dbTools.length) {
      resultsBlocks.innerHTML = `
        <div class="text-center py-20">
          <p class="text-muted">
            No AI tools found for "${query}".
          </p>
        </div>
      `;
      return;
    }

    const cardTools = dbTools.map(mapDbToolToCard);

    console.log("✅ Mapped card tools:", cardTools);

    renderRecommendationCards(
      resultsBlocks,
      cardTools
    );

    console.log("✅ Recommendation cards rendered");

    if (window.lucide) {
      lucide.createIcons();
    }

  } catch (error) {
    console.error("❌ Search error:", error);

    resultsBlocks.innerHTML = `
      <div class="text-center py-20">
        <p class="text-red-500 font-semibold">
          Something went wrong while loading recommendations.
        </p>
        <p class="text-muted mt-2">
          Please try searching again.
        </p>
      </div>
    `;
  }
}


document.addEventListener("DOMContentLoaded", () => {

  const input = document.getElementById("homeSearchInput");
  const searchButton = document.getElementById("homeSearchBtn");

  if (!input || !searchButton) {
    console.error("❌ Search input or button not found");
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const query = params.get("q") || "";

  if (query) {
    input.value = query;
    runSearch(query);
  }


  searchButton.addEventListener("click", () => {
    const query = input.value.trim();

    if (!query) return;

    addHistory(query);

    const newUrl =
      `recommendations.html?q=${encodeURIComponent(query)}`;

    window.history.pushState({}, "", newUrl);

    runSearch(query);
  });


  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;

    event.preventDefault();

    const query = input.value.trim();

    if (!query) return;

    addHistory(query);

    const newUrl =
      `recommendations.html?q=${encodeURIComponent(query)}`;

    window.history.pushState({}, "", newUrl);

    runSearch(query);
  });

});