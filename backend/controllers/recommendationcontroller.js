const pool = require("../config/db");
const ai = require("../config/gemini");

const getRecommendations = async (req, res) => {
    try {
        const { profession, task, message } = req.body;

        const userTask = message || task;

        if (!profession || !userTask) {
            return res.status(400).json({
                success: false,
                message: "Profession and task are required"
            });
        }

        // Understand the user's intent before searching the database.
        // This helps with misspellings, abbreviations, Hinglish,
        // and natural-language queries.

        let searchTerms = [];

        try {
            const intentPrompt = `
You are the query-understanding layer for Distill.

Understand the user's request and convert it into concise search
concepts that can be used to find AI tools in a database.

USER PROFESSION:
${profession}

USER TASK:
${userTask}

Rules:
1. Understand the meaning, not just the exact spelling.
2. Correct obvious spelling mistakes.
3. Understand common abbreviations such as ppt, cv, resume, etc.
4. Understand simple Hinglish and informal language.
5. Do not recommend any tools.
6. Return only search concepts.
7. Return JSON only.
8. Return 3 to 8 concise search terms.
9. Prefer meaningful concepts such as task types, tool categories,
   use cases, and common keywords.

Return exactly this structure:

{
  "search_terms": [
    "term 1",
    "term 2",
    "term 3"
  ]
}
`;

            const intentResponse = await ai.interactions.create({
                model: "gemini-3.5-flash",
                input: intentPrompt
            });

            const intentText = (intentResponse.output_text || "")
                .replace(/```json/gi, "")
                .replace(/```/g, "")
                .trim();

            const parsedIntent = JSON.parse(intentText);

            if (Array.isArray(parsedIntent.search_terms)) {
                searchTerms = parsedIntent.search_terms
                    .filter(term => typeof term === "string")
                    .map(term => term.trim().toLowerCase())
                    .filter(Boolean)
                    .slice(0, 8);
            }
        } catch (error) {
            console.error("Intent understanding error:", error.message);
        }

        // Always keep the original query as a fallback.
        const originalSearch = userTask.trim().toLowerCase();

        if (originalSearch && !searchTerms.includes(originalSearch)) {
            searchTerms.push(originalSearch);
        }

        if (!searchTerms.length) {
            searchTerms = [originalSearch];
        }

const searchPatterns = searchTerms.map(term => `%${term}%`);

const result = await pool.query(
    `
    SELECT
        id,
        tool_name,
        category,
        subcategory,
        target_users,
        description,
        best_use_cases,
        official_website,
        pricing,
        free_plan_details,
        paid_plans,
        ai_models,
        api_available,
        platforms,
        login_required,
        alternatives,
        tags,
        primary_use
    FROM ai_tools
    WHERE is_active = true
      AND (
          tool_name ILIKE ANY($1::text[])
          OR category ILIKE ANY($1::text[])
          OR subcategory ILIKE ANY($1::text[])
          OR target_users ILIKE ANY($1::text[])
          OR description ILIKE ANY($1::text[])
          OR best_use_cases ILIKE ANY($1::text[])
          OR primary_use ILIKE ANY($1::text[])
          OR tags::text ILIKE ANY($1::text[])
      )
    ORDER BY
        (
            CASE WHEN tool_name ILIKE ANY($1::text[]) THEN 100 ELSE 0 END +
            CASE WHEN category ILIKE ANY($1::text[]) THEN 80 ELSE 0 END +
            CASE WHEN subcategory ILIKE ANY($1::text[]) THEN 70 ELSE 0 END +
            CASE WHEN primary_use ILIKE ANY($1::text[]) THEN 60 ELSE 0 END +
            CASE WHEN best_use_cases ILIKE ANY($1::text[]) THEN 50 ELSE 0 END +
            CASE WHEN target_users ILIKE ANY($1::text[]) THEN 40 ELSE 0 END +
            CASE WHEN description ILIKE ANY($1::text[]) THEN 30 ELSE 0 END +
            CASE WHEN tags::text ILIKE ANY($1::text[]) THEN 20 ELSE 0 END
        ) DESC,
        id
    LIMIT 30
    `,
    [searchPatterns]
);

        const tools = result.rows;

        if (!tools.length) {
            return res.status(404).json({
                success: false,
                message: "No active AI tools found in database"
            });
        }

        // Give Gemini the useful database information,
        // not just name/category/description.
        const toolData = tools.map((tool) => ({
            id: tool.id,
            tool_name: tool.tool_name,
            category: tool.category,
            subcategory: tool.subcategory,
            target_users: tool.target_users,
            description: tool.description,
            best_use_cases: tool.best_use_cases,
            pricing: tool.pricing,
            free_plan_details: tool.free_plan_details,
            paid_plans: tool.paid_plans,
            ai_models: tool.ai_models,
            api_available: tool.api_available,
            platforms: tool.platforms,
            login_required: tool.login_required,
            alternatives: tool.alternatives,
            tags: tool.tags,
            primary_use: tool.primary_use
        }));

        const prompt = `
You are the recommendation engine for Distill.

Your job is to recommend the best AI tools from the provided Distill database.

USER PROFESSION:
${profession}

USER TASK:
${userTask}

DATABASE TOOLS:
${JSON.stringify(toolData, null, 2)}

STRICT RULES:

1. Use ONLY tools present in the database.
2. Never invent a tool.
3. Return EXACTLY 7 tools.
4. Rank them from best match to weakest match.
5. The first tool must be the strongest overall match.
6. Match the user's task against:
   - profession
   - category
   - subcategory
   - target users
   - description
   - best use cases
   - pricing
   - primary use
   - tags
7. Do not change the database tool name.
8. Do not invent pricing, features, URLs, models or other factual information.
9. "reason" must explain why the tool matches THIS user's task.
10. "how_it_helps" must explain what the user can actually do with the tool for THIS task.
11. "pros" must contain 2 short strengths supported by the database information.
12. "cons" must contain 2 short limitations based only on information available in the database.
13. Keep every explanation short and useful.
14. Return JSON only.
15. No markdown.
16. No text before or after the JSON.

Return exactly this structure:

{
  "recommendations": [
    {
      "tool_name": "exact database tool_name",
      "reason": "short reason",
      "how_it_helps": "short task-specific explanation",
      "pros": [
        "strength 1",
        "strength 2"
      ],
      "cons": [
        "limitation 1",
        "limitation 2"
      ]
    }
  ]
}
`;

        const interaction = await ai.interactions.create({
            model: "gemini-3.5-flash",
            input: prompt
        });

        const aiText = interaction.output_text || "";

        const cleanedText = aiText
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        let aiRecommendations;

        try {
            aiRecommendations = JSON.parse(cleanedText);
        } catch (parseError) {
            console.error("Gemini JSON parse error:", aiText);

            return res.status(500).json({
                success: false,
                message: "Gemini returned invalid recommendation format"
            });
        }

        if (
            !aiRecommendations ||
            !Array.isArray(aiRecommendations.recommendations)
        ) {
            return res.status(500).json({
                success: false,
                message: "Invalid recommendation structure from Gemini"
            });
        }

        // Match Gemini recommendations back to REAL DB 
             const recommendedTools = [];
const usedToolIds = new Set();

for (const recommendation of aiRecommendations.recommendations || []) {
    const tool = tools.find(
        (t) =>
            String(t.tool_name).toLowerCase().trim() ===
            String(recommendation.tool_name).toLowerCase().trim()
    );

    if (!tool) continue;

    // Prevent duplicate tools
    if (usedToolIds.has(tool.id)) continue;

    usedToolIds.add(tool.id);

    recommendedTools.push({
        id: tool.id,
        name: tool.tool_name,
        category: tool.category,
        description: tool.description,
        url: tool.official_website,
        pricing: tool.pricing,

        credits: tool.free_plan_details || "See free plan details",

        pros: Array.isArray(recommendation.pros)
            ? recommendation.pros.slice(0, 2)
            : [],

        cons: Array.isArray(recommendation.cons)
            ? recommendation.cons.slice(0, 2)
            : [],

        recommendation_reason: recommendation.reason || "",

        recommendation_help: recommendation.how_it_helps || "",

        subcategory: tool.subcategory,
        target_users: tool.target_users,
        best_use_cases: tool.best_use_cases,
        free_plan_details: tool.free_plan_details,
        paid_plans: tool.paid_plans,
        ai_models: tool.ai_models,
        api_available: tool.api_available,
        platforms: tool.platforms,
        login_required: tool.login_required,
        alternatives: tool.alternatives,
        tags: tool.tags,
        primary_use: tool.primary_use
    });
}

        // Guarantee that the frontend gets at most 7 cards.
        const finalTools = recommendedTools.slice(0, 7);

        console.log(
            `Gemini selected ${finalTools.length} valid database tools`
        );

        return res.status(200).json({
            success: true,
            profession,
            task: userTask,

            // Clean structured recommendation data
            recommendations: aiRecommendations.recommendations.slice(0, 7),

            // Frontend-ready tool data
            tools: finalTools
        });

    } catch (error) {
        console.error("Recommendation error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to generate recommendation",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined
        });
    }
};

module.exports = {
    getRecommendations
};