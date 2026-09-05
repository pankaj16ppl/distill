const searchModel = require("../models/searchmodel");
const ai = require("../config/gemini");

const searchTools = async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Search query is required"
            });
        }

        const originalQuery = q.trim();
        let searchTerms = [];

        try {
           const prompt = `
You are the query-understanding layer for Distill, an AI tool discovery platform.

Your job is to understand what the user is trying to accomplish and convert the request into useful concepts for searching an AI-tool database.

USER QUERY:
${originalQuery}

Rules:
1. Understand the user's intended task, not just the exact words.
2. Understand English, Hinglish, informal language, abbreviations, and common spelling mistakes.
3. Infer the actual task or goal from the complete sentence.
4. Generate concise concepts that could realistically appear in an AI-tool database.
5. Include task type, category, use case, and useful synonyms when relevant.
6. Do NOT recommend tools.
7. Do NOT invent tool names.
8. NEVER copy the user's original query, sentence, phrase, or any part of it as a search term.
9. If the user's query contains informal, Hinglish, abbreviated, or misspelled wording, normalize its meaning into standard search concepts instead of returning the original wording.
10. Do NOT use the user's entire sentence as a search term.
11. Do NOT return generic words such as "AI", "tool", "help", or "best".
12. Return 3 to 8 useful search terms.
13. The search terms must describe the user's intended task, not the wording of the request.
14. Work dynamically for ANY user task or use case. Do not assume a fixed list of tasks, categories, languages, or output types.
15. Generate search concepts that are useful for matching tools in the database, even when the user's wording is unusual or incomplete.
16. Return valid JSON only.
17. Before returning the final JSON, verify every search term. If any term is copied from the USER QUERY or contains the user's original wording, remove it and replace it with a newly generated normalized concept.
18. The final search_terms array must contain only normalized concepts, categories, use cases, or synonyms suitable for database matching. Never include raw user input.

Return exactly:
{
  "search_terms": [
    "concept 1",
    "concept 2",
    "concept 3"
  ]
}
`;

            const response = await ai.interactions.create({
                model: "gemini-3.5-flash",
                input: prompt
            });

            const text = (response.output_text || "")
                .replace(/```json/gi, "")
                .replace(/```/g, "")
                .trim();

            const parsed = JSON.parse(text);

            if (Array.isArray(parsed.search_terms)) {
                searchTerms = parsed.search_terms
                    .filter(term => typeof term === "string")
                    .map(term => term.trim().toLowerCase())
                    .filter(Boolean)
                    .slice(0, 8);
            }

        } catch (error) {
            console.error(
                "Search intent understanding failed:",
                error.message
            );
        }
if (!searchTerms.length) {
    return res.status(500).json({
        success: false,
        message: "Could not understand search query"
    });
}

        console.log("Original query:", originalQuery);
        console.log("Search terms:", searchTerms);

       const tools = await searchModel.searchTools(searchTerms);

       const displayQuery = searchTerms[0] || originalQuery;

res.json({
    success: true,
    count: tools.length,
    originalQuery,
    displayQuery,
    data: tools
});

    } catch (error) {
        console.error("Search Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to search AI tools"
        });
    }
};

module.exports = {
    searchTools
};
