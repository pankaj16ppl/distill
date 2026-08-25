// js/search.js

async function fetchSearchResults(query) {
  if (!query || !query.trim()) {
    return [];
  }

  const url = `http://localhost:5000/api/search?q=${encodeURIComponent(query.trim())}`;
  console.log("Searching:", url);

  const response = await fetch(url);

  const data = await response.json();

  console.log("Search API response:", data);

  if (!response.ok) {
    throw new Error(
      data.message || `Search failed: ${response.status}`
    );
  }

  // Backend returns:
  // { success: true, count: 3, data: [...] }

  const tools = Array.isArray(data.data) ? data.data : [];

  // Convert backend database format
  // into the format expected by new-chat.html
  return tools.map(tool => ({
    id: tool.id,

    name: tool.tool_name,

    category: tool.category || "AI Tool",

    description: tool.description || "No description available.",

    url: tool.official_website || "#",

    pricing: tool.pricing || "Unknown",

    rating: Number(tool.rating || 0),

    credits: tool.free_plan_details || "Not specified",

    pros: [
      tool.best_use_cases || "Multiple useful AI capabilities",
      tool.api_available ? "API available" : "Easy to use",
      tool.platforms?.length
        ? `Available on ${tool.platforms.join(", ")}`
        : "Multiple platforms"
    ],

    cons: [
      tool.login_required ? "Login required" : "No login required",
      tool.paid_plans ? "Some features require a paid plan" : "Limited information"
    ]
  }));
}


function goToResults(query) {
  if (!query || !query.trim()) return;

  addHistory(query);

window.location.href =
  `home.html?q=${encodeURIComponent(query.trim())}`;
}