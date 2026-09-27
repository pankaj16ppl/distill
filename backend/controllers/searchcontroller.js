const searchModel = require("../models/searchmodel");
const ai = require("../config/gemini");

const QUERY_UNDERSTANDING_TIMEOUT = 5000;

/*
 * Prevent Gemini query understanding from holding the search request
 * indefinitely. Database search remains the fallback.
 */
function withTimeout(promise, ms, label) {
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            setTimeout(() => {
                reject(
                    new Error(`${label} timed out after ${ms}ms`)
                );
            }, ms);
        })
    ]);
}

const searchTools = async (req, res) => {
    try {
        const query =
            typeof req.query.q === "string"
                ? req.query.q.trim()
                : "";

        if (!query) {
            return res.status(400).json({
                success: false,
                message: "Search query is required"
            });
        }

        const originalQuery = query;

        let searchTerms = [];
        let searchCategory = null;
        let searchSubcategory = null;

        // ============================================================
        // QUERY UNDERSTANDING
        // ============================================================
        //
        // Gemini only understands the user's intent.
        // It does NOT provide the final tool data.
        //
        // If Gemini fails / times out / reaches quota:
        // the real database search continues using the user's query.
        // ============================================================

        try {
            const prompt = `
You are the query-understanding layer for Distill.

Your job is ONLY to classify the user's search query into
existing categories and subcategories used by the database.

Do NOT recommend tools.
Do NOT invent categories.
Do NOT invent subcategories.

Existing categories:

AI & Automation
AI Chatbots & Assistants
Coding & Developer Tools
Creative
Developer Tools
Education - Accessibility
Education - Engagement
Education - Grading & Assessment
Education - Lesson Planning
Education - STEM
Health & Fitness
Image & Design
Other Niche Tools
Presentations & Diagrams
Productivity & Automation
Research
Research & Knowledge
Video & Audio

Known subcategory examples:

Food & Cooking
Travel
Home & DIY
Fashion & Beauty
Pets
Parenting
Relationships
Spirituality
Automotive
Mental Health
Nutrition
Workout Plans
AI Search
Second Brain
Source-grounded
Meeting Notetaker
Meeting Transcription
Notes & Docs
Workflow Automation
AI Presentations
Smart Slides
Text-to-Visual
Image Generation
Design Suite
Free Alternative
AI IDE
Cloud IDE
Code Completion
Privacy-focused

USER QUERY:
${originalQuery}

Rules:

- Use an existing category whenever possible.
- Use an existing subcategory whenever possible.
- For "cooking" use:
  category = "Other Niche Tools"
  subcategory = "Food & Cooking"
- For "recipe maker" prefer Food & Cooking.
- Keywords must contain the important concepts from the query.
- Return ONLY valid JSON.

Return exactly:

{
  "category": "existing category or null",
  "subcategory": "existing subcategory or null",
  "keywords": ["keyword1", "keyword2", "keyword3"]
}
`;

            const response = await withTimeout(
                ai.interactions.create({
                    model: "gemini-3.5-flash",
                    input: prompt
                }),
                QUERY_UNDERSTANDING_TIMEOUT,
                "Gemini query understanding"
            );

            const text =
                (response.output_text || "")
                    .replace(/```json/gi, "")
                    .replace(/```/g, "")
                    .trim();

            const parsed = JSON.parse(text);

            searchCategory =
                typeof parsed.category === "string" &&
                parsed.category.trim()
                    ? parsed.category.trim()
                    : null;

            searchSubcategory =
                typeof parsed.subcategory === "string" &&
                parsed.subcategory.trim()
                    ? parsed.subcategory.trim()
                    : null;

            searchTerms =
                Array.isArray(parsed.keywords)
                    ? parsed.keywords
                        .filter(
                            term =>
                                typeof term === "string"
                        )
                        .map(
                            term =>
                                term.trim().toLowerCase()
                        )
                        .filter(Boolean)
                        .slice(0, 6)
                    : [];

        } catch (error) {
            console.error(
                "Search intent understanding failed:",
                error.message
            );

            /*
             * Safe fallback.
             *
             * Search directly using the user's real query.
             * No fake AI result is created.
             */
            searchCategory = null;
            searchSubcategory = null;

            searchTerms =
                originalQuery
                    .toLowerCase()
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 6);
        }

        // ============================================================
        // VALIDATE SEARCH TERMS
        // ============================================================

        if (!searchTerms.length) {
            return res.status(400).json({
                success: false,
                message: "Could not understand search query"
            });
        }

        // ============================================================
        // SEARCH DEBUG
        // ============================================================

        console.log(
            "Original query:",
            originalQuery
        );

        console.log(
            "Search category:",
            searchCategory
        );

        console.log(
            "Search subcategory:",
            searchSubcategory
        );

        console.log(
            "Search keywords:",
            searchTerms
        );

        // ============================================================
        // DYNAMIC DATABASE SEARCH
        // ============================================================

        let finalTools =
            await searchModel.searchTools(
                searchTerms,
                searchCategory,
                searchSubcategory
            );

        // If the AI-selected subcategory produces no result,
        // retry with the same query/category but without subcategory.
        if (
            finalTools.length === 0 &&
            searchSubcategory
        ) {
            console.log(
                `No tools found for subcategory "${searchSubcategory}". Retrying without subcategory...`
            );

            finalTools =
                await searchModel.searchTools(
                    searchTerms,
                    searchCategory,
                    null
                );
        }

        console.log(
            "Matched tools:",
            finalTools.map(
                tool => tool.tool_name
            )
        );

        // ============================================================
        // RESPONSE
        // ============================================================
        //
        // searchmodel already provides:
        // - ai_tools data
        // - live_plans
        // - live_features
        // - source information
        //
        // Therefore do NOT run another pricing query here.
        // ============================================================

const responseData = finalTools.map((tool) => ({
    id: tool.id,
    tool_name: tool.tool_name,
    slug: tool.slug,

    category: tool.category,
    subcategory: tool.subcategory,
    target_users: tool.target_users,

    description: tool.description,
    best_use_cases: tool.best_use_cases,

    official_website: tool.official_website,

    pricing: tool.pricing,
    free_plan_details: tool.free_plan_details,
    paid_plans: tool.paid_plans,

    ai_models: tool.ai_models,
    api_available: tool.api_available,
    platforms: tool.platforms,
    login_required: tool.login_required,

    alternatives: tool.alternatives,
    tags: tool.tags,
    primary_use: tool.primary_use,

    is_active: tool.is_active,

    source: tool.source,
    source_url: tool.source_url,
    logo_url: tool.logo_url,

    votes_count: tool.votes_count,
    is_trending: tool.is_trending,

    live_plans: Array.isArray(tool.live_plans)
        ? tool.live_plans
        : [],

    live_features: Array.isArray(tool.live_features)
        ? tool.live_features
        : [],

    relevance_score: tool.relevance_score,
    matched_keywords: tool.matched_keywords,

    last_checked_at: tool.last_checked_at,
    last_updated_at: tool.last_updated_at,
    data_status: tool.data_status,
    last_verified_at: tool.last_verified_at,
    best_use: tool.best_use,

    source_status: tool.source_status,
    http_status: tool.http_status,
    last_success_at: tool.last_success_at,
    last_error: tool.last_error,
    failure_count: tool.failure_count,
    success_count: tool.success_count
}));

return res.status(200).json({
    success: true,
    originalQuery,
    displayQuery:
        searchTerms[0] || originalQuery,
    count: responseData.length,
    data: responseData
});
    } catch (error) {
        console.error(
            "Search Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to search AI tools"
        });
    }
};

module.exports = {
    searchTools
};